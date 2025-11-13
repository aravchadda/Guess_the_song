"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import TVWithVideo from "@/components/TVWithVideo";

// List of all videos in compressed folder
const videos = [
  "/compressed/ariana.mp4",
  "/compressed/bad-bunny.mp4",
  "/compressed/kendrick.mp4",
  "/compressed/single-ladies.mp4",
  "/compressed/royals.mp4",
  "/compressed/hard-times.mp4",
  "/compressed/tame-impala.mp4",
];

export default function Home(): JSX.Element {
  const [hold, setHold] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  // Initialize with a random video immediately to avoid loading the first video
  const [selectedVideo, setSelectedVideo] = useState<string>(() => {
    return videos[Math.floor(Math.random() * videos.length)];
  });
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Load video when selectedVideo changes
  useEffect(() => {
    if (!selectedVideo) return;

    let timeoutId: NodeJS.Timeout;
    let retryCount = 0;
    const maxRetries = 50; // 5 seconds max wait

    // Wait for video element to be available
    const checkVideo = () => {
      const video = document.getElementById("tv-video") as HTMLVideoElement | null;
      if (!video) {
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(checkVideo, 100);
        } else {
          // Fallback: hide loading after max retries
          setIsVideoLoading(false);
        }
        return;
      }

      const handleCanPlayThrough = () => {
        setIsVideoLoading(false);
        if (timeoutId) clearTimeout(timeoutId);
        video.removeEventListener('canplaythrough', handleCanPlayThrough);
        video.removeEventListener('error', handleError);
        video.removeEventListener('loadeddata', handleLoadedData);
      };

      const handleLoadedData = () => {
        // If video has enough data, consider it loaded
        if (video.readyState >= 3) {
          setIsVideoLoading(false);
          if (timeoutId) clearTimeout(timeoutId);
          video.removeEventListener('canplaythrough', handleCanPlayThrough);
          video.removeEventListener('error', handleError);
          video.removeEventListener('loadeddata', handleLoadedData);
        }
      };

      const handleError = () => {
        setIsVideoLoading(false);
        if (timeoutId) clearTimeout(timeoutId);
        video.removeEventListener('canplaythrough', handleCanPlayThrough);
        video.removeEventListener('error', handleError);
        video.removeEventListener('loadeddata', handleLoadedData);
        console.error('Error loading video:', selectedVideo);
      };

      // Check if already loaded
      if (video.readyState >= 3) {
        setIsVideoLoading(false);
        return;
      }

      // Fallback timeout - hide loading after 10 seconds
      timeoutId = setTimeout(() => {
        setIsVideoLoading(false);
        console.warn('Video loading timeout, hiding loading screen');
      }, 10000);

      video.addEventListener('canplaythrough', handleCanPlayThrough, { once: true });
      video.addEventListener('loadeddata', handleLoadedData, { once: true });
      video.addEventListener('error', handleError, { once: true });

      // Set video source and load if needed
      const currentSrc = video.src.split('/').pop() || '';
      const newSrc = selectedVideo.split('/').pop() || '';
      if (currentSrc !== newSrc) {
        video.src = selectedVideo;
        video.load();
      }
    };

    checkVideo();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [selectedVideo]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768; // md breakpoint
      setIsMobile(isTouchDevice || isSmallScreen);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle tab visibility (mute/resume)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const video = document.getElementById("tv-video") as HTMLVideoElement | null;

      if (document.hidden) {
        if (video && !video.paused) video.muted = true;
        if (audioCtxRef.current?.state === "running") {
          audioCtxRef.current.suspend().catch(console.log);
        }
      } else {
        if (video && !video.paused) video.muted = false;
        if (audioCtxRef.current?.state === "suspended") {
          audioCtxRef.current.resume().catch(console.log);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Shared function to start holding
  const startHold = useCallback(async () => {
    if (triggered || holdTimer.current) return;
    
    let startTime = Date.now();
    const video = document.getElementById("tv-video") as HTMLVideoElement | null;

    if (video) {
      // 🎵 Setup audio context & filter
      if (!audioCtxRef.current) {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(video);
        const filter = audioCtx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 2000;
        source.connect(filter);
        filter.connect(audioCtx.destination);
        audioCtxRef.current = audioCtx;
        filterRef.current = filter;
      }

      video.muted = false;
      try {
        await audioCtxRef.current!.resume();
        await video.play();
      } catch (err) {
        console.log("Playback error:", err);
      }

      // Smooth fade-in for volume
      video.volume = 0;
      const fadeIn = setInterval(() => {
        if (video.volume < 1) video.volume = Math.min(1, video.volume + 0.05);
        else clearInterval(fadeIn);
      }, 100);
    }

    // Hold logic (2 seconds)
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / 2000, 1);
      setHoldProgress(progress);

      // 🎚️ Fade out high-pass
      if (filterRef.current && audioCtxRef.current) {
        const targetFreq = 2000 - progress * 2000;
        filterRef.current.frequency.setValueAtTime(
          Math.max(targetFreq, 0),
          audioCtxRef.current.currentTime
        );
      }

      if (progress >= 1) {
        clearInterval(holdTimer.current!);
        holdTimer.current = null;
        setTriggered(true);
        setHold(true);

        // Turn off filter
        if (filterRef.current && audioCtxRef.current) {
          filterRef.current.frequency.setValueAtTime(0, audioCtxRef.current.currentTime);
        }

        // Start zoom animation
        setTimeout(() => {
          setZoomed(true);
        }, 3500);
      }
    }, 20);
  }, [triggered]);

  // Shared function to stop holding
  const stopHold = useCallback(() => {
    if (triggered) return;
    
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setHoldProgress(0);

    if (filterRef.current && audioCtxRef.current) {
      filterRef.current.frequency.setValueAtTime(2000, audioCtxRef.current.currentTime);
    }
  }, [triggered]);

  // Handle mobile touch events
  const handleTouchStart = useCallback(async (e: React.TouchEvent) => {
    e.preventDefault();
    await startHold();
  }, [startHold]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    stopHold();
  }, [stopHold]);

  // Handle spacebar key press and release
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code === "Space" && !triggered && !holdTimer.current) {
        e.preventDefault();
        await startHold();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && !triggered) {
        e.preventDefault();
        stopHold();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [triggered, startHold, stopHold]);

  const letterVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
    }),
  };

  const titleLetters = [
    { text: "R", color: "#4A75AC" },
    { text: "E", color: "#4A75AC" },
    { text: "P", color: "#E2DCDE" },
    { text: "L", color: "#E2DCDE" },
    { text: "A", color: "#E2DCDE" },
    { text: "Y", color: "#E2DCDE" },
  ];

  const menuButtonStyle = {
    fontFamily: "var(--font-press-start-2p), monospace",
    textShadow: "2px 2px 0px #000, 4px 4px 0px rgba(0,0,0,0.3)",
    letterSpacing: "2px",
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#0E0E10] overflow-hidden">
      {/* Loading Screen */}
      <AnimatePresence>
        {isVideoLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[#0E0E10]"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-white text-sm opacity-70">Loading...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- TV WITH VIDEO --- */}
      <div className="absolute z-[0] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ opacity: isVideoLoading ? 0 : 1 }}>
        <TVWithVideo 
          videoSrc={selectedVideo} 
          hold={hold}
          videoId="tv-video"
        />
      </div>

      {/* --- TEXT CONTENT --- */}
      {!isVideoLoading && (
        <motion.div
          className="absolute z-20 text-center px-4 sm:px-6 text-white"
          style={{
            left: 'calc(50% - clamp(200px, 50vw, 800px) * 0.394)',
            top: 'calc(50% - clamp(200px, 50vw, 800px) * 0.15)',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            opacity: hold ? 0 : 1,
            scale: hold ? 0.95 : 1,
          }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
        <h1 className="font-extrabold mb-2 select-none flex justify-center flex-wrap" style={{ fontSize: 'clamp(1.8rem, 7.2vw, 7.2rem)' }}>
          {titleLetters.map((letter, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={letterVariants}
              initial="hidden"
              animate="visible"
              style={{ color: letter.color }}
              className="inline-block"
            >
              {letter.text}
            </motion.span>
          ))}
        </h1>

        <motion.p
          className="text-gray-300 mb-2 px-4"
          style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1rem)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          Test how wide your music pallete is.
        </motion.p>
        </motion.div>
      )}

      {/* --- SPACEBAR INSTRUCTION + ENTER BUTTON --- */}
      {!isVideoLoading && !zoomed && !triggered && (
        <motion.div
          className="absolute z-20 text-center px-4 sm:px-6 text-white left-1/2 w-full max-w-[90vw]"
          style={{
            bottom: 'clamp(1rem, 5vh, 3rem)',
            transform: 'translateX(-50%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
        >
          <p className="text-gray-400 px-4 text-center flex items-center justify-center gap-2 flex-wrap" style={{ fontSize: 'clamp(0.625rem, 1.2vw, 0.875rem)' }}>
            {isMobile ? 'Tap and hold' : 'Hold'}{" "}
            <motion.button
              onTouchStart={isMobile ? handleTouchStart : undefined}
              onTouchEnd={isMobile ? handleTouchEnd : undefined}
              className="relative rounded border-2 border-gray-100 tracking-widest bg-white text-black shadow-lg overflow-hidden touch-none"
              style={{ 
                minWidth: isMobile ? 'clamp(120px, 20vw, 180px)' : 'clamp(80px, 12vw, 120px)',
                minHeight: isMobile ? 'clamp(44px, 8vw, 60px)' : 'clamp(32px, 4vw, 44px)',
                padding: isMobile 
                  ? 'clamp(0.75rem, 2vw, 1.25rem) clamp(1.5rem, 4vw, 2.5rem)'
                  : 'clamp(0.25rem, 0.5vw, 0.5rem) clamp(1rem, 2vw, 1.5rem)',
                fontSize: isMobile 
                  ? 'clamp(0.875rem, 2vw, 1.125rem)'
                  : 'clamp(0.625rem, 1.2vw, 0.75rem)',
                userSelect: 'none',
              }}
              whileHover={!isMobile ? { scale: 1.05 } : {}}
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10">{isMobile ? 'HOLD' : 'SPACE'}</span>
              <motion.span
                className="absolute inset-0 rounded border-2 border-[#4A75AC] pointer-events-none"
                style={{
                  clipPath: `inset(0 ${(1 - holdProgress) * 100}% 0 0)`,
                }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </motion.button>{" "}
            for <strong>2 seconds</strong> to charge and enter.
          </p>
        </motion.div>
      )}

      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.5 }}
            className="absolute z-30 flex flex-col items-center sm:items-end gap-4 sm:gap-6 md:gap-8 right-4 sm:right-8 md:right-auto md:[right:calc(50%+37.5vw-50.25vw)] top-1/2 -translate-y-1/2"
          >
            <Link href="/game?mode=all" className="block">
              <motion.div
                whileHover={{ x: -10, scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="text-white font-bold cursor-pointer select-none"
                style={{
                  ...menuButtonStyle,
                  fontSize: 'clamp(1rem, 3vw, 2.5rem)',
                }}
              >
                PLAY ALL
              </motion.div>
            </Link>
            <Link href="/game?mode=post00s" className="block">
              <motion.div
                whileHover={{ x: -10, scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="text-white font-bold cursor-pointer select-none"
                style={{
                  ...menuButtonStyle,
                  fontSize: 'clamp(1rem, 3vw, 2.5rem)',
                }}
              >
                PLAY POST 00s
              </motion.div>
            </Link>
            <Link href="/game" className="block">
              <motion.div
                whileHover={{ x: -10, scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="text-white font-bold cursor-pointer select-none"
                style={{
                  ...menuButtonStyle,
                  fontSize: 'clamp(1rem, 3vw, 2.5rem)',
                }}
              >
                USER STATS
              </motion.div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
