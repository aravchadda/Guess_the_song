"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import TVWithVideo from "@/components/TVWithVideo";
import Spacebar from "@/components/Spacebar";
import SignInPrompt from "@/components/SignInPrompt";
import { useAuth } from "@/lib/auth";
import { getFilterOptions } from "@/lib/api";
import type { FilterOptions } from "@/lib/api";

// List of all videos in compressed folder
const videos = [
  "/compressed/ariana.mp4",
  "/compressed/bad-bunny.mp4",
  "/compressed/clairo.mp4",
  "/compressed/fred.mp4",
  "/compressed/hard-times.mp4",
  "/compressed/kendrick.mp4",
  "/compressed/marias.mp4",
  "/compressed/ode-to-the-mets.mp4",
  "/compressed/robbers.mp4",
  "/compressed/royals.mp4",
  "/compressed/single-ladies.mp4",
  "/compressed/skyline.mp4",
  "/compressed/tame-impala.mp4",
  "/compressed/tum-ho-toh.mp4",
  "/compressed/tylor.mp4",
];

const fallbackFilterOptions: FilterOptions = {
  genres: ['Hindi', 'Hip-Hop', 'Pop', 'R&B', 'Rock'],
  decades: [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020],
};

const COMBINED_EARLY_DECADE_CUTOFF = 1970;
const TV_AUDIO_HOLD_DURATION_MS = 2000;

