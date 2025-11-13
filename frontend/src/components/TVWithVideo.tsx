"use client";

import { motion } from "framer-motion";

interface TVWithVideoProps {
  videoSrc: string;
  hold: boolean;
  videoId?: string;
}

export default function TVWithVideo({ videoSrc, hold, videoId = "tv-video" }: TVWithVideoProps) {
  return (
    <motion.div
      className="relative"
      style={{
        width: 'clamp(200px, 50vw, 800px)',
        maxWidth: '800px',
      }}
      animate={{
        scale: hold ? 1.5 : 1,
      }}
      transition={{ duration: 3, ease: "easeInOut", delay: hold ? 0.3 : 0 }}
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
          preload="auto"
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
    </motion.div>
  );
}

