'use client';

import { motion } from 'framer-motion';

interface AnalogToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  onLabel?: string;
  offLabel?: string;
  disabled?: boolean;
}

/**
 * A physical-looking flip switch (think an old amp/mixer rocker toggle)
 * rather than a flat modern checkbox - fits the tactile, old-electronics
 * feel already established by Spacebar/on.mp4/off.mp4 elsewhere in the game.
 */
export default function AnalogToggle({
  checked,
  onChange,
  label = 'Hindi',
  onLabel = 'ON',
  offLabel = 'OFF',
  disabled = false,
}: AnalogToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`group flex items-center gap-3 select-none ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Wall-plate housing */}
      <div
        className="relative flex flex-col items-center justify-between rounded-md px-1.5 py-2"
        style={{
          width: '2.25rem',
          height: '4rem',
          background: 'linear-gradient(155deg, #3a4150 0%, #22262e 55%, #181b21 100%)',
          boxShadow:
            'inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -2px 4px rgba(0,0,0,0.6), 0 3px 6px rgba(0,0,0,0.5)',
          border: '1px solid #10121600',
        }}
      >
        {/* Recessed track the paddle sits in */}
        <div
          className="pointer-events-none absolute inset-1 rounded-sm"
          style={{
            boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.75), inset 0 -1px 2px rgba(255,255,255,0.04)',
            background: 'linear-gradient(180deg, #101216 0%, #1a1d22 100%)',
          }}
        />

        {/* ON / OFF etched labels */}
        <span
          className={`relative z-10 text-[6px] font-bold tracking-widest transition-colors duration-200 ${
            checked ? 'text-emerald-400' : 'text-white/20'
          }`}
        >
          {onLabel}
        </span>

        {/* The rocker paddle itself */}
        <motion.div
          className="absolute left-1/2 z-20 rounded-[3px]"
          style={{
            width: '1.55rem',
            height: '1.7rem',
            x: '-50%',
            background: checked
              ? 'linear-gradient(155deg, #5d67f5 0%, #4448c9 55%, #2f329e 100%)'
              : 'linear-gradient(155deg, #9aa3b2 0%, #6a7280 55%, #4b515c 100%)',
            boxShadow:
              '0 2px 3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -3px 4px rgba(0,0,0,0.35)',
            border: '1px solid rgba(0,0,0,0.4)',
          }}
          initial={false}
          animate={{
            top: checked ? '0.2rem' : '2.15rem',
            rotateX: checked ? -10 : 10,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        >
          {/* Grip ridges */}
          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 space-y-[3px]">
            <div className="h-[1.5px] w-full rounded-full bg-black/25" />
            <div className="h-[1.5px] w-full rounded-full bg-black/25" />
          </div>
        </motion.div>

        <span
          className={`relative z-10 text-[6px] font-bold tracking-widest transition-colors duration-200 ${
            !checked ? 'text-white/50' : 'text-white/20'
          }`}
        >
          {offLabel}
        </span>
      </div>

      <div className="flex flex-col items-start">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#e8ebf0]">{label}</span>
        <span className={`text-[10px] font-medium ${checked ? 'text-emerald-400' : 'text-[#9aa3b2]'}`}>
          {checked ? 'Included' : 'Excluded'}
        </span>
      </div>
    </button>
  );
}