function HomeContent(): JSX.Element {
  const searchParams = useSearchParams();
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
  const [categoryStep, setCategoryStep] = useState<'root' | 'category' | 'genre' | 'decade'>('root');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(fallbackFilterOptions);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedDecades, setSelectedDecades] = useState<number[]>([]);
  const [showCategorySignInPrompt, setShowCategorySignInPrompt] = useState(false);
  const [skipIntroAnimation, setSkipIntroAnimation] = useState(false);
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const holdIntentRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const lowpassFilterRef = useRef<BiquadFilterNode | null>(null);
  const highpassFilterRef = useRef<BiquadFilterNode | null>(null);
  const highShelfFilterRef = useRef<BiquadFilterNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const setTvAudioQuality = useCallback((progress: number) => {
    const ctx = audioCtxRef.current;
    const lowpass = lowpassFilterRef.current;
    const highpass = highpassFilterRef.current;
    const highShelf = highShelfFilterRef.current;
    const gain = gainNodeRef.current;
    if (!ctx || !lowpass || !highpass || !highShelf || !gain) return;

    const easedProgress = 1 - Math.pow(1 - Math.min(Math.max(progress, 0), 1), 2);
    const now = ctx.currentTime;

    lowpass.frequency.setTargetAtTime(850 + easedProgress * 17150, now, 0.045);
    highpass.frequency.setTargetAtTime(220 - easedProgress * 200, now, 0.045);
    highShelf.gain.setTargetAtTime(-12 + easedProgress * 18, now, 0.045);
    gain.gain.setTargetAtTime(0.24 + easedProgress * 0.76, now, 0.045);
  }, []);

  const ensureTvAudio = useCallback((video: HTMLVideoElement) => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContextCtor();
    }

    if (!mediaSourceRef.current) {
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaElementSource(video);
      const highpass = ctx.createBiquadFilter();
      const lowpass = ctx.createBiquadFilter();
      const highShelf = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      highpass.type = "highpass";
      lowpass.type = "lowpass";
      highShelf.type = "highshelf";
      highShelf.frequency.value = 3200;

      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(highShelf);
      highShelf.connect(gain);
      gain.connect(ctx.destination);

      mediaSourceRef.current = source;
      highpassFilterRef.current = highpass;
      lowpassFilterRef.current = lowpass;
      highShelfFilterRef.current = highShelf;
      gainNodeRef.current = gain;
      setTvAudioQuality(0);
    }

    return audioCtxRef.current;
  }, [setTvAudioQuality]);

  useEffect(() => {
    if (searchParams.get('menu') !== '1') return;

    setSkipIntroAnimation(true);
    setTriggered(true);
    setHold(true);
    setZoomed(true);
    setHoldProgress(1);
    setIsVideoLoading(false);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    getFilterOptions()
      .then((options) => {
        if (!cancelled) setFilterOptions(options);
      })
      .catch(() => {
        // Keep the static options usable if the backend is not running yet.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token || !showCategorySignInPrompt) return;
    setShowCategorySignInPrompt(false);
    setCategoryStep('category');
  }, [showCategorySignInPrompt, token]);

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
    setHoldProgress(0.001);
    setTvAudioQuality(0);

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
      const progress = Math.min(elapsed / TV_AUDIO_HOLD_DURATION_MS, 1);
      setHoldProgress(progress);
      setTvAudioQuality(progress);

      if (progress >= 1) {
        clearInterval(holdTimer.current!);
        holdTimer.current = null;
        
        setTriggered(true);
        setHold(true);

        setTvAudioQuality(1);

        // Start zoom animation
        setTimeout(() => {
          setZoomed(true);
        }, 3500);
      }
    }, 20);

    const startAudio = () => {
      if (!video || !holdIntentRef.current || triggered) return;

      void (async () => {
        video.muted = false;
        video.volume = 1;

        const audioCtx = ensureTvAudio(video);
        setTvAudioQuality(0);

        const resumeAudio = audioCtx
          ? audioCtx.resume().catch((err) => {
              console.log("Audio resume error:", err);
            })
          : Promise.resolve();
        const playVideo = video.play().catch((err) => {
          console.log("Playback error:", err);
        });

        await Promise.all([resumeAudio, playVideo]);

        if (!holdIntentRef.current || triggered) {
          setTvAudioQuality(triggered ? 1 : 0);
          return;
        }
      })();
    };

    startAudio();
  }, [ensureTvAudio, setTvAudioQuality, triggered]);

  // Shared function to stop holding
  const stopHold = useCallback(() => {
    if (triggered) return;

    holdIntentRef.current = false;
    
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }

    setHoldProgress(0);
    setTvAudioQuality(0);

    const video = document.getElementById("tv-video") as HTMLVideoElement | null;
    if (video) {
      video.muted = false;
      video.volume = 1;
      void video.play().catch((err) => {
        console.log("Playback error:", err);
      });
    }
  }, [setTvAudioQuality, triggered]);

  useEffect(() => {
    if (!skipIntroAnimation || isVideoLoading) return;

    const video = document.getElementById("tv-video") as HTMLVideoElement | null;
    if (!video) return;

    holdIntentRef.current = true;
    video.muted = false;
    video.volume = 1;

    void (async () => {
      const audioCtx = ensureTvAudio(video);
      setTvAudioQuality(1);

      await audioCtx?.resume().catch((err) => {
        console.log("Audio resume error:", err);
      });

      await video.play().catch((err) => {
        console.log("Playback error:", err);
      });
    })();
  }, [ensureTvAudio, isVideoLoading, setTvAudioQuality, skipIntroAnimation]);

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

  const menuItemStyle = {
    ...menuButtonStyle,
    fontSize: isMobile ? 'clamp(0.85rem, 4.35vw, 1.25rem)' : 'clamp(1rem, 3vw, 2.5rem)',
    letterSpacing: isMobile ? '1px' : menuButtonStyle.letterSpacing,
    textAlign: isMobile ? 'right' as const : 'right' as const,
  };

  const menuMotionProps = {
    whileHover: { scale: 1.08 },
    whileTap: { scale: 0.95 },
    className: "text-white font-bold cursor-pointer select-none whitespace-nowrap",
    style: menuItemStyle,
  };

  const optionMenuItemStyle = {
    ...menuButtonStyle,
    fontSize: isMobile ? 'clamp(0.78rem, 3.55vw, 1.08rem)' : 'clamp(0.9rem, 2.2vw, 1.65rem)',
    letterSpacing: isMobile ? '1px' : menuButtonStyle.letterSpacing,
    textAlign: 'center' as const,
  };

  const optionMenuMotionProps = {
    whileHover: { scale: 1.08 },
    whileTap: { scale: 0.95 },
    className: "text-white font-bold cursor-pointer select-none whitespace-nowrap leading-none",
    style: optionMenuItemStyle,
  };

  const isOptionMenu = categoryStep === 'genre' || categoryStep === 'decade';

  const handleSelectCategory = () => {
    if (!token) {
      setShowCategorySignInPrompt(true);
      return;
    }

    setCategoryStep('category');
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((current) =>
      current.includes(genre)
        ? current.filter((selected) => selected !== genre)
        : [...current, genre]
    );
  };

  const earlyDecades = filterOptions.decades.filter((decade) => decade <= COMBINED_EARLY_DECADE_CUTOFF);
  const decadeOptions = [
    ...(earlyDecades.length > 0
      ? [{ key: 'early-decades', label: '70S & BEFORE', decades: earlyDecades }]
      : []),
    ...filterOptions.decades
      .filter((decade) => decade > COMBINED_EARLY_DECADE_CUTOFF)
      .map((decade) => ({ key: String(decade), label: `${decade}S`, decades: [decade] })),
  ];

  const toggleDecadeOption = (decades: number[]) => {
    setSelectedDecades((current) => {
      const allSelected = decades.every((decade) => current.includes(decade));
      if (allSelected) {
        return current.filter((selected) => !decades.includes(selected));
      }
      return Array.from(new Set([...current, ...decades])).sort((a, b) => a - b);
    });
  };

  const buildCategoryHref = (mode: 'genre' | 'decade') => {
    const params = new URLSearchParams({ mode });
    if (mode === 'genre') {
      params.set('genres', selectedGenres.join(','));
    } else {
      params.set('decades', selectedDecades.join(','));
    }
    return `/game?${params.toString()}`;
  };

  const genreStartDisabled = selectedGenres.length === 0;
  const decadeStartDisabled = selectedDecades.length < 2;

  const checkboxClass = (selected: boolean) =>
    [
      "relative inline-flex h-4 w-4 shrink-0 items-center justify-center border-2 sm:h-5 sm:w-5",
      selected ? "border-white bg-white" : "border-white/80 bg-black/30",
    ].join(" ");

  const checkboxInnerClass = (selected: boolean) =>
    [
      "block h-1.5 w-1.5 sm:h-2 sm:w-2",
      selected ? "bg-black" : "bg-transparent",
    ].join(" ");

  return (
    <main className="relative h-[100dvh] min-h-[100dvh] flex items-center justify-center bg-[#0E0E10] overflow-hidden">
      {showCategorySignInPrompt && !token && (
        <SignInPrompt
          message="Sign in to choose categories and save your score."
          onClose={() => setShowCategorySignInPrompt(false)}
        />
      )}

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
          skipAnimation={skipIntroAnimation}
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
                alignItems: isOptionMenu ? 'center' : 'flex-end',
                width: isOptionMenu ? '100%' : 'auto',
              }}
            >
              {categoryStep === 'root' && (
                <>
                  <Link href="/game?mode=all" className={isMobile ? "block w-full" : "block"}>
                    <motion.div {...menuMotionProps}>PLAY ALL</motion.div>
                  </Link>
                  <motion.button
                    type="button"
                    onClick={handleSelectCategory}
                    {...menuMotionProps}
                  >
                    SELECT CATEGORY
                  </motion.button>
                  <Link href="/stats" className={isMobile ? "block w-full" : "block"}>
                    <motion.div {...menuMotionProps}>USER STATS</motion.div>
                  </Link>
                </>
              )}

              {categoryStep === 'category' && (
                <>
                  <motion.button
                    type="button"
                    onClick={() => setCategoryStep('decade')}
                    {...menuMotionProps}
                  >
                    BASED ON DECADE
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setCategoryStep('genre')}
                    {...menuMotionProps}
                  >
                    BASED ON GENRE
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setCategoryStep('root')}
                    {...menuMotionProps}
                  >
                    BACK
                  </motion.button>
                </>
              )}

              {categoryStep === 'genre' && (
                <div className="flex w-full max-w-full flex-col items-center gap-4 sm:gap-5">
                  <p
                    className="w-full text-center font-bold uppercase text-white/85 select-none"
                    style={{
                      ...optionMenuItemStyle,
                      fontSize: isMobile ? 'clamp(0.58rem, 2.6vw, 0.78rem)' : 'clamp(0.62rem, 1.3vw, 0.95rem)',
                    }}
                  >
                    SELECT MULTIPLE GENRES
                  </p>
                  <div className="grid w-full max-w-[min(100%,42rem)] grid-cols-2 place-items-start gap-x-10 gap-y-6 sm:gap-x-16 sm:gap-y-8">
                    {filterOptions.genres.map((genre) => {
                      const selected = selectedGenres.includes(genre);
                      return (
                        <motion.button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          {...optionMenuMotionProps}
                          className={`${optionMenuMotionProps.className} flex min-w-[9rem] items-center gap-3 sm:min-w-[12rem] sm:gap-4`}
                          style={{ ...optionMenuItemStyle, textAlign: 'left' }}
                        >
                          <span className={checkboxClass(selected)}>
                            <span className={checkboxInnerClass(selected)} />
                          </span>
                          <span>{genre.toUpperCase()}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="flex w-full items-center justify-end gap-5 sm:gap-8">
                    {genreStartDisabled ? (
                      <motion.button
                        type="button"
                        disabled
                        {...optionMenuMotionProps}
                        className={`${optionMenuMotionProps.className} cursor-not-allowed opacity-40`}
                      >
                        START
                      </motion.button>
                    ) : (
                      <Link href={buildCategoryHref('genre')} className="block min-w-0">
                        <motion.div {...optionMenuMotionProps}>START</motion.div>
                      </Link>
                    )}

                    <motion.button
                      type="button"
                      onClick={() => setCategoryStep('category')}
                      {...optionMenuMotionProps}
                    >
                      BACK
                    </motion.button>
                  </div>
                </div>
              )}

              {categoryStep === 'decade' && (
                <div className="flex w-full max-w-full flex-col items-center gap-4 sm:gap-5">
                  <p
                    className="w-full text-center font-bold uppercase text-white/85 select-none"
                    style={{
                      ...optionMenuItemStyle,
                      fontSize: isMobile ? 'clamp(0.58rem, 2.6vw, 0.78rem)' : 'clamp(0.62rem, 1.3vw, 0.95rem)',
                    }}
                  >
                    SELECT AT LEAST TWO DECADES
                  </p>
                  <div className="grid w-full max-w-[min(100%,40rem)] grid-cols-2 place-items-start gap-x-10 gap-y-6 sm:gap-x-16 sm:gap-y-8">
                    {decadeOptions.map((option) => {
                      const selected = option.decades.every((decade) => selectedDecades.includes(decade));
                      const isEarlyDecades = option.key === 'early-decades';
                      return (
                        <motion.button
                          key={option.key}
                          type="button"
                          onClick={() => toggleDecadeOption(option.decades)}
                          {...optionMenuMotionProps}
                          className={`${optionMenuMotionProps.className} flex items-center gap-3 sm:gap-4 ${
                            isEarlyDecades
                              ? 'col-span-2 min-w-[8.5rem] justify-self-start sm:min-w-[10.5rem]'
                              : 'min-w-[8.5rem] sm:min-w-[10.5rem]'
                          }`}
                          style={{ ...optionMenuItemStyle, textAlign: 'left' }}
                        >
                          <span className={checkboxClass(selected)}>
                            <span className={checkboxInnerClass(selected)} />
                          </span>
                          <span>{option.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="flex w-full items-center justify-end gap-5 sm:gap-8">
                    {decadeStartDisabled ? (
                      <motion.button
                        type="button"
                        disabled
                        {...optionMenuMotionProps}
                        className={`${optionMenuMotionProps.className} cursor-not-allowed opacity-40`}
                      >
                        START
                      </motion.button>
                    ) : (
                      <Link href={buildCategoryHref('decade')} className="block min-w-0">
                        <motion.div {...optionMenuMotionProps}>START</motion.div>
                      </Link>
                    )}

                    <motion.button
                      type="button"
                      onClick={() => setCategoryStep('category')}
                      {...optionMenuMotionProps}
                    >
                      BACK
                    </motion.button>
                  </div>
                </div>
              )}
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
              label={isMobile ? 'Press here' : undefined}
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

export default function Home(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="relative h-[100dvh] min-h-[100dvh] flex items-center justify-center bg-[#0E0E10] overflow-hidden">
          <p className="text-white/60 text-sm uppercase tracking-widest">Loading...</p>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
