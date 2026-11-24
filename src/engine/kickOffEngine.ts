import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PITCH_DIMENSIONS, TEAM_PRESETS } from '../constants';
import { soundService } from '../services/soundService';
import type { GameState, MatchConfig, PlayerInputState } from '../types';
import {
  createEmptyInput,
  createInitialGameState,
  isPlayerAvailable,
  isPointInMud,
  serializeGameState,
  startSecondHalf,
  stepSimulation,
} from './physics';
import {
  buildPitchAndMarkings,
  createBallMesh,
  createCompositePlayerRig,
  createContactShadowTexture,
  createRefereeRig,
  type PlayerRig,
  type RefereeRig,
} from './stadiumBuilder';

export type CameraZoomLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface ZoomPreset {
  height: number;
  offsetX: number;
  offsetZ: number;
  fov: number;
  vertical: boolean;
}

const ZOOM_PRESETS: Record<CameraZoomLevel, ZoomPreset> = {
  0: { height: 22.0, offsetX: 0, offsetZ: 16.0, fov: 45, vertical: false },    // Srednje (koso)
  1: { height: 25.0, offsetX: 0, offsetZ: 1.6, fov: 44, vertical: false },     // Odozgo po dužini
  2: { height: 35.0, offsetX: 0, offsetZ: 2.2, fov: 45, vertical: false },     // Odozgo+ po dužini
  3: { height: 15.5, offsetX: 0, offsetZ: 11.5, fov: 44, vertical: false },    // Blizu (koso)
  4: { height: 30.5, offsetX: 0, offsetZ: 21.5, fov: 46, vertical: false },    // Široko (koso)
  5: { height: 26.5, offsetX: -1.6, offsetZ: 0, fov: 45, vertical: true },     // Odozgo po širini (klasični Amiga pogled)
  6: { height: 36.5, offsetX: -2.2, offsetZ: 0, fov: 46, vertical: true },     // Odozgo+ po širini
};

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

const PARTICLE_POOL_SIZE = 160;

// Reusable module-scope math objects (Zero-GC render loop)
const _dummy = new THREE.Object3D();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export interface EngineCallbacks {
  onStateUpdate: (state: GameState) => void;
  onZoomChange?: (zoom: CameraZoomLevel) => void;
}

