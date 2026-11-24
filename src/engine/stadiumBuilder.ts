import * as THREE from 'three';
import { BALL_RADIUS, PITCH_DIMENSIONS, PLAYER_RADIUS } from '../constants';
import type { GameMode, MudPatchState, PitchSurface, TeamPreset } from '../types';

export interface PlayerRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  torso: THREE.Mesh;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  head: THREE.Mesh;
  activeRing: THREE.Mesh;
  chargeRing: THREE.Mesh;
  cardBadge: THREE.Mesh;
  shadowDisc: THREE.Mesh;
}

export interface RefereeRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  cardMesh: THREE.Mesh;
}

const SKIN_TONES = ['#f3cbb0', '#e6b494', '#d49a73', '#b87a52', '#8f5938'];
const HAIR_COLORS = ['#18181b', '#2c1e16', '#4a3120', '#7c5329', '#b88b4a'];

function seededRand(seed: number): () => number {
  let s = (seed % 2147483647) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createTurfTexture(
  mode: GameMode,
  surface: PitchSurface,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(mode === 'arena5v5' ? 505 : 1111);

  const stripeCount = mode === 'arena5v5' ? 10 : 18;
  const stripeW = canvas.width / stripeCount;

  const baseA = surface === 'mud' ? '#2c4c23' : '#2f8236';
  const baseB = surface === 'mud' ? '#24401c' : '#256c2c';
  const highlightA = surface === 'mud' ? '#355829' : '#3a9440';
  const shadowB = surface === 'mud' ? '#1e3617' : '#1e5b24';

  // Mowing stripes with subtle horizontal & vertical weave
  for (let i = 0; i < stripeCount; i++) {
    const x0 = i * stripeW;
    const g = ctx.createLinearGradient(x0, 0, x0 + stripeW, 0);
    if (i % 2 === 0) {
      g.addColorStop(0, baseA);
      g.addColorStop(0.5, highlightA);
      g.addColorStop(1, baseA);
    } else {
      g.addColorStop(0, baseB);
      g.addColorStop(0.5, shadowB);
      g.addColorStop(1, baseB);
    }
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, stripeW + 1, canvas.height);
  }

  // Subtle cross-cut mowing bands for stadium pitch depth
  const crossBands = mode === 'arena5v5' ? 6 : 10;
  const bandH = canvas.height / crossBands;
  for (let r = 0; r < crossBands; r++) {
    ctx.fillStyle = r % 2 === 0 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.025)';
    ctx.fillRect(0, r * bandH, canvas.width, bandH);
  }

  // High-definition grass blade micro-texture (40,000 crisp directional blades)
  for (let i = 0; i < 40000; i++) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    const len = 2 + rand() * 5;
    const bright = rand();
    if (bright > 0.62) {
      ctx.fillStyle = surface === 'mud' ? 'rgba(130, 165, 85, 0.08)' : 'rgba(134, 239, 172, 0.09)';
    } else if (bright > 0.28) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.085)';
    } else {
      ctx.fillStyle = 'rgba(16, 48, 18, 0.11)';
    }
    ctx.fillRect(x, y, 1.3, len);
  }

  // Natural turf wear in goalmouths, penalty spots & center circle
  const addWear = (cx: number, cy: number, rx: number, ry: number, alpha: number) => {
    const wg = ctx.createRadialGradient(cx, cy, rx * 0.1, cx, cy, rx);
    wg.addColorStop(0, `rgba(92, 68, 36, ${alpha})`);
    wg.addColorStop(0.55, `rgba(74, 58, 32, ${alpha * 0.45})`);
    wg.addColorStop(1, 'rgba(74, 58, 32, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const wearAlpha = surface === 'mud' ? 0.42 : 0.15;
  addWear(canvas.width * 0.045, canvas.height * 0.5, 95, 130, wearAlpha);
  addWear(canvas.width * 0.955, canvas.height * 0.5, 95, 130, wearAlpha);
  addWear(canvas.width * 0.5, canvas.height * 0.5, 70, 70, wearAlpha * 0.65);

  if (surface === 'mud') {
    for (let i = 0; i < 1400; i++) {
      const x = rand() * canvas.width;
      const y = rand() * canvas.height;
      const w = 2 + rand() * 8;
      const h = 1.5 + rand() * 5;
      ctx.fillStyle = rand() > 0.45 ? 'rgba(62, 39, 19, 0.14)' : 'rgba(36, 23, 11, 0.12)';
      ctx.fillRect(x, y, w, h);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createTurfNormalAndRoughness(
  mode: GameMode,
  surface: PitchSurface,
  maxAnisotropy: number
): { normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  // Normal map (linear space) for subtle grass blade surface grain
  const nSize = 512;
  const nCanvas = document.createElement('canvas');
  nCanvas.width = nSize;
  nCanvas.height = nSize;
  const nCtx = nCanvas.getContext('2d')!;
  const imgData = nCtx.createImageData(nSize, nSize);
  const data = imgData.data;
  const rand = seededRand(7741);

  for (let i = 0; i < nSize * nSize; i++) {
    const idx = i * 4;
    const gx = (rand() - 0.5) * 34;
    const gy = (rand() - 0.5) * 34;
    data[idx] = Math.max(0, Math.min(255, 128 + gx));
    data[idx + 1] = Math.max(0, Math.min(255, 128 + gy));
    data[idx + 2] = 245;
    data[idx + 3] = 255;
  }
  nCtx.putImageData(imgData, 0, 0);

  const normalMap = new THREE.CanvasTexture(nCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(mode === 'arena5v5' ? 14 : 24, mode === 'arena5v5' ? 9 : 15);
  normalMap.anisotropy = maxAnisotropy;

  // Roughness map (linear space) matching mowing stripes so stripes catch floodlights authentically
  const rCanvas = document.createElement('canvas');
  rCanvas.width = 512;
  rCanvas.height = 256;
  const rCtx = rCanvas.getContext('2d')!;
  const stripeCount = mode === 'arena5v5' ? 10 : 18;
  const sw = rCanvas.width / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    const v = surface === 'mud' ? (i % 2 === 0 ? 130 : 155) : i % 2 === 0 ? 195 : 225;
    rCtx.fillStyle = `rgb(${v},${v},${v})`;
    rCtx.fillRect(i * sw, 0, sw + 1, rCanvas.height);
  }
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.anisotropy = maxAnisotropy;

  return { normalMap, roughnessMap };
}

export function createSoccerBallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Classic spherical-projected black pentagon panel centers
  const drawPentagon = (cx: number, cy: number, rx: number, ry: number, rot = 0) => {
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = rot + (k * Math.PI * 2) / 5 - Math.PI / 2;
      const px = cx + Math.cos(a) * rx;
      const py = cy + Math.sin(a) * ry;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#334155';
    ctx.stroke();

    // Seam lines radiating from vertices
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      const a = rot + (k * Math.PI * 2) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      ctx.lineTo(cx + Math.cos(a) * rx * 1.75, cy + Math.sin(a) * ry * 1.75);
      ctx.stroke();
    }
  };

  // Poles
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, 32);
  ctx.fillRect(0, canvas.height - 32, canvas.width, 32);

  // Upper & lower pentagon rings (compensated for equirectangular stretch)
  for (let i = 0; i < 5; i++) {
    const xTop = ((i + 0.25) / 5) * canvas.width;
    drawPentagon(xTop, 140, 44, 38, 0);
    drawPentagon(xTop + canvas.width, 140, 44, 38, 0);
    drawPentagon(xTop - canvas.width, 140, 44, 38, 0);

    const xBot = ((i + 0.75) / 5) * canvas.width;
    drawPentagon(xBot, canvas.height - 140, 44, 38, Math.PI);
    drawPentagon(xBot + canvas.width, canvas.height - 140, 44, 38, Math.PI);
    drawPentagon(xBot - canvas.width, canvas.height - 140, 44, 38, Math.PI);
  }

  // Subtle retro gold/emerald trim dots on equator panels
  for (let i = 0; i < 5; i++) {
    const x = ((i + 0.5) / 5) * canvas.width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
    ctx.beginPath();
    ctx.arc(x, canvas.height * 0.5, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createMudPatchTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(8821);

  // Soft irregular layered earth base
  for (let i = 0; i < 18; i++) {
    const ox = 256 + (rand() - 0.5) * 95;
    const oy = 256 + (rand() - 0.5) * 95;
    const r = 90 + rand() * 90;
    const g = ctx.createRadialGradient(ox, oy, 8, ox, oy, r);
    g.addColorStop(0, 'rgba(54, 33, 16, 0.55)');
    g.addColorStop(0.55, 'rgba(72, 46, 24, 0.35)');
    g.addColorStop(1, 'rgba(54, 33, 16, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine organic soil speckles & churned grass tufts
  for (let i = 0; i < 900; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.pow(rand(), 0.7) * 205;
    const x = 256 + Math.cos(a) * d;
    const y = 256 + Math.sin(a) * d;
    const sz = 1.5 + rand() * 5;
    ctx.fillStyle =
      rand() > 0.35
        ? 'rgba(32, 18, 8, 0.22)'
        : d > 130
          ? 'rgba(58, 92, 34, 0.25)'
          : 'rgba(92, 62, 34, 0.2)';
    ctx.fillRect(x, y, sz, sz * (0.6 + rand() * 0.8));
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
  g.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGoalNetTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(241, 245, 249, 0.92)';
  ctx.lineWidth = 5;
  const step = 32;
  for (let i = 0; i <= 256; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  // Subtle knot dots at intersections
  ctx.fillStyle = '#ffffff';
  for (let x = 0; x <= 256; x += step) {
    for (let y = 0; y <= 256; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createAdBoardTexture(mode: GameMode, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const panels =
    mode === 'arena5v5'
      ? [
          { bg: '#091914', accent: '#10b981', text: 'KICK OFF 3D · BRZA ARENA' },
          { bg: '#111827', accent: '#f59e0b', text: 'AFTERTOUCH PRO 350MS' },
          { bg: '#0c1b2e', accent: '#38bdf8', text: 'RETRO FUDBAL 5 NA 5' },
          { bg: '#191015', accent: '#ef4444', text: 'BEZ OFSAJDA · ČIST SPRINT' },
        ]
      : [
          { bg: '#091914', accent: '#10b981', text: 'KICK OFF 3D · AMIGA KLASIK' },
          { bg: '#111827', accent: '#facc15', text: 'PRVA LIGA STADION' },
          { bg: '#0c1b2e', accent: '#38bdf8', text: 'MAGNUS EFE & LOB ŠUT' },
          { bg: '#1a140b', accent: '#fb923c', text: 'FER-PLEJ & POŠTUJ SUDIJU' },
        ];

  const pw = canvas.width / panels.length;
  panels.forEach((p, idx) => {
    const x = idx * pw;
    ctx.fillStyle = p.bg;
    ctx.fillRect(x, 0, pw, canvas.height);

    // Top & bottom glowing LED bars
    ctx.fillStyle = p.accent;
    ctx.fillRect(x + 4, 8, pw - 8, 8);
    ctx.fillRect(x + 4, canvas.height - 16, pw - 8, 8);

    // Subtle divider
    ctx.fillStyle = '#020617';
    ctx.fillRect(x, 0, 4, canvas.height);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, x + pw * 0.5, canvas.height * 0.52);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createApronTrackTexture(surface: PitchSurface, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(3301);

  ctx.fillStyle = surface === 'mud' ? '#1c2b1e' : '#1b3f24';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(rand() * 512, rand() * 512, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

const jerseyTexCache = new Map<string, THREE.CanvasTexture>();

function getJerseyTexture(
  teamPreset: TeamPreset,
  isGoalie: boolean,
  playerNumber: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const key = `${teamPreset.id}_${isGoalie ? 'gk' : 'pl'}_${playerNumber}`;
  const cached = jerseyTexCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const primary = isGoalie ? teamPreset.gkColor : teamPreset.primaryColor;
  const secondary = isGoalie ? '#0f172a' : teamPreset.secondaryColor;
  const accent = teamPreset.accentColor;

  // Base jersey color
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle vertical ribbed athletic fabric weave
  for (let x = 0; x < 256; x += 6) {
    ctx.fillStyle = x % 12 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(x, 0, 3, 256);
  }

  // Distinct team kit pattern on front & back (Cylinder UV wraps horizontally around body)
  // Front sits around u=0.5 (x=128) or u=0/1 depending on facing; draw symmetrical chest & back panels!
  // Let's draw a classic bold sash/band + shoulder stripes + crest + crisp number on BOTH front & back faces
  ctx.fillStyle = secondary;
  ctx.fillRect(0, 74, 256, 36); // chest/back band
  ctx.fillStyle = accent;
  ctx.fillRect(0, 70, 256, 5);
  ctx.fillRect(0, 109, 256, 5);

  // Collar trim at top
  ctx.fillStyle = secondary;
  ctx.fillRect(0, 0, 256, 22);

  // Upper-back crisp jersey number (placed higher at y=132 so it reads clearly from bird's-eye angle)
  const numStr = String(playerNumber);
  ctx.save();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 8;
  ctx.font = '900 84px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(numStr, 128, 146);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(numStr, 128, 146);
  ctx.restore();

  // Small chest crest & number at u=0 / u=1 (+Z chest)
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(22, 92, 10, 0, Math.PI * 2);
  ctx.arc(234, 92, 10, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.userData = { cached: true };
  jerseyTexCache.set(key, tex);
  return tex;
}

function createFaceTexture(skinHex: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = skinHex;
  ctx.fillRect(0, 0, 256, 128);

  // Subtle warm cheek/jaw shading
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.06)');
  g.addColorStop(0.65, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);

  // In Three.js SphereGeometry with default phiStart=0, u=0.25 faces +X and u=0.75 faces -X?
  // Actually for SphereGeometry: x = -r * cos(phi)*sin(theta), z = r * sin(phi)*sin(theta).
  // At u=0.25 (phi=PI/2): z = +r (+Z forward!). Let's draw face centered at u=0.25 -> x=64!
  const fx = 64;
  const browColor = HAIR_COLORS[seed % HAIR_COLORS.length];

  // Eyebrows
  ctx.fillStyle = browColor;
  ctx.fillRect(fx - 20, 50, 13, 4);
  ctx.fillRect(fx + 7, 50, 13, 4);

  // Eyes (sclera + iris)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(fx - 13, 59, 6, 4.5, 0, 0, Math.PI * 2);
  ctx.ellipse(fx + 13, 59, 6, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(fx - 13, 59, 3.2, 0, Math.PI * 2);
  ctx.arc(fx + 13, 59, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Subtle mouth / determination line
  ctx.strokeStyle = 'rgba(120, 60, 40, 0.65)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(fx - 8, 84);
  ctx.quadraticCurveTo(fx, 86, fx + 8, 84);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildPitchAndMarkings(
  mode: GameMode,
  surface: PitchSurface,
  mudPatches: MudPatchState[],
  maxAnisotropy: number,
  isSoftwareGl: boolean
): THREE.Group {
  const root = new THREE.Group();
  const dims = PITCH_DIMENSIONS[mode];
  const halfL = dims.length * 0.5;
  const halfW = dims.width * 0.5;

  // Extended stadium apron grass/track (no floating slab in empty void)
  const apronTex = createApronTrackTexture(surface, maxAnisotropy);
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: apronTex,
    roughness: 0.9,
    metalness: 0.02,
  });
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.length + 85, dims.width + 85),
    apronMat
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.025;
  apron.receiveShadow = !isSoftwareGl;
  root.add(apron);

  // Subtle dark athletic track / tarmac border around playable pitch (for 11v11 stadium realism)
  if (mode === 'classic11v11') {
    const trackMat = new THREE.MeshStandardMaterial({
      color: surface === 'mud' ? '#2c221d' : '#1e293b',
      roughness: 0.85,
      metalness: 0.05,
    });
    const track = new THREE.Mesh(
      new THREE.PlaneGeometry(dims.length + 10.5, dims.width + 9.5),
      trackMat
    );
    track.rotation.x = -Math.PI / 2;
    track.position.y = -0.012;
    track.receiveShadow = !isSoftwareGl;
    root.add(track);
  }

  // Main playable pitch surface with high-res grass albedo + normal + mowing-stripe roughness
  const turfTex = createTurfTexture(mode, surface, maxAnisotropy);
  const { normalMap, roughnessMap } = createTurfNormalAndRoughness(mode, surface, maxAnisotropy);
  const turfMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: turfTex,
    normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap,
    roughness: surface === 'mud' ? 0.62 : 0.92,
    metalness: 0.02,
  });
  const pitchMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.length + 3.4, dims.width + 3.4),
    turfMat
  );
  pitchMesh.rotation.x = -Math.PI / 2;
  pitchMesh.position.y = 0;
  pitchMesh.receiveShadow = !isSoftwareGl;
  root.add(pitchMesh);

  // Mud patches (when surface === 'mud')
  if (mudPatches.length > 0) {
    const mudTex = createMudPatchTexture();
    const mudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: mudTex,
      transparent: true,
      roughness: 0.22,
      metalness: 0.12,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    for (const patch of mudPatches) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(patch.radius, 28), mudMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(patch.x, 0.012, patch.z);
      root.add(m);
    }
  }

  // Crisp chalk pitch lines (elevated + polygonOffset to prevent Z-fighting)
  const lineMat = new THREE.MeshBasicMaterial({
    color: '#f8fafc',
    transparent: true,
    opacity: surface === 'mud' ? 0.78 : 0.94,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const addLineRect = (x: number, z: number, w: number, h: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.018, z);
    root.add(m);
  };

  const lt = 0.16;
  // Touchlines & Goal lines
  addLineRect(0, -halfW, dims.length + lt, lt);
  addLineRect(0, halfW, dims.length + lt, lt);
  addLineRect(-halfL, 0, lt, dims.width + lt);
  addLineRect(halfL, 0, lt, dims.width + lt);
  // Halfway line
  addLineRect(0, 0, lt, dims.width);

  // Center circle & center spot
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(dims.centerCircleRadius - lt * 0.5, dims.centerCircleRadius + lt * 0.5, 64),
    lineMat
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.019, 0);
  root.add(ring);

  const centerSpot = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), lineMat);
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.set(0, 0.02, 0);
  root.add(centerSpot);

  // Penalty boxes, 6-yard goal area boxes, penalty spots, penalty arcs & corner arcs
  const boxW = dims.penaltyBoxWidth;
  const boxD = dims.penaltyBoxDepth;
  const sixW = dims.goalWidth + (mode === 'arena5v5' ? 2.2 : 4.2);
  const sixD = mode === 'arena5v5' ? 2.6 : 4.2;
  const penDist = mode === 'arena5v5' ? 4.8 : 7.8;

  for (const sign of [-1, 1]) {
    const gx = sign * halfL;
    const innerX = gx - sign * boxD;
    // 18-yard penalty box
    addLineRect((gx + innerX) * 0.5, -boxW * 0.5, boxD, lt);
    addLineRect((gx + innerX) * 0.5, boxW * 0.5, boxD, lt);
    addLineRect(innerX, 0, lt, boxW + lt);

    // 6-yard goal area box (peterac)
    const sixInnerX = gx - sign * sixD;
    addLineRect((gx + sixInnerX) * 0.5, -sixW * 0.5, sixD, lt * 0.9);
    addLineRect((gx + sixInnerX) * 0.5, sixW * 0.5, sixD, lt * 0.9);
    addLineRect(sixInnerX, 0, lt * 0.9, sixW + lt);

    // Penalty spot (11m tačka)
    const penSpot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), lineMat);
    penSpot.rotation.x = -Math.PI / 2;
    penSpot.position.set(gx - sign * penDist, 0.02, 0);
    root.add(penSpot);

    // Penalty arc (polukrug šesnaesterca)
    const arcR = dims.centerCircleRadius * 0.85;
    const dx = boxD - penDist;
    if (arcR > Math.abs(dx)) {
      const halfAngle = Math.acos(dx / arcR);
      const startAngle = sign === -1 ? -halfAngle : Math.PI - halfAngle;
      const arc = new THREE.Mesh(
        new THREE.RingGeometry(arcR - lt * 0.5, arcR + lt * 0.5, 28, 1, startAngle, halfAngle * 2),
        lineMat
      );
      arc.rotation.x = -Math.PI / 2;
      arc.position.set(gx - sign * penDist, 0.019, 0);
      root.add(arc);
    }
  }

  // Corner arcs & 3D Corner Flags
  const cornerArcR = mode === 'arena5v5' ? 0.9 : 1.2;
  const flagPoleMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.35,
    metalness: 0.3,
  });
  const flagClothMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    roughness: 0.6,
    side: THREE.DoubleSide,
  });

  const corners: Array<{ x: number; z: number; startAngle: number }> = [
    { x: -halfL, z: -halfW, startAngle: -Math.PI / 2 },
    { x: -halfL, z: halfW, startAngle: 0 },
    { x: halfL, z: -halfW, startAngle: Math.PI },
    { x: halfL, z: halfW, startAngle: Math.PI / 2 },
  ];

  for (const c of corners) {
    const cArc = new THREE.Mesh(
      new THREE.RingGeometry(cornerArcR - lt * 0.45, cornerArcR + lt * 0.45, 16, 1, c.startAngle, Math.PI / 2),
      lineMat
    );
    cArc.rotation.x = -Math.PI / 2;
    cArc.position.set(c.x, 0.019, c.z);
    root.add(cArc);

    if (mode === 'classic11v11') {
      const flagGroup = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 1.35, 8), flagPoleMat);
      pole.position.y = 0.675;
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), flagClothMat);
      finial.position.y = 1.37;
      const pennantShape = new THREE.Shape();
      pennantShape.moveTo(0, 0);
      pennantShape.lineTo(0.42, -0.11);
      pennantShape.lineTo(0, -0.24);
      pennantShape.closePath();
      const pennant = new THREE.Mesh(new THREE.ShapeGeometry(pennantShape), flagClothMat);
      pennant.position.set(0.02, 1.33, 0);
      flagGroup.add(pole, finial, pennant);
      flagGroup.position.set(c.x, 0, c.z);
      root.add(flagGroup);
    }
  }

  // Goals with 3D sculpted posts, crossbar, angled support stanchions, and crisp square-grid net
  const postMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.22,
    metalness: 0.78,
  });
  const netTex = createGoalNetTexture(maxAnisotropy);
  const netMatBack = new THREE.MeshStandardMaterial({
    color: '#f1f5f9',
    map: netTex.clone(),
    transparent: true,
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    roughness: 0.85,
  });
  (netMatBack.map as THREE.CanvasTexture).repeat.set(Math.round(dims.goalWidth * 2.2), Math.round(dims.goalHeight * 2.2));
  (netMatBack.map as THREE.CanvasTexture).needsUpdate = true;

  const netMatSide = new THREE.MeshStandardMaterial({
    color: '#f1f5f9',
    map: netTex.clone(),
    transparent: true,
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    roughness: 0.85,
  });
  (netMatSide.map as THREE.CanvasTexture).repeat.set(Math.round(dims.goalDepth * 2.2), Math.round(dims.goalHeight * 2.2));
  (netMatSide.map as THREE.CanvasTexture).needsUpdate = true;

  const netMatRoof = new THREE.MeshStandardMaterial({
    color: '#f1f5f9',
    map: netTex,
    transparent: true,
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    roughness: 0.85,
  });
  netTex.repeat.set(Math.round(dims.goalDepth * 2.2), Math.round(dims.goalWidth * 2.2));
  netTex.needsUpdate = true;

  for (const sign of [-1, 1]) {
    const goalGroup = new THREE.Group();
    const gx = sign * halfL;
    const gw = dims.goalWidth;
    const gh = dims.goalHeight;
    const gd = dims.goalDepth;
    const r = 0.095;

    const postGeo = new THREE.CylinderGeometry(r, r, gh, 16);
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(gx, gh * 0.5, -gw * 0.5);
    leftPost.castShadow = !isSoftwareGl;

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(gx, gh * 0.5, gw * 0.5);
    rightPost.castShadow = !isSoftwareGl;

    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, gw + r * 2, 16), postMat);
    crossbar.rotation.x = Math.PI / 2;
    crossbar.position.set(gx, gh, 0);
    crossbar.castShadow = !isSoftwareGl;

    // Corner joint caps
    for (const sz of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 12, 12), postMat);
      cap.position.set(gx, gh, sz * gw * 0.5);
      goalGroup.add(cap);
    }

    // Ground frame & back stanchions
    const backX = gx + sign * gd;
    const backL = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.65, r * 0.65, gh, 10), postMat);
    backL.position.set(backX, gh * 0.5, -gw * 0.5);
    const backR = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.65, r * 0.65, gh, 10), postMat);
    backR.position.set(backX, gh * 0.5, gw * 0.5);

    const topL = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.65, r * 0.65, gd, 10), postMat);
    topL.rotation.z = Math.PI / 2;
    topL.position.set(gx + sign * gd * 0.5, gh, -gw * 0.5);
    const topR = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.65, r * 0.65, gd, 10), postMat);
    topR.rotation.z = Math.PI / 2;
    topR.position.set(gx + sign * gd * 0.5, gh, gw * 0.5);

    const groundBack = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, gw, 10), postMat);
    groundBack.rotation.x = Math.PI / 2;
    groundBack.position.set(backX, r * 0.55, 0);

    // Square-grid crisp goal net panels
    const backNet = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), netMatBack);
    backNet.rotation.y = Math.PI / 2;
    backNet.position.set(backX, gh * 0.5, 0);

    const roofNet = new THREE.Mesh(new THREE.PlaneGeometry(gd, gw), netMatRoof);
    roofNet.rotation.x = Math.PI / 2;
    roofNet.position.set(gx + sign * gd * 0.5, gh, 0);

    const sideNetL = new THREE.Mesh(new THREE.PlaneGeometry(gd, gh), netMatSide);
    sideNetL.position.set(gx + sign * gd * 0.5, gh * 0.5, -gw * 0.5);
    const sideNetR = new THREE.Mesh(new THREE.PlaneGeometry(gd, gh), netMatSide);
    sideNetR.position.set(gx + sign * gd * 0.5, gh * 0.5, gw * 0.5);

    goalGroup.add(
      leftPost,
      rightPost,
      crossbar,
      backL,
      backR,
      topL,
      topR,
      groundBack,
      backNet,
      roofNet,
      sideNetL,
      sideNetR
    );
    root.add(goalGroup);
  }

  // Perimeter LED / Sponsor Advertising Boards (UV-repeated proportionally so text never stretches)
  const boardOffset = mode === 'arena5v5' ? 0.35 : 2.9;
  const boardH = mode === 'arena5v5' ? 0.72 : 0.98;
  const adTex = createAdBoardTexture(mode, maxAnisotropy);
  adTex.wrapS = THREE.RepeatWrapping;
  adTex.wrapT = THREE.ClampToEdgeWrapping;
  const boardFrameMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.45,
    metalness: 0.4,
  });

  const addBoardWall = (x: number, z: number, lenX: number, lenZ: number, horizontal: boolean) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(lenX, boardH, lenZ), boardFrameMat);
    base.position.y = boardH * 0.5;
    base.castShadow = !isSoftwareGl;
    g.add(base);

    const faceLen = horizontal ? lenX - 0.1 : lenZ - 0.1;
    const clonedTex = adTex.clone();
    clonedTex.wrapS = THREE.RepeatWrapping;
    clonedTex.repeat.set(Math.max(1, Math.round(faceLen / 18)), 1);
    clonedTex.needsUpdate = true;

    const adFaceMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: clonedTex,
      emissive: '#ffffff',
      emissiveMap: clonedTex,
      emissiveIntensity: 0.25,
      roughness: 0.35,
      metalness: 0.1,
    });

    const face = new THREE.Mesh(new THREE.PlaneGeometry(faceLen, boardH * 0.86), adFaceMat);
    if (horizontal) {
      face.position.set(0, boardH * 0.5, z < 0 ? lenZ * 0.5 + 0.01 : -lenZ * 0.5 - 0.01);
      if (z > 0) face.rotation.y = Math.PI;
    } else {
      face.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      face.position.set(x < 0 ? lenX * 0.5 + 0.01 : -lenX * 0.5 - 0.01, boardH * 0.5, 0);
    }
    g.add(face);
    g.position.set(x, 0, z);
    root.add(g);
  };

  addBoardWall(0, -(halfW + boardOffset), dims.length + boardOffset * 2, 0.36, true);
  addBoardWall(0, halfW + boardOffset, dims.length + boardOffset * 2, 0.36, true);
  const wingW = (dims.width - dims.goalWidth) * 0.5 + boardOffset - 0.3;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const zPos = sz * (dims.goalWidth * 0.5 + wingW * 0.5 + 0.3);
      addBoardWall(sx * (halfL + boardOffset + (mode === 'arena5v5' ? 0 : 0.4)), zPos, 0.36, wingW, false);
    }
  }

  // Team Dugout Benches along top sideline (11v11)
  if (mode === 'classic11v11') {
    const benchMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5, metalness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#93c5fd',
      transparent: true,
      opacity: 0.35,
      roughness: 0.15,
      metalness: 0.2,
    });
    const seatMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.6 });
    const seatMatAway = new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const dugout = new THREE.Group();
      const floor = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.1, 1.5), benchMat);
      floor.position.y = 0.05;
      const back = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.65, 0.08), glassMat);
      back.position.set(0, 0.88, -0.7);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.08, 1.4), glassMat);
      roof.position.set(0, 1.72, -0.05);
      dugout.add(floor, back, roof);
      for (let k = -2; k <= 2; k++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.55), sx < 0 ? seatMat : seatMatAway);
        s.position.set(k * 1.0, 0.35, -0.15);
        dugout.add(s);
      }
      dugout.position.set(sx * 9.5, 0, -(halfW + 1.55));
      root.add(dugout);
    }
  }

  // Stadium Terraced Stands + Sculpted Instanced Crowd (torso + head InstancedMesh)
  const standConcreteMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.88,
    metalness: 0.08,
  });
  const standTrimMat = new THREE.MeshStandardMaterial({
    color: '#334155',
    roughness: 0.65,
    metalness: 0.2,
  });

  for (const sz of [-1, 1]) {
    for (let tier = 0; tier < 3; tier++) {
      const stand = new THREE.Mesh(
        new THREE.BoxGeometry(dims.length + 14, 1.2, 2.7),
        standConcreteMat
      );
      const yPos = 0.6 + tier * 1.15;
      const zPos = sz * (halfW + 5.2 + tier * 2.55);
      stand.position.set(0, yPos, zPos);
      root.add(stand);

      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(dims.length + 14, 0.14, 0.14),
        standTrimMat
      );
      rail.position.set(0, yPos + 0.65, zPos - sz * 1.25);
      root.add(rail);
    }
  }

  // Instanced stadium seats + 2-part spectators (torso + head)
  const crowdCount = mode === 'arena5v5' ? 120 : 210;
  const specTorsoGeo = new THREE.CapsuleGeometry(0.22, 0.34, 4, 8);
  const specHeadGeo = new THREE.SphereGeometry(0.15, 10, 8);
  const specTorsoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.05 });
  const specHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.02 });

  const crowdTorso = new THREE.InstancedMesh(specTorsoGeo, specTorsoMat, crowdCount);
  const crowdHead = new THREE.InstancedMesh(specHeadGeo, specHeadMat, crowdCount);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = ['#ef4444', '#3b82f6', '#facc15', '#f8fafc', '#10b981', '#fb923c', '#a855f7'];
  const randCrowd = seededRand(9012);

  for (let i = 0; i < crowdCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const tier = i % 3;
    const t = ((i / 2) / (crowdCount / 2)) * 2 - 1;
    const px = t * (halfL + 4.5) + (randCrowd() - 0.5) * 0.5;
    const py = 1.48 + tier * 1.15;
    const pz = side * (halfW + 5.2 + tier * 2.55);
    const s = 0.88 + randCrowd() * 0.24;

    dummy.position.set(px, py, pz);
    dummy.rotation.set(0, side < 0 ? 0 : Math.PI, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    crowdTorso.setMatrixAt(i, dummy.matrix);
    color.set(palette[i % palette.length]);
    crowdTorso.setColorAt(i, color);

    dummy.position.set(px, py + 0.42 * s, pz);
    dummy.updateMatrix();
    crowdHead.setMatrixAt(i, dummy.matrix);
    color.set(SKIN_TONES[i % SKIN_TONES.length]);
    crowdHead.setColorAt(i, color);
  }
  crowdTorso.computeBoundingSphere();
  crowdHead.computeBoundingSphere();
  root.add(crowdTorso, crowdHead);

  // 4 Corner Floodlight Towers (detailed truss + multi-bulb reflector panel)
  const towerPoleMat = new THREE.MeshStandardMaterial({
    color: '#64748b',
    roughness: 0.32,
    metalness: 0.82,
  });
  const lampHeadMat = new THREE.MeshStandardMaterial({
    color: '#fef9c3',
    emissive: '#fef08a',
    emissiveIntensity: 2.1,
    roughness: 0.18,
    metalness: 0.4,
  });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tower = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.72, 1.3, 12), towerPoleMat);
      base.position.y = 0.65;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.38, 13.5, 12), towerPoleMat);
      mast.position.y = 7.4;

      const headGroup = new THREE.Group();
      headGroup.position.y = 14.3;
      const housing = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.3, 0.45), towerPoleMat);
      headGroup.add(housing);

      // 2x3 Floodlight lamp matrix
      for (let lx = -1; lx <= 1; lx++) {
        for (let ly = -0.5; ly <= 0.5; ly += 1) {
          const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 10), lampHeadMat);
          bulb.rotation.x = Math.PI / 2;
          bulb.position.set(lx * 0.9, ly * 0.48, 0.22);
          headGroup.add(bulb);
        }
      }
      headGroup.lookAt(0, 0, 0);
      tower.add(base, mast, headGroup);
      tower.position.set(sx * (halfL + 6.2), 0, sz * (halfW + 6.2));
      root.add(tower);
    }
  }

  return root;
}

