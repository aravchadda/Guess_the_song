"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import TVWithVideo from "@/components/TVWithVideo";
import Spacebar from "@/components/Spacebar";
import { useAuth } from "@/lib/auth";

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
  const { token, user, isLoading: isAuthLoading, loginWithCredential, logout } = useAuth();
  const [signInError, setSignInError] = useState("");
  const [hold, setHold] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isSpacePressed, setIsSpacePressed] = useState(false); // Drives the keycap press visual
  // Initialize with a random video immediately to avoid loading the first video
  const [selectedVideo, setSelectedVideo] = useState<string>(() => {
    return videos[Math.floor(Math.random() * videos.length)];
  });
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const holdIntentRef = useRef(false);
  const fadeInTimer = useRef<NodeJS.Timeout | null>(null);
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
  const startHold = useCallback(() => {
    if (triggered || holdTimer.current) return;
    
    holdIntentRef.current = true;
    const startTime = Date.now();
    const video = document.getElementById("tv-video") as HTMLVideoElement | null;

    // Hold logic (2 seconds)
    holdTimer.current = setInterval(() => {
      if (!holdIntentRef.current) {
        if (holdTimer.current) {
          clearInterval(holdTimer.current);
          holdTimer.current = null;
        }
        return;
      }

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

    if (video) {
      void (async () => {
        // Setup audio context & filter after the visual hold has already started.
        if (!audioCtxRef.current) {
          const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextCtor();
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
        video.volume = 0;

        try {
          await audioCtxRef.current!.resume();
          await video.play();
        } catch (err) {
          console.log("Playback error:", err);
        }

        if (!holdIntentRef.current || triggered) {
          video.pause();
          video.muted = true;
          video.volume = 0;
          return;
        }

        if (fadeInTimer.current) clearInterval(fadeInTimer.current);
        fadeInTimer.current = setInterval(() => {
          if (!holdIntentRef.current) {
            if (fadeInTimer.current) {
              clearInterval(fadeInTimer.current);
              fadeInTimer.current = null;
            }
            video.volume = 0;
            return;
          }

          if (video.volume < 1) {
            video.volume = Math.min(1, video.volume + 0.05);
          } else if (fadeInTimer.current) {
            clearInterval(fadeInTimer.current);
            fadeInTimer.current = null;
          }
        }, 100);
      })();
    }
  }, [triggered]);

  // Shared function to stop holding
  const stopHold = useCallback(() => {
    if (triggered) return;

    holdIntentRef.current = false;
    
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }

    if (fadeInTimer.current) {
      clearInterval(fadeInTimer.current);
      fadeInTimer.current = null;
    }

    setHoldProgress(0);

    if (filterRef.current && audioCtxRef.current) {
      filterRef.current.frequency.setValueAtTime(2000, audioCtxRef.current.currentTime);
    }

    const video = document.getElementById("tv-video") as HTMLVideoElement | null;
    if (video) {
      video.pause();
      video.muted = true;
      video.volume = 0;
    }
  }, [triggered]);

  // Handle mobile touch events
  const handleTouchStart = useCallback(async (e: React.TouchEvent) => {
    if (triggered || holdTimer.current) return;
    
    e.preventDefault();
    setIsSpacePressed(true);
    startHold();
  }, [startHold, triggered]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (triggered) return;

    e.preventDefault();
    setIsSpacePressed(false);
    stopHold();
  }, [stopHold, triggered]);

  const handleTouchCancel = useCallback((e: React.TouchEvent) => {
    if (triggered) return;

    e.preventDefault();
    setIsSpacePressed(false);
    stopHold();
  }, [stopHold, triggered]);

  // Handle spacebar key press and release
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code === "Space" && !triggered && !holdTimer.current) {
        e.preventDefault();
        setIsSpacePressed(true);
        await startHold();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && !triggered) {
        e.preventDefault();
        setIsSpacePressed(false);
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
    <main className="relative h-[100dvh] min-h-[100dvh] flex items-center justify-center bg-[#0E0E10] overflow-hidden">
      {/* Optional sign-in control */}
      {!isAuthLoading && (
        <div className="fixed top-4 right-3 sm:right-6 z-[60] flex flex-col items-end gap-2">
          {token && user ? (
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-xs sm:text-sm hidden sm:inline">{user.name}</span>
              <button
                onClick={logout}
                className="text-xs sm:text-sm underline hover:text-white transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <>
              <GoogleLogin
                onSuccess={(cred) => {
                  setSignInError("");
                  if (cred.credential) {
                    loginWithCredential(cred.credential).catch((err) => {
                      console.error("Sign-in error:", err);
                      setSignInError(err?.message || "Sign-in failed. Please try again.");
                    });
                  }
                }}
                onError={() => setSignInError("Google sign-in was cancelled or failed.")}
                theme="filled_black"
                shape="pill"
                text="signin_with"
              />
              {signInError && <p className="text-red-400 text-xs max-w-52 text-right">{signInError}</p>}
            </>
          )}
        </div>
      )}

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
        >
          {!isVideoLoading && !zoomed && (
            <motion.div
              className="w-full px-2 sm:px-4"
              animate={{
                opacity: hold ? 0 : 1,
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              <h1
                className="font-extrabold mb-2 select-none flex justify-center whitespace-nowrap leading-none"
                style={{ fontSize: isMobile ? 'clamp(2rem, 11vw, 3.2rem)' : 'clamp(1.8rem, 7.2vw, 7.2rem)' }}
              >
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
                className="text-gray-300 mx-auto max-w-full"
                style={{ fontSize: isMobile ? 'clamp(0.68rem, 3vw, 0.9rem)' : 'clamp(0.75rem, 1.5vw, 1rem)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                Test how wide your music pallete is.
              </motion.p>
            </motion.div>
          )}
          {zoomed && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col gap-2.5 sm:gap-6 md:gap-8"
              style={{
                alignItems: isMobile ? 'flex-end' : 'flex-end',
                width: isMobile ? 'auto' : 'auto',
              }}
            >
              <Link href="/game?mode=all" className={isMobile ? "block w-full" : "block"}>
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-white font-bold cursor-pointer select-none whitespace-nowrap"
                  style={{
                    ...menuButtonStyle,
                    fontSize: isMobile ? 'clamp(0.85rem, 4.35vw, 1.25rem)' : 'clamp(1rem, 3vw, 2.5rem)',
                    letterSpacing: isMobile ? '1px' : menuButtonStyle.letterSpacing,
                    textAlign: isMobile ? 'right' : 'right',
                  }}
                >
                  PLAY ALL
                </motion.div>
              </Link>
              <Link href="/game?mode=post00s" className={isMobile ? "block w-full" : "block"}>
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-white font-bold cursor-pointer select-none whitespace-nowrap"
                  style={{
                    ...menuButtonStyle,
                    fontSize: isMobile ? 'clamp(0.85rem, 4.35vw, 1.25rem)' : 'clamp(1rem, 3vw, 2.5rem)',
                    letterSpacing: isMobile ? '1px' : menuButtonStyle.letterSpacing,
                    textAlign: isMobile ? 'right' : 'right',
                  }}
                >
                  PLAY POST 00s
                </motion.div>
              </Link>
              <Link href="/stats" className={isMobile ? "block w-full" : "block"}>
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-white font-bold cursor-pointer select-none whitespace-nowrap"
                  style={{
                    ...menuButtonStyle,
                    fontSize: isMobile ? 'clamp(0.85rem, 4.35vw, 1.25rem)' : 'clamp(1rem, 3vw, 2.5rem)',
                    letterSpacing: isMobile ? '1px' : menuButtonStyle.letterSpacing,
                    textAlign: isMobile ? 'right' : 'right',
                  }}
                >
                  USER STATS
                </motion.div>
              </Link>
            </motion.div>
          )}
        </TVWithVideo>
      </div>

      {/* --- SPACEBAR INSTRUCTION + ENTER BUTTON --- */}
      {!isVideoLoading && !zoomed && !triggered && (
        <motion.div
          className="absolute z-20 text-center px-4 sm:px-6 text-white left-1/2 w-full max-w-[90vw]"
          style={{
            bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 1rem)' : 'clamp(1rem, 5vh, 3rem)',
            transform: 'translateX(-50%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
        >
          <div className="text-gray-400 px-4 text-center flex items-center justify-center gap-2 flex-wrap" style={{ fontSize: 'clamp(0.625rem, 1.2vw, 0.875rem)' }}>
            Hold{" "}
            <Spacebar
              pressed={isSpacePressed}
              label={isMobile ? 'Here' : undefined}
              onMouseDown={isMobile ? undefined : async (e) => {
                if (!triggered) {
                  e.preventDefault();
                  setIsSpacePressed(true);
                  await startHold();
                }
              }}
              onMouseUp={isMobile ? undefined : (e) => {
                if (!triggered) {
                  e.preventDefault();
                  setIsSpacePressed(false);
                  stopHold();
                }
              }}
              onMouseLeave={isMobile ? undefined : (e) => {
                if (!triggered) {
                  e.preventDefault();
                  setIsSpacePressed(false);
                  stopHold();
                }
              }}
              onTouchStart={isMobile ? handleTouchStart : undefined}
              onTouchEnd={isMobile ? handleTouchEnd : undefined}
              onTouchCancel={isMobile ? handleTouchCancel : undefined}
              className="touch-none"
              style={{
                minWidth: isMobile ? 'clamp(150px, 24vw, 225px)' : 'clamp(150px, 19.5vw, 225px)',
                minHeight: isMobile ? 'clamp(30px, 4.5vw, 39px)' : 'clamp(21px, 2.4vw, 27px)',
                padding: isMobile
                  ? 'clamp(0.3rem, 0.9vw, 0.45rem) clamp(1.5rem, 3.75vw, 2.25rem)'
                  : 'clamp(0.15rem, 0.45vw, 0.3rem) clamp(1.125rem, 2.25vw, 1.875rem)',
                fontSize: isMobile
                  ? 'clamp(0.9375rem, 1.95vw, 1.125rem)'
                  : 'clamp(0.75rem, 1.2vw, 0.9375rem)',
              }}
              overlay={
                <span
                  className="absolute inset-0 rounded-full bg-white pointer-events-none"
                  style={{
                    clipPath: `inset(0 ${(1 - holdProgress) * 100}% 0 0)`,
                  }}
                />
              }
            />{" "}
            to charge and enter.
          </div>
        </motion.div>
      )}
    </main>
  );
}