export class KickOffEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private shadowTex: THREE.CanvasTexture;
  private worldGroup: THREE.Group;
  private actorsGroup: THREE.Group;

  private playerRigs = new Map<string, PlayerRig>();
  private refereeRig: RefereeRig | null = null;
  private ballGroup: THREE.Group;
  private ballSphere: THREE.Mesh;
  private ballShadow: THREE.Mesh;

  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  private gameState: GameState;
  private zoomLevel: CameraZoomLevel = 0;
  private camPos = new THREE.Vector3(0, 22, 16);
  private camLook = new THREE.Vector3(0, 0, 0);
  private titleOrbitAngle = 0;

  private keysHeld = new Set<string>();
  private touchMoveX = 0;
  private touchMoveZ = 0;
  private touchShootHeld = false;
  private pendingShootRelease = false;
  private pendingPassPress = false;
  private pendingTacklePress = false;

  private lastFrameMs = 0;
  private hudEmitTimer = 0;
  private lastEmittedSeq = -1;
  private lastEmittedPhase = '';
  private lastGoalBurstSeq = -1;
  private frameId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    initialConfig: MatchConfig,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.dataset.testid = 'kickoff-canvas';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const bgHex = 0x0c1722;
    this.scene.background = new THREE.Color(bgHex);
    this.scene.fog = new THREE.FogExp2(bgHex, 0.0075);

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 220);
    this.renderer.setSize(width, height, false);

    // Procedural Studio Environment Map for metallic goalposts & floodlight sheen
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    // Warm floodlight Key Light + Cool Hemisphere Fill
    const hemi = new THREE.HemisphereLight(0xb8e1ff, 0x1a3320, 0.92);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.35);
    keyLight.position.set(20, 38, 22);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.radius = 2.2;
    keyLight.shadow.camera.near = 5;
    keyLight.shadow.camera.far = 115;
    keyLight.shadow.camera.left = -40;
    keyLight.shadow.camera.right = 40;
    keyLight.shadow.camera.top = 30;
    keyLight.shadow.camera.bottom = -30;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.72);
    rimLight.position.set(-22, 18, -24);
    this.scene.add(rimLight);

    this.shadowTex = createContactShadowTexture();
    this.worldGroup = new THREE.Group();
    this.actorsGroup = new THREE.Group();
    this.scene.add(this.worldGroup, this.actorsGroup);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const ballRig = createBallMesh(maxAniso, this.shadowTex, this.isSoftwareGl);
    this.ballGroup = ballRig.ballGroup;
    this.ballSphere = ballRig.ballSphere;
    this.ballShadow = ballRig.ballShadow;
    this.scene.add(this.ballGroup, this.ballShadow);

    // Pooled InstancedMesh particles (turf/mud splashes, sparks, goal confetti)
    const pGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_POOL_SIZE);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 0,
        color: new THREE.Color(0xffffff),
      });
      _dummy.position.set(0, -10, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, this.particles[i].color);
    }
    this.scene.add(this.particleMesh);

    this.gameState = createInitialGameState(initialConfig, 'title');
    this.rebuildWorldAndActors();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.bindInputListeners();
    this.emitHudState(true);
    this.startLoop();
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private bindInputListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    soundService.unlock();
    const code = e.code;

    // Prevent scrolling on arrow keys / space during gameplay
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code) &&
      this.gameState.phase !== 'title'
    ) {
      e.preventDefault();
    }

    if (!this.keysHeld.has(code)) {
      if (code === 'KeyK') this.pendingPassPress = true;
      if (code === 'KeyL') this.pendingTacklePress = true;
      if (code === 'KeyC') this.cycleCameraZoom();
      if (code === 'KeyV') {
        if (this.zoomLevel === 0 || this.zoomLevel === 3 || this.zoomLevel === 4) {
          this.setZoomLevel(1);
        } else if (this.zoomLevel === 1 || this.zoomLevel === 2) {
          this.setZoomLevel(5);
        } else {
          this.setZoomLevel(0);
        }
      }
      if (code === 'KeyP' || code === 'Escape') {
        if (this.gameState.phase === 'playing' || this.gameState.phase === 'kickoff') {
          this.pauseMatch();
        } else if (this.gameState.phase === 'paused') {
          this.resumeMatch();
        }
      }
    }
    this.keysHeld.add(code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const code = e.code;
    if (code === 'Space' || code === 'KeyJ') {
      if (this.keysHeld.has(code)) {
        this.pendingShootRelease = true;
      }
    }
    this.keysHeld.delete(code);
  };

  private onWindowBlur = (): void => {
    this.clearHeldInputs();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.clearHeldInputs();
    }
  };

  public clearHeldInputs(): void {
    this.keysHeld.clear();
    this.touchMoveX = 0;
    this.touchMoveZ = 0;
    this.touchShootHeld = false;
    this.pendingShootRelease = false;
    this.pendingPassPress = false;
    this.pendingTacklePress = false;
  }

  public setTouchJoystick(x: number, z: number): void {
    this.touchMoveX = Math.max(-1, Math.min(1, x));
    this.touchMoveZ = Math.max(-1, Math.min(1, z));
  }

  public setTouchShoot(held: boolean): void {
    soundService.unlock();
    if (this.touchShootHeld && !held) {
      this.pendingShootRelease = true;
    }
    this.touchShootHeld = held;
  }

  public triggerTouchPass(): void {
    soundService.unlock();
    this.pendingPassPress = true;
  }

  public triggerTouchTackle(): void {
    soundService.unlock();
    this.pendingTacklePress = true;
  }

  public cycleCameraZoom(): CameraZoomLevel {
    this.zoomLevel = ((this.zoomLevel + 1) % 7) as CameraZoomLevel;
    this.callbacks.onZoomChange?.(this.zoomLevel);
    return this.zoomLevel;
  }

  public setZoomLevel(level: CameraZoomLevel): void {
    this.zoomLevel = level;
    this.callbacks.onZoomChange?.(this.zoomLevel);
  }

  public getZoomLevel(): CameraZoomLevel {
    return this.zoomLevel;
  }

  public previewConfig(config: MatchConfig): void {
    const wasPlaying = this.gameState.phase !== 'title';
    if (wasPlaying) return;
    this.gameState = createInitialGameState(config, 'title');
    this.rebuildWorldAndActors();
    this.emitHudState(true);
  }

  public startMatch(config: MatchConfig): void {
    soundService.unlock();
    this.clearHeldInputs();
    this.gameState = createInitialGameState(config, 'kickoff');
    this.rebuildWorldAndActors();
    const preset = ZOOM_PRESETS[this.zoomLevel];
    this.camPos.set(preset.offsetX, preset.height, preset.offsetZ);
    this.camLook.set(0, 0, 0);
    soundService.playEvents(this.gameState.pendingSounds);
    this.gameState.pendingSounds = [];
    this.emitHudState(true);
  }

  public continueSecondHalf(): void {
    soundService.unlock();
    this.clearHeldInputs();
    startSecondHalf(this.gameState);
    soundService.playEvents(this.gameState.pendingSounds);
    this.gameState.pendingSounds = [];
    this.emitHudState(true);
  }

  public pauseMatch(): void {
    if (this.gameState.phase === 'playing' || this.gameState.phase === 'kickoff') {
      this.clearHeldInputs();
      this.gameState.phase = 'paused';
      this.emitHudState(true);
    }
  }

  public resumeMatch(): void {
    if (this.gameState.phase === 'paused') {
      this.clearHeldInputs();
      this.gameState.phase = 'playing';
      this.lastFrameMs = performance.now();
      this.emitHudState(true);
    }
  }

  public returnToTitle(config: MatchConfig): void {
    this.clearHeldInputs();
    this.gameState = createInitialGameState(config, 'title');
    this.rebuildWorldAndActors();
    this.emitHudState(true);
  }

  public getSerializableState(): GameState {
    return serializeGameState(this.gameState);
  }

  private rebuildWorldAndActors(): void {
    // Clear existing world geometry & actor rigs cleanly
    this.disposeGroupChildren(this.worldGroup);
    this.disposeGroupChildren(this.actorsGroup);
    this.playerRigs.clear();
    this.refereeRig = null;

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const pitchGroup = buildPitchAndMarkings(
      this.gameState.config.mode,
      this.gameState.config.surface,
      this.gameState.mudPatches,
      maxAniso,
      this.isSoftwareGl
    );
    this.worldGroup.add(pitchGroup);

    const homePreset =
      TEAM_PRESETS.find((t) => t.id === this.gameState.config.homeTeamId) ?? TEAM_PRESETS[0];
    const awayPreset =
      TEAM_PRESETS.find((t) => t.id === this.gameState.config.awayTeamId) ?? TEAM_PRESETS[1];

    for (let idx = 0; idx < this.gameState.players.length; idx++) {
      const p = this.gameState.players[idx];
      const preset = p.team === 'home' ? homePreset : awayPreset;
      const rig = createCompositePlayerRig(
        preset,
        p.role === 'GK',
        this.shadowTex,
        this.isSoftwareGl,
        p.number,
        idx
      );
      this.playerRigs.set(p.id, rig);
      this.actorsGroup.add(rig.group);
    }

    if (this.gameState.referee) {
      this.refereeRig = createRefereeRig(this.shadowTex, this.isSoftwareGl);
      this.actorsGroup.add(this.refereeRig.group);
    }
  }

  private disposeMaterialTextures(mat: THREE.Material): void {
    const std = mat as THREE.MeshStandardMaterial;
    const maps = [std.map, std.normalMap, std.roughnessMap, std.emissiveMap];
    for (const tex of maps) {
      if (tex && !tex.userData?.cached && tex !== this.shadowTex) {
        tex.dispose();
      }
    }
  }

  private disposeGroupChildren(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              this.disposeMaterialTextures(m);
              m.dispose();
            });
          } else if (obj.material) {
            this.disposeMaterialTextures(obj.material);
            obj.material.dispose();
          }
        }
      });
    }
  }

  private readPlayerInput(): PlayerInputState {
    const input = createEmptyInput();
    let mx = this.touchMoveX;
    let mz = this.touchMoveZ;

    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) mx -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) mx += 1;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) mz -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) mz += 1;

    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }

    if (ZOOM_PRESETS[this.zoomLevel].vertical) {
      // Rotated 90deg top-down: screen UP (-mz) -> +X (toward away goal), screen RIGHT (+mx) -> +Z
      input.moveX = -mz;
      input.moveZ = mx;
    } else {
      input.moveX = mx;
      input.moveZ = mz;
    }
    input.shootHeld =
      this.touchShootHeld || this.keysHeld.has('Space') || this.keysHeld.has('KeyJ');
    input.shootJustReleased = this.pendingShootRelease;
    input.passJustPressed = this.pendingPassPress;
    input.tackleJustPressed = this.pendingTacklePress;

    this.pendingShootRelease = false;
    this.pendingPassPress = false;
    this.pendingTacklePress = false;
    return input;
  }

  private spawnParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    hexColor: number,
    speed: number,
    upBias = 3.5
  ): void {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.4 + Math.random() * 0.8) * speed;
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = upBias * (0.5 + Math.random() * 0.8);
      slot.vz = Math.sin(angle) * spd;
      slot.life = 0;
      slot.maxLife = 0.45 + Math.random() * 0.45;
      slot.scale = 0.7 + Math.random() * 0.8;
      slot.color.setHex(hexColor);
    }
  }

  private updateParticles(dt: number): void {
    let dirty = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummy.position.set(0, -10, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.vy -= 14.0 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const fade = 1 - p.life / p.maxLife;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 6, p.life * 4, 0);
      _dummy.scale.setScalar(p.scale * fade);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    if (dirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private syncVisualMeshes(dt: number): void {
    const state = this.gameState;
    const ball = state.ball;

    // Ball position, spin & grounded shadow
    this.ballGroup.position.set(ball.x, ball.y, ball.z);
    const speed = Math.hypot(ball.vx, ball.vz);
    if (speed > 0.05) {
      this.ballSphere.rotation.z -= ball.vx * dt * 2.4;
      this.ballSphere.rotation.x += ball.vz * dt * 2.4;
      this.ballSphere.rotation.y += ball.spinZ * dt;
    }
    this.ballShadow.position.set(ball.x, 0.024, ball.z);
    const shadowScale = Math.max(0.45, 1 - ball.y * 0.14);
    this.ballShadow.scale.setScalar(shadowScale);

    // Players
    for (const p of state.players) {
      const rig = this.playerRigs.get(p.id);
      if (!rig) continue;

      const available = isPlayerAvailable(p);
      rig.group.visible = available;
      if (!available) continue;

      rig.group.position.set(p.x, 0, p.z);
      const yaw = Math.atan2(p.facingX, p.facingZ);
      rig.bodyGroup.rotation.y = yaw;

      // Active player ring & shot charge ring
      const isActive = p.id === state.activeHomePlayerId && state.phase !== 'title';
      rig.activeRing.visible = isActive;
      if (isActive) {
        rig.activeRing.rotation.y = yaw;
      }
      rig.chargeRing.visible = isActive && state.isChargingShot;
      if (rig.chargeRing.visible) {
        const s = 0.85 + state.shotCharge * 0.55;
        rig.chargeRing.scale.setScalar(s);
        const mat = rig.chargeRing.material as THREE.MeshBasicMaterial;
        mat.color.setHSL((1 - state.shotCharge) * 0.14, 0.95, 0.55);
      }

      // Card badge above head
      rig.cardBadge.visible = p.card !== 'none';
      if (rig.cardBadge.visible) {
        (rig.cardBadge.material as THREE.MeshBasicMaterial).color.set(
          p.card === 'yellow' ? '#facc15' : '#ef4444'
        );
      }

      // Animation poses: stun, dive, slide tackle, kick, or running gait
      if (p.stunTimer > 0) {
        rig.bodyGroup.rotation.x = -Math.PI * 0.42;
        rig.bodyGroup.position.y = 0.25;
      } else if (p.diveTimer > 0) {
        rig.bodyGroup.rotation.z = p.diveDirZ * 1.15;
        rig.bodyGroup.position.y = 0.35;
      } else if (p.slideTimer > 0) {
        rig.bodyGroup.rotation.x = -0.85;
        rig.bodyGroup.position.y = 0.18;
        rig.leftLegPivot.rotation.x = -0.7;
        rig.rightLegPivot.rotation.x = 0.35;
        if (Math.random() < 0.45) {
          const muddy = isPointInMud(state, p.x, p.z);
          this.spawnParticles(p.x, 0.12, p.z, 2, muddy ? 0x5c3a21 : 0x4ade80, 2.5, 2.2);
        }
      } else {
        rig.bodyGroup.rotation.x = 0;
        rig.bodyGroup.rotation.z = 0;
        rig.bodyGroup.position.y = 0;

        const pSpeed = Math.hypot(p.vx, p.vz);
        const swing = pSpeed > 0.4 ? Math.sin(p.gaitPhase) * 0.65 : 0;
        if (p.kickAnimTimer > 0) {
          rig.rightLegPivot.rotation.x = -1.15 * (p.kickAnimTimer / 0.26);
          rig.leftLegPivot.rotation.x = 0.25;
        } else {
          rig.leftLegPivot.rotation.x = swing;
          rig.rightLegPivot.rotation.x = -swing;
        }
        rig.leftArmPivot.rotation.x = -swing * 0.8;
        rig.rightArmPivot.rotation.x = swing * 0.8;
        rig.torso.rotation.x = Math.min(0.24, pSpeed * 0.025);
      }
    }

    // Referee
    if (this.refereeRig && state.referee) {
      const r = state.referee;
      this.refereeRig.group.position.set(r.x, 0, r.z);
      this.refereeRig.bodyGroup.rotation.y = Math.atan2(r.facingX, r.facingZ);
      const rSpeed = Math.hypot(r.vx, r.vz);
      const swing = rSpeed > 0.3 ? Math.sin(r.gaitPhase) * 0.55 : 0;
      this.refereeRig.leftLegPivot.rotation.x = swing;
      this.refereeRig.rightLegPivot.rotation.x = -swing;

      if (r.cardAnimTimer > 0 && r.shownCard !== 'none') {
        this.refereeRig.rightArmPivot.rotation.x = -Math.PI * 0.88;
        this.refereeRig.cardMesh.visible = true;
        (this.refereeRig.cardMesh.material as THREE.MeshBasicMaterial).color.set(
          r.shownCard === 'yellow' ? '#facc15' : '#ef4444'
        );
      } else {
        this.refereeRig.rightArmPivot.rotation.x = 0;
        this.refereeRig.cardMesh.visible = false;
      }
    }

    // Spawn goal confetti burst once per goal
    if (state.phase === 'goal' && this.lastGoalBurstSeq !== state.homeScore + state.awayScore) {
      this.lastGoalBurstSeq = state.homeScore + state.awayScore;
      this.spawnParticles(ball.x, 1.5, ball.z, 36, 0xfacc15, 7.5, 6.5);
      this.spawnParticles(ball.x, 1.5, ball.z, 24, 0x38bdf8, 6.5, 7.0);
    }
  }

  private updateCamera(dt: number): void {
    const state = this.gameState;
    const dims = PITCH_DIMENSIONS[state.config.mode];

    if (state.phase === 'title') {
      // Live World Camera Tour / Flyover around stadium (matches angled vs horizontal/vertical top-down choice)
      this.titleOrbitAngle += dt * 0.18;
      const preset = ZOOM_PRESETS[this.zoomLevel];
      if (preset.vertical) {
        const swayZ = Math.sin(this.titleOrbitAngle) * 4.0;
        const swayX = Math.cos(this.titleOrbitAngle) * 2.5 - 2.0;
        _camDesired.set(swayX, state.config.mode === 'arena5v5' ? 26.5 : 35.5, swayZ);
        _camTarget.set(0, 0, swayZ * 0.35);
      } else if (this.zoomLevel === 1 || this.zoomLevel === 2) {
        const swayX = Math.sin(this.titleOrbitAngle) * 5.0;
        const swayZ = Math.cos(this.titleOrbitAngle) * 2.5 + 2.0;
        _camDesired.set(swayX, state.config.mode === 'arena5v5' ? 25.5 : 34.0, swayZ);
        _camTarget.set(swayX * 0.4, 0, 0);
      } else {
        const radius = state.config.mode === 'arena5v5' ? 24 : 36;
        const camX = Math.sin(this.titleOrbitAngle) * radius * 0.72;
        const camZ = Math.cos(this.titleOrbitAngle) * radius * 0.65;
        _camDesired.set(camX, state.config.mode === 'arena5v5' ? 15.5 : 21.5, camZ);
        _camTarget.set(0, 0.5, 0);
      }

      this.camPos.lerp(_camDesired, 1 - Math.exp(-3.0 * dt));
      this.camLook.lerp(_camTarget, 1 - Math.exp(-3.5 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      return;
    }

    const preset = ZOOM_PRESETS[this.zoomLevel];
    if (Math.abs(this.camera.fov - preset.fov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, preset.fov, 6, dt);
      this.camera.updateProjectionMatrix();
    }

    // Ball-following bird's-eye camera with velocity look-ahead
    const lookAheadX = THREE.MathUtils.clamp(state.ball.vx * 0.28, -5.5, 5.5);
    const lookAheadZ = THREE.MathUtils.clamp(state.ball.vz * 0.22, -4.0, 4.0);

    const targetX = THREE.MathUtils.clamp(
      state.ball.x + lookAheadX,
      -dims.length * 0.45,
      dims.length * 0.45
    );
    const targetZ = THREE.MathUtils.clamp(
      state.ball.z + lookAheadZ,
      -dims.width * 0.44,
      dims.width * 0.44
    );

    _camTarget.set(targetX, 0.4, targetZ);
    _camDesired.set(targetX + preset.offsetX, preset.height, targetZ + preset.offsetZ);

    const dampFactor = 1 - Math.exp(-6.5 * dt);
    this.camPos.lerp(_camDesired, dampFactor);
    this.camLook.lerp(_camTarget, dampFactor);

    // Trauma shake on woodwork / goal
    const shake = state.cameraTrauma * state.cameraTrauma * 0.45;
    const shakeX = shake > 0.005 ? (Math.random() * 2 - 1) * shake : 0;
    const shakeY = shake > 0.005 ? (Math.random() * 2 - 1) * shake : 0;

    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  private emitHudState(force = false): void {
    const state = this.gameState;
    const urgent =
      force ||
      state.phase !== this.lastEmittedPhase ||
      state.eventSeq !== this.lastEmittedSeq;

    if (!urgent && this.hudEmitTimer < 0.075) return;

    this.hudEmitTimer = 0;
    this.lastEmittedPhase = state.phase;
    this.lastEmittedSeq = state.eventSeq;
    this.callbacks.onStateUpdate(serializeGameState(state));
  }

  private startLoop(): void {
    this.lastFrameMs = performance.now();
    const tick = () => {
      if (this.disposed) return;
      const nowMs = performance.now();
      const rawDt = Math.max(0.001, (nowMs - this.lastFrameMs) / 1000);
      this.lastFrameMs = nowMs;
      const dt = Math.min(rawDt, 0.05);

      const input = this.readPlayerInput();
      stepSimulation(this.gameState, input, dt);

      if (this.gameState.pendingSounds.length > 0) {
        for (const ev of this.gameState.pendingSounds) {
          if (ev.type === 'kick') {
            const muddy = isPointInMud(this.gameState, this.gameState.ball.x, this.gameState.ball.z);
            this.spawnParticles(
              this.gameState.ball.x,
              0.2,
              this.gameState.ball.z,
              8,
              muddy ? 0x5c3a21 : 0x86efac,
              3.5,
              3.0
            );
          } else if (ev.type === 'post') {
            this.spawnParticles(
              this.gameState.ball.x,
              this.gameState.ball.y,
              this.gameState.ball.z,
              12,
              0xfef08a,
              4.5,
              3.2
            );
          }
        }
        soundService.playEvents(this.gameState.pendingSounds);
        this.gameState.pendingSounds = [];
      }

      this.syncVisualMeshes(dt);
      this.updateParticles(dt);
      this.updateCamera(dt);

      this.hudEmitTimer += dt;
      this.emitHudState(false);

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.resizeObserver.disconnect();

    this.disposeGroupChildren(this.worldGroup);
    this.disposeGroupChildren(this.actorsGroup);
    this.ballSphere.geometry.dispose();
    (this.ballSphere.material as THREE.Material).dispose();
    this.ballShadow.geometry.dispose();
    (this.ballShadow.material as THREE.Material).dispose();
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.shadowTex.dispose();
    this.envRT?.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
