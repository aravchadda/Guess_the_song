'use client';

import { CSSProperties, ReactNode } from 'react';

interface SpacebarProps {
  pressed: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  onTouchCancel?: (e: React.TouchEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  style?: CSSProperties;
  className?: string;
  /** Optional absolutely-positioned overlay (e.g. a charge-progress fill), rendered above the label */
  overlay?: ReactNode;
}

/**
 * A physical-keycap-style spacebar: rests "raised" via an offset shadow,
 * and depresses (shadow collapses, keycap shifts down) while pressed —
 * whether that press comes from a click/tap or the real spacebar key.
 */
export default function Spacebar({
  pressed,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
  onClick,
  style,
  className = '',
  overlay,
}: SpacebarProps) {
  return (
    <button
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onClick={onClick}
      aria-label="Spacebar"
      // UPDATED: Changed from translate-y-1.5 to translate-y-[7.2px]
      className={`relative rounded-full bg-transparent border-4 border-white text-white select-none cursor-pointer transition-transform duration-75 ease-out ${
        pressed ? 'translate-y-[7.2px]' : ''
      } ${className}`}
      style={{
        ...style,
        // The depth layer below intentionally renders outside the button's own
        // box (so it can show below the button face). Extend the button's own
        // hit-box to cover that same area, or only its top half is clickable.
        minHeight: style?.minHeight ? `calc(${style.minHeight} + 12px)` : undefined,
        userSelect: 'none',
      }}
    >
      {/* 1. THE HOLLOW 3D DEPTH LAYER */}
      <div
        // UPDATED: Changed from translate-y-1.5 to translate-y-[7.2px]
        className={`absolute -inset-1 rounded-full border-4 border-white pointer-events-none transition-transform duration-75 ease-out ${
          pressed ? 'translate-y-0' : 'translate-y-[7.2px]'
        }`}
        style={{
          clipPath: 'inset(40% -10% -10% -10%)',
        }}
      />

      {/* 2. THE OVERLAY CLIPPER */}
      <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
        {overlay}
      </div>

      {/* 3. THE TEXT */}
      <span className="relative z-10 font-mono pointer-events-none">Space</span>
    </button>
  );
}