export function createCompositePlayerRig(
  teamPreset: TeamPreset,
  isGoalie: boolean,
  shadowTex: THREE.CanvasTexture,
  isSoftwareGl: boolean,
  playerNumber = 10,
  playerSeed = 0
): PlayerRig {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  bodyGroup.scale.setScalar(1.08);
  group.add(bodyGroup);

  const skinHex = SKIN_TONES[(playerNumber + playerSeed) % SKIN_TONES.length];
  const hairHex = HAIR_COLORS[(playerNumber * 3 + playerSeed) % HAIR_COLORS.length];
  const hairStyle = (playerNumber + playerSeed) % 4; // 0: parted, 1: fade/buzz, 2: curly/full, 3: headband retro

  const jerseyTex = getJerseyTexture(teamPreset, isGoalie, playerNumber, 4);
  const faceTex = createFaceTexture(skinHex, playerNumber + playerSeed);

  const jerseyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: jerseyTex,
    roughness: 0.68,
    metalness: 0.04,
  });
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: isGoalie ? teamPreset.gkColor : teamPreset.primaryColor,
    roughness: 0.68,
    metalness: 0.04,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: isGoalie ? '#0f172a' : teamPreset.secondaryColor,
    roughness: 0.52,
    metalness: 0.08,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: isGoalie ? '#0f172a' : teamPreset.shortsColor,
    roughness: 0.72,
    metalness: 0.04,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinHex,
    roughness: 0.66,
    metalness: 0.02,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: faceTex,
    roughness: 0.64,
    metalness: 0.02,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.3,
    metalness: 0.25,
  });
  const bootAccentMat = new THREE.MeshStandardMaterial({
    color: teamPreset.accentColor,
    roughness: 0.38,
    metalness: 0.22,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.5,
    metalness: 0.05,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairHex,
    roughness: 0.85,
  });

  // Ground contact shadow disc
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(PLAYER_RADIUS * 1.28, 24),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.022;
  group.add(shadowDisc);

  // Active player selection ring on turf + sculpted extruded directional aim chevron
  const activeRing = new THREE.Mesh(
    new THREE.RingGeometry(PLAYER_RADIUS * 1.42, PLAYER_RADIUS * 1.88, 36),
    new THREE.MeshBasicMaterial({
      color: '#facc15',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    })
  );
  activeRing.rotation.order = 'YXZ';
  activeRing.rotation.x = -Math.PI / 2;
  activeRing.position.y = 0.025;
  activeRing.visible = false;

  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, -0.34);
  arrowShape.lineTo(0.22, 0.02);
  arrowShape.lineTo(0.08, -0.02);
  arrowShape.lineTo(0, -0.09);
  arrowShape.lineTo(-0.08, -0.02);
  arrowShape.lineTo(-0.22, 0.02);
  arrowShape.closePath();

  const aimChevron = new THREE.Mesh(
    new THREE.ShapeGeometry(arrowShape),
    new THREE.MeshBasicMaterial({ color: '#facc15', side: THREE.DoubleSide, depthWrite: false })
  );
  // In local ring plane before X=-90deg, -Y maps to +Z in world space
  aimChevron.position.set(0, -PLAYER_RADIUS * 2.15, 0);
  activeRing.add(aimChevron);
  group.add(activeRing);

  // Shot charge ring around active player
  const chargeRing = new THREE.Mesh(
    new THREE.RingGeometry(PLAYER_RADIUS * 1.9, PLAYER_RADIUS * 2.25, 32),
    new THREE.MeshBasicMaterial({
      color: '#ef4444',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
  );
  chargeRing.rotation.x = -Math.PI / 2;
  chargeRing.position.y = 0.026;
  chargeRing.visible = false;
  group.add(chargeRing);

  // Sculpted Athletic Torso (tapered waist to broad shoulders, oval cross-section)
  const torsoGeo = new THREE.CylinderGeometry(0.23, 0.185, 0.5, 16);
  torsoGeo.scale(1.12, 1, 0.72);
  const torso = new THREE.Mesh(torsoGeo, jerseyMat);
  torso.position.y = 0.89;
  torso.castShadow = !isSoftwareGl;
  bodyGroup.add(torso);

  // Collar ring + Neck
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 16), trimMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.14;
  bodyGroup.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.08, 0.1, 10), skinMat);
  neck.position.y = 1.16;
  bodyGroup.add(neck);

  // Sculpted Shorts / Pelvis
  const pelvisGeo = new THREE.CylinderGeometry(0.195, 0.21, 0.22, 16);
  pelvisGeo.scale(1.1, 1, 0.76);
  const pelvis = new THREE.Mesh(pelvisGeo, shortsMat);
  pelvis.position.y = 0.56;
  pelvis.castShadow = !isSoftwareGl;
  bodyGroup.add(pelvis);

  // Sculpted Head with Face Texture, Ears & Varied Hairstyle
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 20, 16), headMat);
  head.position.y = 1.33;
  head.castShadow = !isSoftwareGl;
  bodyGroup.add(head);

  // Ears
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), skinMat);
    ear.scale.set(0.55, 1.0, 0.8);
    ear.position.set(sx * 0.18, 1.32, 0);
    bodyGroup.add(ear);
  }

  // Hair variations
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.192, 16, 10, 0, Math.PI * 2, 0, Math.PI * (hairStyle === 1 ? 0.42 : 0.56)),
    hairMat
  );
  hairCap.position.y = 1.35;
  bodyGroup.add(hairCap);

  if (hairStyle === 2) {
    // Full retro curls
    const topPuff = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), hairMat);
    topPuff.scale.set(1.25, 0.65, 1.15);
    topPuff.position.set(0, 1.49, -0.02);
    bodyGroup.add(topPuff);
  } else if (hairStyle === 3) {
    // Classic 90s headband
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.186, 0.022, 8, 20), trimMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 1.4;
    bodyGroup.add(band);
  }

  // Left & Right Sculpted Articulated Legs (shorts hem + thigh + knee + calf/sock + boot + sole)
  const makeLeg = (offsetX: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(offsetX, 0.52, 0);

    const shortLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.092, 0.16, 12), shortsMat);
    shortLeg.position.y = -0.06;

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.068, 0.2, 12), skinMat);
    thigh.position.y = -0.2;

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), skinMat);
    knee.position.y = -0.3;

    const sockTop = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.072, 0.05, 12), trimMat);
    sockTop.position.y = -0.33;

    const sock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.056, 0.16, 12),
      isGoalie ? trimMat : sleeveMat
    );
    sock.position.y = -0.41;

    // Sculpted Football Boot (upper + rounded toe + cleat sole)
    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.075, 0.21), bootMat);
    bootUpper.position.set(0, -0.485, 0.035);
    bootUpper.castShadow = !isSoftwareGl;

    const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bootMat);
    toeCap.scale.set(1.0, 0.62, 1.15);
    toeCap.position.set(0, -0.495, 0.13);

    const bootStripe = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.025, 0.14), bootAccentMat);
    bootStripe.position.set(0, -0.485, 0.02);

    pivot.add(shortLeg, thigh, knee, sockTop, sock, bootUpper, toeCap, bootStripe);
    return pivot;
  };
  const leftLegPivot = makeLeg(-0.115);
  const rightLegPivot = makeLeg(0.115);
  bodyGroup.add(leftLegPivot, rightLegPivot);

  // Left & Right Sculpted Arms (shoulder cap + jersey sleeve + cuff + forearm + hand/GK glove)
  const makeArm = (offsetX: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(offsetX, 1.07, 0);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), sleeveMat);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.062, 0.18, 12), sleeveMat);
    sleeve.position.y = -0.09;

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.062, 0.03, 12), trimMat);
    cuff.position.y = -0.18;

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.044, 0.21, 10), skinMat);
    forearm.position.y = -0.28;

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(isGoalie ? 0.068 : 0.048, 10, 8),
      isGoalie ? gloveMat : skinMat
    );
    hand.scale.set(0.85, 1.15, 0.9);
    hand.position.y = -0.4;

    pivot.add(shoulder, sleeve, cuff, forearm, hand);
    return pivot;
  };
  const leftArmPivot = makeArm(-0.295);
  const rightArmPivot = makeArm(0.295);
  bodyGroup.add(leftArmPivot, rightArmPivot);

  // Floating yellow/red card indicator badge above head
  const cardBadge = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.24, 0.04),
    new THREE.MeshBasicMaterial({ color: '#facc15' })
  );
  cardBadge.position.set(0, 1.76, 0);
  cardBadge.visible = false;
  group.add(cardBadge);

  return {
    group,
    bodyGroup,
    torso,
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    head,
    activeRing,
    chargeRing,
    cardBadge,
    shadowDisc,
  };
}

