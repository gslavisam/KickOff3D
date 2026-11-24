import React, { useRef, useState } from 'react';

interface TouchControlsProps {
  visible: boolean;
  onJoystickMove: (x: number, z: number) => void;
  onShootHold: (held: boolean) => void;
  onPass: () => void;
  onTackle: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  visible,
  onJoystickMove,
  onShootHold,
  onPass,
  onTackle,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  if (!visible) return null;

  const maxRadius = 42;

  const updateStick = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobOffset({ x: dx, y: dy });
    onJoystickMove(dx / maxRadius, dy / maxRadius);
  };

  const resetStick = () => {
    pointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onJoystickMove(0, 0);
  };

  return (
    <div className="fixed inset-x-0 bottom-16 z-20 pointer-events-none flex items-end justify-between px-4 sm:px-6 pb-2">
      {/* Left: Virtual Analog Joystick */}
      <div
        ref={padRef}
        onPointerDown={(e) => {
          e.preventDefault();
          pointerIdRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          resetStick();
        }}
        onPointerCancel={resetStick}
        className="pointer-events-auto relative w-28 h-28 rounded-full bg-[#09120e]/75 border-2 border-white/25 touch-none flex items-center justify-center shadow-xl"
        aria-label="Virtuelni džojstik za kretanje"
      >
        <div
          className="w-11 h-11 rounded-full bg-amber-400/90 border-2 border-white shadow-md"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Right: Arcade Action Buttons */}
      <div className="pointer-events-auto flex items-end gap-2.5">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onTackle();
          }}
          className="w-14 h-14 rounded-full bg-[#13251d]/90 border-2 border-rose-400/70 text-rose-200 font-display text-sm font-bold active:scale-95 touch-none shadow-lg cursor-pointer"
        >
          KLIZ.
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onPass();
          }}
          className="w-15 h-15 rounded-full bg-[#13251d]/90 border-2 border-sky-400/80 text-sky-100 font-display text-base font-bold active:scale-95 touch-none shadow-lg cursor-pointer"
        >
          PAS
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            onShootHold(true);
          }}
          onPointerUp={() => onShootHold(false)}
          onPointerCancel={() => onShootHold(false)}
          className="w-18 h-18 rounded-full bg-amber-400 border-2 border-white text-slate-950 font-display text-xl font-extrabold active:scale-95 touch-none shadow-xl cursor-pointer"
        >
          ŠUT
        </button>
      </div>
    </div>
  );
};
