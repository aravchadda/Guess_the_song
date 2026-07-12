"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface TVWithVideoProps {
  videoSrc: string;
  hold: boolean;
  skipAnimation?: boolean;
  videoId?: string;
  preload?: "none" | "metadata" | "auto";
  children?: ReactNode;
}

export default function TVWithVideo({ videoSrc, hold, skipAnimation = false, videoId = "tv-video", preload = "auto", children }: TVWithVideoProps) {
  const tvScale = hold ? 1.5 : 1;
  const contentScale = hold ? 0.6667 : 1;
  const scaleTransition = skipAnimation
    ? { duration: 0 }
    : { duration: 3, ease: "easeInOut" as const, delay: hold ? 0.3 : 0 };

  return (
    <motion.div
      className="relative"
      style={{
        width: 'clamp(200px, max(50vw, min(78vw, 44vh)), 800px)',
        maxWidth: '800px',
      }}
      initial={{ scale: tvScale }}
      animate={{ scale: tvScale }}
      transition={scaleTransition}
    >
      {/* Video - positioned behind the frame, clipped to appear inside TV screen */}
      <div
        className="absolute inset-0 z-10 rounded-3xl overflow-hidden"
        style={{
          clipPath: "inset(8% 8% 8% 8%)",
        }}
      >
        <video
          id={videoId}
          src={videoSrc}
          loop
          muted
          playsInline
          preload={preload}
          className="w-full h-full object-cover"
          style={{ 
            opacity: 0.3,
          }}
        />
      </div>

      {/* TV Frame - positioned on top, maintains aspect ratio */}
      <img
        src="/TV.png"
        alt="TV Frame"
        className="relative w-full h-auto z-20 rounded-3xl shadow-2xl object-contain pointer-events-none"
      />

      {children && (
        <motion.div
          className="absolute z-30 flex flex-col items-center justify-center text-center text-white"
          style={{
            left: '8%',
            right: '25%',
            top: '8%',
            bottom: '10%',
            transformOrigin: 'center',
          }}
          initial={{ scale: contentScale }}
          animate={{ scale: contentScale }}
          transition={scaleTransition}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}
