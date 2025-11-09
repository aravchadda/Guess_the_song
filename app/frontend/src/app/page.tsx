"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import TVWithVideo from "@/components/TVWithVideo";

// List of all videos in public folder
const videos = [
  "/ariana.MOV",
  "/bad-bunny.MOV",
  "/kendrick.MOV",
  "/single-ladies.MOV",
  "/royals.MOV",
  "/hard-times.MOV",
  "/tame-impala.MOV",
];

export default function Home(): JSX.Element {
  const [hold, setHold] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showBackground, setShowBackground] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const router = useRouter();
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Random video
  useEffect(() => {
    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    setSelectedVideo(randomVideo);
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

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code === "Space" && !triggered && !holdTimer.current) {
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
              // ⏱️ Show background after fade-out completes
              setTimeout(() => setShowBackground(true),0);
            }, 3500);
          }
        }, 20);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && !triggered) {
        if (holdTimer.current) {
          clearInterval(holdTimer.current);
          holdTimer.current = null;
        }
        setHoldProgress(0);

        if (filterRef.current && audioCtxRef.current) {
          filterRef.current.frequency.setValueAtTime(2000, audioCtxRef.current.currentTime);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [triggered]);

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

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#0E0E10] overflow-hidden">
      {/* --- Background (only visible after zoom) --- */}
      

      {/* --- TV WITH VIDEO --- */}
      <div className="absolute z-[0] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <TVWithVideo 
          videoSrc={selectedVideo || videos[0]} 
          hold={hold}
          videoId="tv-video"
        />
      </div>

      {/* --- TEXT CONTENT --- */}
      <motion.div
        className="relative z-20 text-center px-4 sm:px-6 text-white left-0 md:-left-[43px]"
        animate={{
          opacity: hold ? 0 : 1,
          scale: hold ? 0.95 : 1,
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      >
      

        <h1 className="text-4xl sm:text-5xl md:text-8xl lg:text-8xl font-extrabold mb-4 select-none flex justify-center flex-wrap">
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
          className="text-gray-300 mb-6 sm:mb-8 md:mb-10 text-xs sm:text-sm md:text-base px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          An interactive journey through ten years of sound.
        </motion.p>

        {/* --- SPACEBAR INSTRUCTION + ENTER BUTTON --- */}
        {!zoomed && !triggered && (
          <motion.div
            className="flex flex-col items-center space-y-4 sm:space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
          >
            <p className="text-gray-400 text-xs sm:text-sm px-4 text-center">
              Hold{" "}
              <span className="px-2 sm:px-3 py-1 border border-gray-500 rounded-lg text-xs sm:text-sm">
                spacebar
              </span>{" "}
              for <strong>2 seconds</strong> to charge and enter.
            </p>

            <motion.button
              className="relative text-xs sm:text-sm px-6 sm:px-8 md:px-10 py-2 sm:py-3 rounded-full border-2 border-gray-100 tracking-widest bg-white text-black shadow-lg overflow-hidden"
            >
              <span className="relative z-10">ENTER</span>
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-[#4A75AC]"
                style={{
                  clipPath: `inset(0 ${(1 - holdProgress) * 100}% 0 0)`,
                }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </motion.button>
          </motion.div>
        )}
      </motion.div>


<AnimatePresence>
  {zoomed && (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.5 }}
      className="absolute z-30 flex flex-col items-center justify-center gap-6 sm:gap-8 mt-8"
    >
      <Link href="/game" className="block">
        <motion.div
          whileHover={{ x: 10, scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="text-white text-2xl sm:text-3xl md:text-4xl font-bold cursor-pointer select-none"
          style={{
            fontFamily: "var(--font-press-start-2p), monospace",
            textShadow: "2px 2px 0px #000, 4px 4px 0px rgba(0,0,0,0.3)",
            letterSpacing: "2px",
          }}
        >
          PLAY ALL
        </motion.div>
      </Link>
      <Link href="/game" className="block">
        <motion.div
          whileHover={{ x: 10, scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="text-white text-2xl sm:text-3xl md:text-4xl font-bold cursor-pointer select-none"
          style={{
            fontFamily: "var(--font-press-start-2p), monospace",
            textShadow: "2px 2px 0px #000, 4px 4px 0px rgba(0,0,0,0.3)",
            letterSpacing: "2px",
          }}
        >
          PLAY POST 20s
        </motion.div>
      </Link>
      <Link href="/game" className="block">
        <motion.div
          whileHover={{ x: 10, scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="text-white text-2xl sm:text-3xl md:text-4xl font-bold cursor-pointer select-none"
          style={{
            fontFamily: "var(--font-press-start-2p), monospace",
            textShadow: "2px 2px 0px #000, 4px 4px 0px rgba(0,0,0,0.3)",
            letterSpacing: "2px",
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