export function createRefereeRig(
  shadowTex: THREE.CanvasTexture,
  isSoftwareGl: boolean
): RefereeRig {
  const refPreset: TeamPreset = {
    id: 'ref',
    name: 'Sudija',
    shortCode: 'REF',
    primaryColor: '#111827',
    secondaryColor: '#facc15',
    shortsColor: '#030712',
    accentColor: '#facc15',
    gkColor: '#111827',
  };
  const base = createCompositePlayerRig(refPreset, false, shadowTex, isSoftwareGl, 0, 7);
  const cardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.24, 0.03),
    new THREE.MeshBasicMaterial({ color: '#facc15' })
  );
  cardMesh.position.set(0, -0.4, 0.1);
  cardMesh.visible = false;
  base.rightArmPivot.add(cardMesh);

  return {
    group: base.group,
    bodyGroup: base.bodyGroup,
    leftLegPivot: base.leftLegPivot,
    rightLegPivot: base.rightLegPivot,
    rightArmPivot: base.rightArmPivot,
    cardMesh,
  };
}

export function createBallMesh(
  maxAnisotropy: number,
  shadowTex: THREE.CanvasTexture,
  isSoftwareGl: boolean
): { ballGroup: THREE.Group; ballSphere: THREE.Mesh; ballShadow: THREE.Mesh } {
  const ballGroup = new THREE.Group();
  const tex = createSoccerBallTexture(maxAnisotropy);
  const ballSphere = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 28, 22),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex,
      roughness: 0.34,
      metalness: 0.04,
      clearcoat: 0.3,
      clearcoatRoughness: 0.25,
    })
  );
  ballSphere.castShadow = !isSoftwareGl;
  ballGroup.add(ballSphere);

  const ballShadow = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_RADIUS * 1.48, 24),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.64,
      depthWrite: false,
    })
  );
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.position.y = 0.024;

  return { ballGroup, ballSphere, ballShadow };
}
