'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getAudioManager } from '@/lib/audioManager';
import { startPlay, submitGuess, skipLevel, searchSongs, API_URL } from '@/lib/api';
import type { Song, GuessResponse, SearchResult } from '@/lib/api';
import Carousel from '@/components/Carousel';
import VideoPlayer from '@/components/VideoPlayer';

// List of album cover filenames
const albumCovers = [
  '711Qha+w8GL.jpg',
  '71A7fJpiFrL.jpg',
  '71c5OjnGCCL.jpg',
  '71pq-RrrAoL.jpg',
  '71UUWHqWA9L.jpg',
  '71VRzsP3CvL._AC_UL480_.jpg',
  '815orpQOtoL.jpg',
  '81bCqW8HNvL.jpg',
  '81GH9G5ayjL.jpg',
  '81QTDhIVxvL.jpg',
  '81XiZxda-8L.jpg',
  '917K5P11YnL.jpg',
  '91eh6ApLnzL.jpg',
  '91L9kVW4nmL.jpg',
  'ab67616d000082c10a80b890ab011362fd7aa73b.jpg',
  'ab67616d000082c114b55ab26f7463fd059d9f34.jpg',
  'ab67616d000082c121ebf49b3292c3f0f575f0f5.jpg',
  'ab67616d000082c134ef8f7d06cf2fc2146f420a.jpg',
  'ab67616d000082c140c5b0a60c587bd0cee5ee0c.jpg',
  'ab67616d000082c143511b8c20112757edddc7ba.jpg',
  'ab67616d000082c151c02a77d09dfcd53c8676d0.jpg',
  'ab67616d000082c155598d2d52fc249fa166a3ca.jpg',
  'ab67616d000082c156072fea6785a3ad2d24237c.jpg',
  'ab67616d000082c18399047ff71200928f5b6508.jpg',
  'ab67616d000082c1d8a68fd3e16f7ff6932b47d9.jpg',
  'ab67616d000082c1e44963b8bb127552ac761873.jpg',
  'ab67616d000082c1e45161990e83649071399525.jpg',
  'ab67616d000082c1e6d489d359c546fea254f440.jpg',
  'ab67616d000082c1fbc71c99f9c1296c56dd51b6.jpg',
  'B1TlPSY5bKS.jpg',
  'coldplay.jpg',
  'halloffame.jpg',
];

// Convert album covers to carousel items format
const carouselItems = albumCovers.map(cover => ({
  image: `/album-covers/${encodeURIComponent(cover)}`,
  name: cover,
}));

// List of audio files for background carousel
const audioFiles = [
  "/audio/ariana.mp3",
  "/audio/bad-bunny.mp3",
  "/audio/kendrick.mp3",
  "/audio/single-ladies.mp3",
  "/audio/royals.mp3",
  "/audio/hard-times.mp3",
  "/audio/tame-impala.mp3",
];

function GamePageContent() {
  const searchParams = useSearchParams();
  const gameMode = searchParams.get('mode') || 'all'; // 'all' or 'post00s'
  
  const [showGameScreen, setShowGameScreen] = useState(false);
  const [carouselOpacity, setCarouselOpacity] = useState(1);
  const [isSpacebarHeld, setIsSpacebarHeld] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showBlackScreen, setShowBlackScreen] = useState(false);
  const [showYear, setShowYear] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [showFullGameScreen, setShowFullGameScreen] = useState(false);
  const [isGameVideoLoading, setIsGameVideoLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const spacebarHoldStartTimeRef = useRef<number | null>(null);
  const touchHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speedMultiplierRef = useRef(1); // Ref for smooth animation updates without re-renders
  const lastUIUpdateTimeRef = useRef<number>(0); // For throttling UI updates
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const overlayVideoRef = useRef<HTMLVideoElement | null>(null);
  const selectedAudioRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lowpassFilterRef = useRef<BiquadFilterNode | null>(null);
  const highpassFilterRef = useRef<BiquadFilterNode | null>(null);
  const highShelfFilterRef = useRef<BiquadFilterNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const dingSoundRef = useRef<HTMLAudioElement | null>(null);
  
  // Video refs for game screen background videos
  const onVideoRef = useRef<HTMLVideoElement | null>(null);
  const runningVideoRef = useRef<HTMLVideoElement | null>(null);
  const offVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoSequenceRef = useRef<'idle' | 'on' | 'running' | 'off'>('idle');
  
  // Video loading states
  const [videosLoaded, setVideosLoaded] = useState({
    on: false,
    running: false,
    off: false,
    overlay: false,
  });
  
  // Game state
  const [playId, setPlayId] = useState<string | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [currentLevel, setCurrentLevel] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [reveal, setReveal] = useState<GuessResponse['reveal'] | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [popupType, setPopupType] = useState<'success' | 'error'>('success');
  const [lastGuessedLevel, setLastGuessedLevel] = useState<1 | 2 | 3 | null>(null);
  
  const audioManager = useRef(getAudioManager());
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Update document attribute when game screen is shown/hidden
  useEffect(() => {
    if (showGameScreen) {
      document.documentElement.setAttribute('data-game-screen', 'true');
    } else {
      document.documentElement.removeAttribute('data-game-screen');
    }
  }, [showGameScreen]);

  // Reset lastGuessedLevel whenever level changes to ensure submissions work on new level
  useEffect(() => {
    if (showGameScreen && !isFinished) {
      setLastGuessedLevel(null);
      setReveal(null); // Clear reveal when moving to new level
    }
  }, [currentLevel, showGameScreen, isFinished]);

  // Load audio level when currentLevel changes
  useEffect(() => {
    if (song && showGameScreen && !isFinished && currentLevel) {
      // Load the current level audio if not already loaded
      audioManager.current.loadLevel(
        song.id,
        currentLevel,
        song.audio_urls,
        API_URL
      ).catch((error) => {
        console.error(`Error loading level ${currentLevel}:`, error);
      });
    }
  }, [currentLevel, song, showGameScreen, isFinished]);

  // Initialize game
  const initializeGame = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Reset level to 1
      setCurrentLevel(1);
      setLastGuessedLevel(null);
      setReveal(null);
      
      // Initialize audio context
      await audioManager.current.initialize();
      
      // Start play with appropriate mode
      const playResponse = await startPlay('random', gameMode === 'post00s' ? 2000 : undefined);
      
      setPlayId(playResponse.playId);
      setSong(playResponse.song);
      
      // Load only level1 initially
      await audioManager.current.loadLevel(
        playResponse.song.id,
        1,
        playResponse.song.audio_urls,
        API_URL
      );
      
      setIsLoading(false);
      setMessage('');
    } catch (error: any) {
      console.error('Error initializing game:', error);
      setMessage(`❌ Error: ${error.message}`);
      setIsLoading(false);
    }
  }, [gameMode]);

  const handleSkip = async () => {
    if (!playId || currentLevel === 3 || isFinished) return;
    
    try {
      const response = await skipLevel(playId);
      audioManager.current.stop();
      setIsPlaying(false);
      stopVideoSequence();
      // Use the level from backend response, or advance manually
      const nextLevel = (response.currentLevel || currentLevel + 1) as 1 | 2 | 3;
      setCurrentLevel(nextLevel);
      setLastGuessedLevel(null);
      setReveal(null);
      setMessage('');
    } catch (error: any) {
      // If skip fails because game is finished, that's okay - just show message
      if (error.message?.includes('finished')) {
        setIsFinished(true);
        setMessage(`❌ ${error.message}`);
      } else {
        setMessage(`❌ ${error.message}`);
      }
    }
  };

  const handleGuess = async (guessText?: string) => {
    const finalGuess = guessText || guess;
    
    // Validation checks
    if (!playId || !finalGuess.trim() || isFinished) return;
    if (lastGuessedLevel === currentLevel) return; // Already guessed on this level
    
    try {
      const response = await submitGuess(playId, finalGuess.trim(), currentLevel);
      
      // Mark that we've guessed on this level
      setLastGuessedLevel(currentLevel);
      setGuess('');
      setShowSuggestions(false);
      
      if (response.correct) {
        // Correct guess - game won
        setIsCorrect(true);
        setIsFinished(true);
        setReveal(response.reveal || null);
        audioManager.current.stop();
        setIsPlaying(false);
        stopVideoSequence();
        setMessage('');
        // Show success popup
        setPopupMessage('Congrats you guessed it right');
        setPopupType('success');
        setShowPopup(true);
      } else {
        // Wrong guess
        // Show error popup
        setPopupMessage('Better luck next time');
        setPopupType('error');
        setShowPopup(true);
        
        if (currentLevel === 3) {
          // Wrong on last level (vocals) - game over
          console.log('Wrong guess on vocals - ending game', { reveal: response.reveal });
          setIsCorrect(false);
          setIsFinished(true);
          setReveal(response.reveal);
          audioManager.current.stop();
          setIsPlaying(false);
          stopVideoSequence();
          setMessage('');
        } else {
          // Wrong on drums or instruments - advance to next level
          audioManager.current.stop();
          setIsPlaying(false);
          stopVideoSequence();
          
          const nextLevel = (currentLevel + 1) as 1 | 2 | 3;
          setCurrentLevel(nextLevel);
          setLastGuessedLevel(null); // Reset for new level
          setMessage('');
        }
      }
    } catch (error: any) {
      console.error('Error submitting guess:', error);
      const errorMessage = error.message || 'Failed to submit guess';
      setLastGuessedLevel(null);
      
      // If game is already finished on backend, end it
      if (errorMessage.includes('finished')) {
        setIsFinished(true);
        setMessage(`❌ ${errorMessage}`);
      } else {
        setMessage(`❌ ${errorMessage}`);
      }
    }
  };

  const handleSearchChange = async (value: string) => {
    setGuess(value);
    
    if (value.length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }
    
    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchSongs(value);
        setSearchResults(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error('Search error:', error);
      }
    }, 300);
  };

  const handleSuggestionClick = (hint: string) => {
    setGuess(hint);
    setShowSuggestions(false);
    handleGuess(hint);
  };

  const handleNext = () => {
    // Reset game state
    audioManager.current.clear();
    setPlayId(null);
    setSong(null);
    setCurrentLevel(1);
    setIsPlaying(false);
    setGuess('');
    setMessage('');
    setIsCorrect(false);
    setIsFinished(false);
    setReveal(null);
    setSearchResults([]);
    setShowSuggestions(false);
    setLastGuessedLevel(null);
    
    // Stop video sequence
    stopVideoSequence();
    
    // Reset carousel state
    setIsSpacebarHeld(false);
    speedMultiplierRef.current = 1;
    setSpeedMultiplier(1);
    setHoldProgress(0);
    spacebarHoldStartTimeRef.current = null;
    
    // Reset animation sequence states
    setShowBlackScreen(false);
    setShowYear(false);
    setShowViews(false);
    setShowFullGameScreen(false);
    
    // Fade in carousel and hide game screen
    setCarouselOpacity(1);
    setShowGameScreen(false);
  };

  // Function to immediately cut to game screen with animation sequence
  const cutToGameScreen = useCallback(() => {
    if (showGameScreen) return;
    
    // Start animation sequence
    setShowGameScreen(true);
    setCarouselOpacity(0);
    setShowBlackScreen(true);
    initializeGame();
    
    // Sequence: black screen -> year -> views -> full game screen
    setTimeout(() => {
      setShowYear(true);
    }, 300);
    
    setTimeout(() => {
      setShowViews(true);
    }, 1200);
    
    setTimeout(() => {
      // Play ding sound 1 second earlier (when year appears)
      if (dingSoundRef.current) {
        // Check if audio is ready
        if (dingSoundRef.current.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          dingSoundRef.current.currentTime = 0;
          dingSoundRef.current.play().catch(err => {
            console.error('Error playing ding sound:', err);
            console.error('Audio state:', {
              readyState: dingSoundRef.current?.readyState,
              networkState: dingSoundRef.current?.networkState,
              error: dingSoundRef.current?.error,
              src: dingSoundRef.current?.src
            });
          });
        } else {
          // Wait for audio to be ready
          const playWhenReady = () => {
            if (dingSoundRef.current && dingSoundRef.current.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
              dingSoundRef.current.currentTime = 0;
              dingSoundRef.current.play().catch(err => {
                console.error('Error playing ding sound after waiting:', err);
              });
              dingSoundRef.current.removeEventListener('canplay', playWhenReady);
            }
          };
          dingSoundRef.current.addEventListener('canplay', playWhenReady);
          // Fallback: try to load again if not ready
          if (dingSoundRef.current.readyState === HTMLMediaElement.HAVE_NOTHING) {
            dingSoundRef.current.load();
          }
        }
      }
    }, 200);
    
    setTimeout(() => {
      setShowFullGameScreen(true);
      // Hide black screen when game screen fades in
      setTimeout(() => {
        setShowBlackScreen(false);
      }, 100);
    }, 2000);
  }, [showGameScreen, initializeGame]);

  // Preload video with proper buffering
  const preloadVideo = useCallback((video: HTMLVideoElement, src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (video.readyState >= 3) { // HAVE_FUTURE_DATA
        resolve();
        return;
      }

      const handleCanPlayThrough = () => {
        video.removeEventListener('canplaythrough', handleCanPlayThrough);
        video.removeEventListener('error', handleError);
        resolve();
      };

      const handleError = () => {
        video.removeEventListener('canplaythrough', handleCanPlayThrough);
        video.removeEventListener('error', handleError);
        reject(new Error(`Failed to load video: ${src}`));
      };

      video.addEventListener('canplaythrough', handleCanPlayThrough, { once: true });
      video.addEventListener('error', handleError, { once: true });
      
      if (video.src !== src) {
        video.src = src;
      }
      
      video.load();
    });
  }, []);

  // Handle video sequence for game screen background
  const startVideoSequence = useCallback(async () => {
    if (!onVideoRef.current || !runningVideoRef.current) return;
    
    // Stop all videos first
    if (runningVideoRef.current) {
      runningVideoRef.current.pause();
      runningVideoRef.current.currentTime = 0;
    }
    if (offVideoRef.current) {
      offVideoRef.current.pause();
      offVideoRef.current.currentTime = 0;
    }
    
    // Hide running and off videos
    if (runningVideoRef.current) {
      runningVideoRef.current.style.display = 'none';
    }
    if (offVideoRef.current) {
      offVideoRef.current.style.display = 'none';
    }
    
    // Ensure on video is loaded before playing
    try {
      if (!videosLoaded.on && onVideoRef.current) {
        await preloadVideo(onVideoRef.current, '/on.mp4');
        setVideosLoaded(prev => ({ ...prev, on: true }));
      }
    } catch (err) {
      console.error('Error preloading on video:', err);
    }
    
    // Show and play on video
    if (onVideoRef.current) {
      onVideoRef.current.style.display = 'block';
      onVideoRef.current.currentTime = 0;
      videoSequenceRef.current = 'on';
      
      // Preload running video in background while on video plays
      if (runningVideoRef.current && !videosLoaded.running) {
        preloadVideo(runningVideoRef.current, '/running.mp4')
          .then(() => setVideosLoaded(prev => ({ ...prev, running: true })))
          .catch(err => console.error('Error preloading running video:', err));
      }
      
      try {
        await onVideoRef.current.play();
      } catch (err) {
        console.log('Error playing on video:', err);
      }
    }
    
    // When on video ends, switch to running video
    const handleOnVideoEnd = async () => {
      if (!onVideoRef.current || !runningVideoRef.current) return;
      
      // Ensure running video is loaded
      try {
        if (!videosLoaded.running) {
          await preloadVideo(runningVideoRef.current, '/running.mp4');
          setVideosLoaded(prev => ({ ...prev, running: true }));
        }
      } catch (err) {
        console.error('Error preloading running video:', err);
      }
      
      onVideoRef.current.style.display = 'none';
      runningVideoRef.current.style.display = 'block';
      runningVideoRef.current.currentTime = 0;
      videoSequenceRef.current = 'running';
      
      try {
        await runningVideoRef.current.play();
      } catch (err) {
        console.log('Error playing running video:', err);
      }
      
      onVideoRef.current.removeEventListener('ended', handleOnVideoEnd);
    };
    
    if (onVideoRef.current) {
      onVideoRef.current.addEventListener('ended', handleOnVideoEnd, { once: true });
    }
  }, [videosLoaded, preloadVideo]);

  const stopVideoSequence = useCallback(async () => {
    if (!onVideoRef.current || !runningVideoRef.current || !offVideoRef.current) return;
    
    // Stop running video
    if (runningVideoRef.current) {
      runningVideoRef.current.pause();
      runningVideoRef.current.currentTime = 0;
      runningVideoRef.current.style.display = 'none';
    }
    
    // Stop and hide on video
    if (onVideoRef.current) {
      onVideoRef.current.pause();
      onVideoRef.current.currentTime = 0;
      onVideoRef.current.style.display = 'none';
    }
    
    // Ensure off video is loaded before playing
    try {
      if (!videosLoaded.off && offVideoRef.current) {
        await preloadVideo(offVideoRef.current, '/off.mp4');
        setVideosLoaded(prev => ({ ...prev, off: true }));
      }
    } catch (err) {
      console.error('Error preloading off video:', err);
    }
    
    // Show and play off video
    if (offVideoRef.current) {
      offVideoRef.current.style.display = 'block';
      offVideoRef.current.currentTime = 0;
      videoSequenceRef.current = 'off';
      
      try {
        await offVideoRef.current.play();
      } catch (err) {
        console.log('Error playing off video:', err);
      }
    }
    
    // When off video ends, show first frame of on video
    const handleOffVideoEnd = async () => {
      if (!onVideoRef.current || !offVideoRef.current) return;
      
      // Ensure on video is ready
      try {
        if (!videosLoaded.on && onVideoRef.current) {
          await preloadVideo(onVideoRef.current, '/on.mp4');
          setVideosLoaded(prev => ({ ...prev, on: true }));
        }
      } catch (err) {
        console.error('Error preloading on video:', err);
      }
      
      offVideoRef.current.style.display = 'none';
      if (onVideoRef.current) {
        onVideoRef.current.style.display = 'block';
        onVideoRef.current.currentTime = 0;
        onVideoRef.current.pause(); // Pause at first frame
      }
      videoSequenceRef.current = 'idle';
      
      offVideoRef.current.removeEventListener('ended', handleOffVideoEnd);
    };
    
    if (offVideoRef.current) {
      offVideoRef.current.addEventListener('ended', handleOffVideoEnd, { once: true });
    }
  }, [videosLoaded, preloadVideo]);

  const handlePlay = useCallback(() => {
    if (!song) return;
    
    if (isPlaying) {
      audioManager.current.stop();
      setIsPlaying(false);
      stopVideoSequence();
    } else {
      audioManager.current.play(song.id, currentLevel);
      setIsPlaying(true);
      const levelNames = ['', 'drums', 'Instruments', 'vocals'];
      setMessage(`🎵 Playing ${levelNames[currentLevel]}...`);
      startVideoSequence();
    }
  }, [song, isPlaying, currentLevel, stopVideoSequence, startVideoSequence]);

  // Function to return to carousel from game screen
  const returnToCarousel = useCallback(() => {
    if (!showGameScreen) return;
    
    // Reset game state
    audioManager.current.clear();
    setPlayId(null);
    setSong(null);
    setCurrentLevel(1);
    setIsPlaying(false);
    setGuess('');
    setMessage('');
    setIsCorrect(false);
    setIsFinished(false);
    setReveal(null);
    setSearchResults([]);
    setShowSuggestions(false);
    setLastGuessedLevel(null);
    
    // Stop video sequence
    stopVideoSequence();
    
    // Reset animation sequence states
    setShowBlackScreen(false);
    setShowYear(false);
    setShowViews(false);
    setShowFullGameScreen(false);
    
    // Reset carousel state
    setIsSpacebarHeld(false);
    speedMultiplierRef.current = 1;
    setSpeedMultiplier(1);
    setHoldProgress(0);
    spacebarHoldStartTimeRef.current = null;
    
    // Hide game screen first, then fade in carousel
    setShowGameScreen(false);
    // Small delay to allow game screen to start fading out
    setTimeout(() => {
      setCarouselOpacity(1);
    }, 100);
  }, [showGameScreen, stopVideoSequence]);

  // Handle speed acceleration while spacebar is held
  useEffect(() => {
    // Cleanup any existing animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (!isSpacebarHeld || showGameScreen) {
      speedMultiplierRef.current = 1;
      setSpeedMultiplier(1);
      setHoldProgress(0);
      lastUIUpdateTimeRef.current = 0;
      spacebarHoldStartTimeRef.current = null;
      // Reset filters to play lows by default when spacebar is released
      if (lowpassFilterRef.current && highpassFilterRef.current && highShelfFilterRef.current && gainNodeRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const now = ctx.currentTime;
        lowpassFilterRef.current.frequency.setValueAtTime(500, now);
        highpassFilterRef.current.frequency.setValueAtTime(20, now); // Very low to allow all frequencies
        highShelfFilterRef.current.gain.setValueAtTime(0, now); // No high boost
        gainNodeRef.current.gain.setValueAtTime(1, now); // Normal gain
      }
      // Reset audio volume to default
      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.volume = 0.3;
      }
      return;
    }

    // Set start time if not already set
    if (spacebarHoldStartTimeRef.current === null) {
      spacebarHoldStartTimeRef.current = Date.now();
    }

    const startTime = spacebarHoldStartTimeRef.current;
    let isRunning = true;

    const updateSpeed = () => {
      if (!isRunning || !isSpacebarHeld || showGameScreen || spacebarHoldStartTimeRef.current === null) {
        speedMultiplierRef.current = 1;
        setSpeedMultiplier(1);
        setHoldProgress(0);
        lastUIUpdateTimeRef.current = 0;
        animationFrameRef.current = null;
        // Reset filters to play lows by default
        if (lowpassFilterRef.current && highpassFilterRef.current && highShelfFilterRef.current && gainNodeRef.current && audioCtxRef.current) {
          const ctx = audioCtxRef.current;
          const now = ctx.currentTime;
          lowpassFilterRef.current.frequency.setValueAtTime(500, now);
          highpassFilterRef.current.frequency.setValueAtTime(20, now);
          highShelfFilterRef.current.gain.setValueAtTime(0, now);
          gainNodeRef.current.gain.setValueAtTime(1, now);
        }
        // Reset audio volume to default
        if (backgroundAudioRef.current) {
          backgroundAudioRef.current.volume = 0.3;
        }
        return;
      }

      const elapsed = (Date.now() - startTime) / 1000; // in seconds
      // Update hold progress: reaches 100% after 2 seconds
      const progress = Math.min(elapsed / 2, 1);
      
      // Accelerate: speed increases linearly and reaches max value in 2 seconds
      const maxMultiplier = 15;
      const newMultiplier = 1 + (maxMultiplier - 1) * progress; // Linear from 1 to maxMultiplier over 2 seconds
      
      // Update ref immediately for smooth animation (no re-render)
      speedMultiplierRef.current = newMultiplier;
      
      // Throttle state updates for UI (progress bar) - only update every 100ms to reduce re-renders
      const now = Date.now();
      if (now - lastUIUpdateTimeRef.current >= 100) {
        setHoldProgress(progress);
      setSpeedMultiplier(newMultiplier);
        lastUIUpdateTimeRef.current = now;
      }
      
      // Update audio filters: transition from lows only to everything with amplified highs
      // Lowpass filter increases to allow all frequencies
      // High shelf filter boosts highs while keeping all frequencies
      if (lowpassFilterRef.current && highpassFilterRef.current && highShelfFilterRef.current && gainNodeRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const now = ctx.currentTime;
        
        // Lowpass filter: increase from 500Hz (lows only) to 20000Hz (all frequencies)
        const lowpassFreq = 500 + progress * 19500; // 500Hz to 20000Hz
        lowpassFilterRef.current.frequency.setValueAtTime(
          Math.min(lowpassFreq, 20000),
          now
        );
        
        // Highpass filter: keep at 20Hz (allows all frequencies to pass through)
        highpassFilterRef.current.frequency.setValueAtTime(20, now);
        
        // High shelf filter: boost highs - escalate from 0dB to +12dB
        // This amplifies highs while keeping all frequencies
        const highShelfGain = progress * 12; // 0dB to 12dB boost
        highShelfFilterRef.current.gain.setValueAtTime(highShelfGain, now);
        
        // Gain: slight overall amplification - escalate from 1x to 1.5x
        const gainValue = 1 + progress * 0.5; // 1x to 1.5x amplification
        gainNodeRef.current.gain.setValueAtTime(gainValue, now);
      }
      
      // Increase audio volume as filter goes higher - escalate from 0.3 to 0.8
      if (backgroundAudioRef.current) {
        const volumeValue = 0.3 + progress * 0.5; // 0.3 to 0.8 (30% to 80%)
        backgroundAudioRef.current.volume = Math.min(volumeValue, 1);
      }

      animationFrameRef.current = requestAnimationFrame(updateSpeed);
    };

    animationFrameRef.current = requestAnimationFrame(updateSpeed);

    return () => {
      isRunning = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isSpacebarHeld, showGameScreen]);

<<<<<<< Updated upstream
<<<<<<< Updated upstream
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

  // Handle mobile touch events for space button
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (showGameScreen) {
      returnToCarousel();
      return;
    }
    
    e.preventDefault();
    setIsSpacebarHeld(true);
    spacebarHoldStartTimeRef.current = Date.now();
    
    // Start progress animation
    const startTime = Date.now();
    const updateProgress = () => {
      if (spacebarHoldStartTimeRef.current) {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / 2, 1);
        setHoldProgress(progress);
        
        if (progress < 1 && spacebarHoldStartTimeRef.current) {
          requestAnimationFrame(updateProgress);
        } else if (progress >= 1) {
          // 2 seconds passed, transition to game
          cutToGameScreen();
          setIsSpacebarHeld(false);
          spacebarHoldStartTimeRef.current = null;
          setHoldProgress(0);
        }
      }
    };
    updateProgress();
  }, [showGameScreen, cutToGameScreen, returnToCarousel]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (showGameScreen) return;
    
    e.preventDefault();
=======
=======
>>>>>>> Stashed changes
  // Helper function to start holding (for carousel)
  const startCarouselHold = useCallback(() => {
    if (showGameScreen) return;
    setIsSpacebarHeld(true);
  }, [showGameScreen]);

  // Helper function to stop holding and check if should transition
  const stopCarouselHold = useCallback(() => {
    if (showGameScreen || !isSpacebarHeld) return;
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
    
    // Check if 2 seconds have passed
    const elapsed = spacebarHoldStartTimeRef.current 
      ? (Date.now() - spacebarHoldStartTimeRef.current) / 1000 
      : 0;
    const hasHeldFor2Seconds = elapsed >= 2;
    
    // Reset speed and progress
    speedMultiplierRef.current = 1;
    setSpeedMultiplier(1);
    setHoldProgress(0);
    spacebarHoldStartTimeRef.current = null;
    setIsSpacebarHeld(false);
    
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    // Reset filters to play lows by default when released
=======
    // Reset filters to play lows by default when spacebar is released
>>>>>>> Stashed changes
=======
    // Reset filters to play lows by default when spacebar is released
>>>>>>> Stashed changes
    if (lowpassFilterRef.current && highpassFilterRef.current && highShelfFilterRef.current && gainNodeRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      lowpassFilterRef.current.frequency.setValueAtTime(500, now);
      highpassFilterRef.current.frequency.setValueAtTime(20, now);
      highShelfFilterRef.current.gain.setValueAtTime(0, now);
      gainNodeRef.current.gain.setValueAtTime(1, now);
    }
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    // Reset audio volume to default
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.volume = 0.3;
=======
    // Reset video volume to default
    if (backgroundVideoRef.current) {
      backgroundVideoRef.current.volume = 0.3;
>>>>>>> Stashed changes
=======
    // Reset video volume to default
    if (backgroundVideoRef.current) {
      backgroundVideoRef.current.volume = 0.3;
>>>>>>> Stashed changes
    }
    
    // Only transition to game screen if held for 2 seconds
    if (hasHeldFor2Seconds) {
      cutToGameScreen();
    }
<<<<<<< Updated upstream
<<<<<<< Updated upstream
  }, [showGameScreen, cutToGameScreen]);
=======
  }, [showGameScreen, isSpacebarHeld, cutToGameScreen]);
>>>>>>> Stashed changes
=======
  }, [showGameScreen, isSpacebarHeld, cutToGameScreen]);
>>>>>>> Stashed changes

  // Handle spacebar key press and release
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        // Don't trigger if user is typing in an input field
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true'
        );
        
        if (isInputFocused) {
          return; // Allow normal spacebar behavior in input fields
        }
        
        e.preventDefault();
        
        if (showGameScreen) {
          // If on game screen, return to carousel
          returnToCarousel();
        } else {
          // If on carousel, start holding
          startCarouselHold();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !showGameScreen && isSpacebarHeld) {
        // Don't trigger if user is typing in an input field
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true'
        );
        
        if (isInputFocused) {
          return; // Allow normal spacebar behavior in input fields
        }
        
        e.preventDefault();
<<<<<<< Updated upstream
<<<<<<< Updated upstream
        
        // Check if 2 seconds have passed
        const elapsed = spacebarHoldStartTimeRef.current 
          ? (Date.now() - spacebarHoldStartTimeRef.current) / 1000 
          : 0;
        const hasHeldFor2Seconds = elapsed >= 2;
        
        // Reset speed and progress
        speedMultiplierRef.current = 1;
        setSpeedMultiplier(1);
        setHoldProgress(0);
        spacebarHoldStartTimeRef.current = null;
        setIsSpacebarHeld(false);
        
      // Reset filters to play lows by default when spacebar is released
      if (lowpassFilterRef.current && highpassFilterRef.current && highShelfFilterRef.current && gainNodeRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const now = ctx.currentTime;
        lowpassFilterRef.current.frequency.setValueAtTime(500, now);
        highpassFilterRef.current.frequency.setValueAtTime(20, now);
        highShelfFilterRef.current.gain.setValueAtTime(0, now);
        gainNodeRef.current.gain.setValueAtTime(1, now);
      }
      // Reset audio volume to default
      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.volume = 0.3;
      }
        
        // Only transition to game screen if held for 2 seconds
        if (hasHeldFor2Seconds) {
        cutToGameScreen();
        }
=======
        stopCarouselHold();
>>>>>>> Stashed changes
=======
        stopCarouselHold();
>>>>>>> Stashed changes
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showGameScreen, isSpacebarHeld, startCarouselHold, stopCarouselHold, returnToCarousel]);

  // Play random audio when carousel is visible
  useEffect(() => {
    if (!showGameScreen) {
      // Stop existing audio if transitioning back to carousel
      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.pause();
        backgroundAudioRef.current.src = '';
        if (backgroundAudioRef.current.parentNode) {
          backgroundAudioRef.current.parentNode.removeChild(backgroundAudioRef.current);
        }
        backgroundAudioRef.current = null;
        selectedAudioRef.current = null;
      }
      
      // Cleanup audio context if exists
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
        lowpassFilterRef.current = null;
        highpassFilterRef.current = null;
        highShelfFilterRef.current = null;
        gainNodeRef.current = null;
      }
      
      // Select a random audio file
      const randomAudio = audioFiles[Math.floor(Math.random() * audioFiles.length)];
      selectedAudioRef.current = randomAudio;
      
      // Create audio element for playback
      const audio = document.createElement('audio');
      audio.src = randomAudio;
      audio.loop = true;
      audio.volume = 0.3; // Set volume to 30%
      document.body.appendChild(audio);
      backgroundAudioRef.current = audio;
      
      // Setup audio context & filters for low frequencies by default
      const setupAudio = async () => {
        try {
          const audioCtx = new AudioContext();
          const source = audioCtx.createMediaElementSource(audio);
          
          // Lowpass filter: allows lows (default at 500Hz to play lows only)
          const lowpassFilter = audioCtx.createBiquadFilter();
          lowpassFilter.type = "lowpass";
          lowpassFilter.frequency.value = 500; // Start with lows only
          
          // Highpass filter: keep at 20Hz to allow all frequencies (won't filter anything)
          const highpassFilter = audioCtx.createBiquadFilter();
          highpassFilter.type = "highpass";
          highpassFilter.frequency.value = 20; // Very low (allows all frequencies)
          
          // High shelf filter: will boost highs when spacebar is held
          const highShelfFilter = audioCtx.createBiquadFilter();
          highShelfFilter.type = "highshelf";
          highShelfFilter.frequency.value = 2000; // Boost frequencies above 2000Hz
          highShelfFilter.gain.value = 0; // No boost initially
          
          // Gain node: slight overall amplification
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = 1; // Normal gain by default
          
          // Connect: source -> lowpass -> highpass -> high shelf -> gain -> destination
          source.connect(lowpassFilter);
          lowpassFilter.connect(highpassFilter);
          highpassFilter.connect(highShelfFilter);
          highShelfFilter.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          audioCtxRef.current = audioCtx;
          lowpassFilterRef.current = lowpassFilter;
          highpassFilterRef.current = highpassFilter;
          highShelfFilterRef.current = highShelfFilter;
          gainNodeRef.current = gainNode;
          
          // Resume audio context and play audio
          await audioCtx.resume();
          await audio.play();
        } catch (err) {
          console.log('Error setting up audio:', err);
        }
      };
      
      setupAudio();
    } else {
      // Stop audio when game screen is shown
      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.pause();
      }
      // Reset filters to play lows by default when game screen is shown
      if (lowpassFilterRef.current && highpassFilterRef.current && highShelfFilterRef.current && gainNodeRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const now = ctx.currentTime;
        lowpassFilterRef.current.frequency.setValueAtTime(500, now);
        highpassFilterRef.current.frequency.setValueAtTime(20, now);
        highShelfFilterRef.current.gain.setValueAtTime(0, now);
        gainNodeRef.current.gain.setValueAtTime(1, now);
      }
    }
    
    return () => {
      // Cleanup audio when carousel is hidden or component unmounts
      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.pause();
        backgroundAudioRef.current.src = '';
        if (backgroundAudioRef.current.parentNode) {
          backgroundAudioRef.current.parentNode.removeChild(backgroundAudioRef.current);
        }
        backgroundAudioRef.current = null;
        selectedAudioRef.current = null;
      }
      // Cleanup audio context
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
        lowpassFilterRef.current = null;
        highpassFilterRef.current = null;
        highShelfFilterRef.current = null;
        gainNodeRef.current = null;
      }
    };
  }, [showGameScreen]);

  // Initialize ding sound
  useEffect(() => {
    const audio = new Audio('/ding.m4a');
    audio.preload = 'auto';
    
    // Log the audio source for debugging
    console.log('Initializing ding sound with src:', audio.src);
    
    // Add error handling
    const handleError = (e: Event) => {
      console.error('Error loading ding sound:', e);
      console.error('Audio error details:', {
        error: audio.error,
        errorCode: audio.error?.code,
        errorMessage: audio.error?.message,
        networkState: audio.networkState,
        readyState: audio.readyState,
        src: audio.src,
        currentSrc: audio.currentSrc
      });
    };
    
    // Add loaded event listener
    const handleCanPlayThrough = () => {
      console.log('Ding sound loaded and ready');
    };
    
    // Add loadstart listener
    const handleLoadStart = () => {
      console.log('Ding sound load started');
    };
    
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('loadstart', handleLoadStart);
    
    // Preload the audio to reduce delay
    audio.load();
    
    dingSoundRef.current = audio;
    
    return () => {
      if (dingSoundRef.current) {
        dingSoundRef.current.pause();
        dingSoundRef.current.removeEventListener('error', handleError);
        dingSoundRef.current.removeEventListener('canplaythrough', handleCanPlayThrough);
        dingSoundRef.current.removeEventListener('loadstart', handleLoadStart);
        dingSoundRef.current = null;
      }
    };
  }, []);

  // Control overlay video - always playing
  useEffect(() => {
    if (overlayVideoRef.current) {
      // Preload overlay video
      preloadVideo(overlayVideoRef.current, '/overlayGrain.mp4')
        .then(() => {
          setVideosLoaded(prev => ({ ...prev, overlay: true }));
          if (overlayVideoRef.current) {
            overlayVideoRef.current.play().catch(console.error);
          }
        })
        .catch(err => console.error('Error preloading overlay video:', err));
    }
  }, [preloadVideo]);

  // Auto-hide popup after 3 seconds
  useEffect(() => {
    if (showPopup) {
      const timer = setTimeout(() => {
        setShowPopup(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showPopup]);

  // Initialize game screen background videos
  useEffect(() => {
    if (showGameScreen && showFullGameScreen) {
      setIsGameVideoLoading(true);
      
      // Timeout fallback
      const timeoutId = setTimeout(() => {
        setIsGameVideoLoading(false);
        console.warn('Game video loading timeout, hiding loading screen');
      }, 10000);
      
      // Preload on video first (most important - shown initially)
      if (onVideoRef.current && !videosLoaded.on) {
        preloadVideo(onVideoRef.current, '/on.mp4')
          .then(() => {
            clearTimeout(timeoutId);
            setVideosLoaded(prev => ({ ...prev, on: true }));
            setIsGameVideoLoading(false);
            if (onVideoRef.current) {
              onVideoRef.current.currentTime = 0;
              onVideoRef.current.pause();
              onVideoRef.current.style.display = 'block';
            }
          })
          .catch(err => {
            clearTimeout(timeoutId);
            console.error('Error preloading on video:', err);
            setIsGameVideoLoading(false);
          });
      } else if (onVideoRef.current) {
        clearTimeout(timeoutId);
        setIsGameVideoLoading(false);
        onVideoRef.current.currentTime = 0;
        onVideoRef.current.pause();
        onVideoRef.current.style.display = 'block';
      } else {
        // If video ref doesn't exist, hide loading after a short delay
        setTimeout(() => {
          clearTimeout(timeoutId);
          setIsGameVideoLoading(false);
        }, 500);
      }
      
      if (runningVideoRef.current) {
        runningVideoRef.current.style.display = 'none';
      }
      if (offVideoRef.current) {
        offVideoRef.current.style.display = 'none';
      }
      videoSequenceRef.current = 'idle';
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [showGameScreen, showFullGameScreen, videosLoaded.on, preloadVideo]);

  // Watch for isPlaying changes to handle video sequence
  useEffect(() => {
    if (!showGameScreen || !showFullGameScreen) return;
    
    if (isPlaying && videoSequenceRef.current === 'idle') {
      // If playing but video is idle, start the sequence
      startVideoSequence();
    } else if (!isPlaying && (videoSequenceRef.current === 'on' || videoSequenceRef.current === 'running')) {
      // If not playing but video is running, stop the sequence
      stopVideoSequence();
    }
  }, [isPlaying, showGameScreen, showFullGameScreen, startVideoSequence, stopVideoSequence]);

  // Update playback progress while playing
  useEffect(() => {
    if (!isPlaying || !showGameScreen || !showFullGameScreen) {
      setPlaybackProgress(0);
      return;
    }

    const interval = setInterval(() => {
      const progress = audioManager.current.getProgress();
      setPlaybackProgress(progress);
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [isPlaying, showGameScreen, showFullGameScreen]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioManager.current.stop();
      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.pause();
        backgroundAudioRef.current.src = '';
        if (backgroundAudioRef.current.parentNode) {
          backgroundAudioRef.current.parentNode.removeChild(backgroundAudioRef.current);
        }
      }
      if (overlayVideoRef.current) {
        overlayVideoRef.current.pause();
      }
      if (dingSoundRef.current) {
        dingSoundRef.current.pause();
        dingSoundRef.current = null;
      }
      // Cleanup game screen videos
      if (onVideoRef.current) {
        onVideoRef.current.pause();
      }
      if (runningVideoRef.current) {
        runningVideoRef.current.pause();
      }
      if (offVideoRef.current) {
        offVideoRef.current.pause();
      }
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center overflow-hidden relative bg-black">
      {/* Static GIF Background */}
      <AnimatePresence>
        {!showGameScreen && (
          <motion.img
            src="/static.gif"
            alt="Static background"
            className="absolute inset-0 w-full h-full object-cover z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.05 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
      
      {/* Overlay Video Background - Always visible */}
      <AnimatePresence>
        <motion.video
          ref={overlayVideoRef}
          src="/overlayGrain.mp4"
          loop
          muted
          playsInline
          autoPlay
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover z-[1]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0 }}
        />
      </AnimatePresence>

      {/* Loading Screen for Game Video */}
      <AnimatePresence>
        {isGameVideoLoading && showGameScreen && showFullGameScreen && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-[3] flex items-center justify-center bg-[#0E0E10]"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-white text-sm opacity-70">Loading game...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Screen Background Videos */}
      <AnimatePresence>
        {showGameScreen && (
          <div className="absolute inset-0 w-full h-full z-[2] flex items-center justify-center">
            {/* Grouped container for video and play button - they resize together (same pattern as TVWithVideo) */}
            <div 
              className="relative"
              style={{
                width: 'clamp(300px, 65vw, 1000px)',
                maxWidth: '1000px',
                aspectRatio: '16/9', // Maintain aspect ratio like TV component
              }}
            >
              {/* Videos - positioned absolutely to fill container */}
              <div className="absolute inset-0">
                <video
                  ref={onVideoRef}
                  src="/on.mp4"
                  playsInline
                  muted
                  preload="metadata"
                  className="w-full h-full object-contain"
                  style={{ display: 'none' }}
                  onLoadedMetadata={() => {
                    if (onVideoRef.current) {
                      onVideoRef.current.currentTime = 0;
                    }
                  }}
                />
                <video
                  ref={runningVideoRef}
                  src="/running.mp4"
                  loop
                  playsInline
                  muted
                  preload="none"
                  className="w-full h-full object-contain"
                  style={{ display: 'none' }}
                />
                <video
                  ref={offVideoRef}
                  src="/off.mp4"
                  playsInline
                  muted
                  preload="none"
                  className="w-full h-full object-contain"
                  style={{ display: 'none' }}
                />
              </div>
              
              {/* Play Button - Positioned absolutely within container, scales proportionally */}
              {showFullGameScreen && (
                <button
                  onClick={handlePlay}
                  disabled={isFinished}
                  className="absolute border-2 border-white bg-transparent text-white flex items-center justify-center z-10 hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    bottom: '22%',
                    left: '22%',
                    width: 'clamp(3rem, 9%, 5rem)',
                    height: 'clamp(3rem, 9%, 5rem)',
                    borderRadius: '50%',
                  }}
                >
                  {isPlaying ? (
                    <span 
                      className="ml-1"
                      style={{
                        fontSize: 'clamp(1rem, 4%, 1.5rem)',
                      }}
                    >⏸</span>
                  ) : (
                    <span 
                      className="ml-1"
                      style={{
                        fontSize: 'clamp(1rem, 4%, 1.5rem)',
                      }}
                    >▶</span>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Progress Bar - Full width at bottom of screen */}
      {showGameScreen && isPlaying && (
        <div className="fixed bottom-0 left-0 right-0 h-1 bg-gray-700 z-30">
          <div 
            className="h-full bg-white transition-all duration-100"
            style={{ width: `${playbackProgress * 100}%` }}
          />
        </div>
      )}
      
      {/* Three-row Carousel Container */}
      <AnimatePresence>
        {!showGameScreen && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center z-10"
            initial={false}
            animate={{ opacity: carouselOpacity }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            {/* Row 1 - Top (slower, right to left) */}
            <div className="w-full absolute" style={{ top: 'calc(50vh - clamp(80px, 14vw, 300px))', transform: 'translateY(-50%)' }}>
              <Carousel 
                direction="left" 
                items={carouselItems} 
                speed={1.5}
                speedMultiplierRef={speedMultiplierRef}
              />
            </div>
            
            {/* Row 2 - Middle (normal speed, left to right) */}
            <div className="w-full absolute" style={{ top: '50vh', transform: 'translateY(-50%)' }}>
              <Carousel 
                direction="left" 
                items={carouselItems} 
                speed={1}
                speedMultiplierRef={speedMultiplierRef}
              />
            </div>
            
            {/* Row 3 - Bottom (faster, right to left) */}
            <div className="w-full absolute" style={{ top: 'calc(50vh + clamp(80px, 14vw, 300px))', transform: 'translateY(-50%)' }}>
          
              <Carousel 
                direction="left" 
                items={carouselItems} 
                speed={0.7}
                speedMultiplierRef={speedMultiplierRef}
              />
            </div>
          
          </motion.div>
        )}
      </AnimatePresence>

      {/* Black Screen Overlay */}
      <AnimatePresence>
        {showBlackScreen && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(14, 14, 16, 0.7)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0 }}
          >
            {/* Year Animation */}
            {song && showYear && (
              <motion.div
                className="absolute left-1/2 transform -translate-x-1/2"
                style={{ top: 'calc(50% - clamp(80px, 12vh, 140px))' }}
               
              >
                <p className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-white">{song.release_year}</p>
              </motion.div>
            )}
            
            {/* Views Animation */}
            {song && showViews && (
              <motion.div
                className="absolute left-1/2 transform -translate-x-1/2"
                style={{ top: 'calc(51%)'}}
               
              >
                <p className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#e2dcde]">{song.viewcount_formatted}</p>
              </motion.div>
            )}
          </motion.div>
        )} 
      </AnimatePresence>

      {/* Game Screen */}
      <AnimatePresence>
        {showGameScreen && showFullGameScreen && (
          <motion.div
            className="w-full h-full flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <div className="w-full h-full flex items-center justify-center relative">
              {/* Search bar at top of screen */}
              {!isFinished && !isCorrect && (
                <div className="fixed top-4 sm:top-6 md:top-8 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4 z-10">
                    <div className="relative">
                      <input
                        type="text"
                        value={guess}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                        placeholder="Type your guess..."
                        className="w-full px-3 py-2 border-2 border-gray-500 rounded-lg focus:border-indigo-500 focus:ring focus:ring-indigo-200 bg-gray-800 text-white text-sm"
                        disabled={isFinished || lastGuessedLevel === currentLevel}
                      />
                      
                      {/* Autocomplete Suggestions */}
                      {showSuggestions && searchResults.length > 0 && (
                        <div className="absolute z-20 w-full mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {searchResults.map((result) => (
                            <button
                              key={result.id}
                              onClick={() => handleSuggestionClick(result.hint)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-700 text-white text-sm"
                            >
                              {result.hint}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              
              {/* Song name and YouTube link at top when correct */}
              {isCorrect && reveal && (
                <div className="fixed top-4 sm:top-6 md:top-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-10 flex flex-col items-center gap-2">
                  <h2 className="text-green-500 text-xl sm:text-2xl md:text-3xl font-bold text-center">
                    {reveal.name}
                  </h2>
                  <a
                    href={reveal.youtube_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-500 text-sm sm:text-base hover:underline"
                  >
                    Watch on YouTube
                  </a>
                  </div>
                )}
                
              {/* Song name and YouTube link at top when game over (wrong on vocals) */}
              {isFinished && !isCorrect && reveal && (
                <div className="fixed top-4 sm:top-6 md:top-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-10 flex flex-col items-center gap-2">
                  <h2 className="text-red-500 text-xl sm:text-2xl md:text-3xl font-bold text-center">
                      {reveal.name}
                    </h2>
                    <a
                      href={reveal.youtube_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    className="text-red-500 text-sm sm:text-base hover:underline"
                    >
                    Watch on YouTube
                    </a>
                  </div>
                )}
                
              {/* Year - Top left corner */}
              {song && (
                <div className="fixed top-4 sm:top-6 md:top-8 left-4 sm:left-6 md:left-8 text-white z-10">
                  <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">{song.release_year}</p>
                </div>
              )}
              
              {/* Views - Top right corner */}
              {song && (
                <div className="fixed top-4 sm:top-6 md:top-8 right-4 sm:right-6 md:right-8 text-white z-10">
                  <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">{song.viewcount_formatted}</p>
                </div>
              )}
              
              {/* Video Container - Centered */}
              <div 
                className="relative h-full flex flex-col items-center justify-center"
                style={{
                  width: 'min(85vw, 50%)',
                }}
              >
              </div>
              
              {/* Left side - Level buttons and Skip to Level button */}
              <div className="absolute left-2 sm:left-4 md:left-6 lg:left-8 top-1/2 transform -translate-y-1/2 flex flex-col items-start gap-2 sm:gap-3 md:gap-4 px-2 sm:px-4 md:px-6 lg:px-8 z-10">
                {/* Level buttons - stacked vertically, white text, white border, no fill */}
                <div className="flex flex-col gap-2 sm:gap-3">
                  {[
                    { level: 1, name: 'drums' },
                    { level: 2, name: 'Instruments' },
                    { level: 3, name: 'vocals' }
                  ].map(({ level, name }) => {
                    // Determine if button should be lit up
                    const shouldLightUp = 
                      currentLevel === 1 && level === 1 || // Drums: only drums lights up
                      currentLevel === 2 && level <= 2 ||   // Instruments: light up drums and instruments
                      currentLevel === 3 && level <= 3;    // Vocals: light up all three
                    
                    return (
                  <button
                      key={level}
                      className={`px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg font-semibold text-xs sm:text-sm border-2 border-white text-white bg-transparent transition-all ${
                          shouldLightUp
                          ? 'opacity-100 scale-110'
                          : 'opacity-60'
                      }`}
                    >
                        {name}
                    </button>
                    );
                  })}
                </div>
                
                {/* Skip to Level button - under level buttons */}
                {currentLevel < 3 && !isFinished && (
                  <button
                    onClick={handleSkip}
                    className="px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg font-semibold text-xs sm:text-sm border-2 border-white text-white bg-transparent transition-all hover:opacity-100 opacity-60"
                  >
                    Skip to {currentLevel === 1 ? 'Instruments' : 'vocals'}
                  </button>
                )}
              </div>
              
              
              {/* Correct text on right side */}
              {isCorrect && (
                <div className="absolute bottom-4 sm:bottom-6 md:bottom-8 right-4 sm:right-6 md:right-8 text-white font-bold text-sm sm:text-base z-10">
                  Correct
              </div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacebar Button - Always visible */}
      <motion.div
        className="fixed bottom-4 sm:bottom-6 md:bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: showGameScreen ? 1 : carouselOpacity }}
            transition={{ duration: 0.3 }}
      >
        <motion.div
          className="flex flex-col items-center space-y-4 sm:space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0 }}
        >
          <p className="text-gray-400 text-xs sm:text-sm px-4 text-center flex items-center justify-center gap-2 flex-wrap">
            {isMobile ? 'Tap and hold' : 'Hold'}{" "}
            <motion.button
              onClick={showGameScreen ? returnToCarousel : undefined}
<<<<<<< Updated upstream
<<<<<<< Updated upstream
              onTouchStart={isMobile && !showGameScreen ? handleTouchStart : undefined}
              onTouchEnd={isMobile && !showGameScreen ? handleTouchEnd : undefined}
              className="relative rounded border-2 border-gray-100 tracking-widest bg-white text-black shadow-lg overflow-hidden touch-none"
              style={{ 
                minWidth: isMobile ? 'clamp(120px, 20vw, 180px)' : 'clamp(100px, 15vw, 140px)',
                minHeight: isMobile ? 'clamp(44px, 8vw, 60px)' : 'clamp(36px, 5vw, 48px)',
                padding: isMobile 
                  ? 'clamp(0.75rem, 2vw, 1.25rem) clamp(1.5rem, 4vw, 2.5rem)'
                  : 'clamp(0.5rem, 1vw, 0.75rem) clamp(1.25rem, 2.5vw, 2rem)',
                fontSize: isMobile 
                  ? 'clamp(0.875rem, 2vw, 1.125rem)'
                  : 'clamp(0.625rem, 1.2vw, 0.875rem)',
                userSelect: 'none',
              }}
              whileHover={!isMobile ? { scale: 1.05 } : {}}
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10">{isMobile ? 'HOLD' : 'SPACE'}</span>
=======
=======
>>>>>>> Stashed changes
              onMouseDown={(e) => {
                if (!showGameScreen) {
                  e.preventDefault();
                  startCarouselHold();
                }
              }}
              onMouseUp={(e) => {
                if (!showGameScreen) {
                  e.preventDefault();
                  stopCarouselHold();
                }
              }}
              onMouseLeave={(e) => {
                if (!showGameScreen) {
                  e.preventDefault();
                  stopCarouselHold();
                }
              }}
              onTouchStart={(e) => {
                if (!showGameScreen) {
                  e.preventDefault();
                  startCarouselHold();
                }
              }}
              onTouchEnd={(e) => {
                if (!showGameScreen) {
                  e.preventDefault();
                  stopCarouselHold();
                }
              }}
              onTouchCancel={(e) => {
                if (!showGameScreen) {
                  e.preventDefault();
                  stopCarouselHold();
                }
              }}
              className="relative text-[10px] sm:text-xs px-4 sm:px-6 py-0.5 rounded border-2 border-gray-100 tracking-widest bg-white text-black shadow-lg overflow-hidden cursor-pointer select-none"
              style={{ minWidth: '80px' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
              <span className="relative z-10">SPACE</span>
>>>>>>> Stashed changes
              {!showGameScreen && (
                <motion.span
                  className="absolute inset-0 rounded border-2 border-[#4A75AC]"
                  style={{
                    clipPath: `inset(0 ${(1 - holdProgress) * 100}% 0 0)`,
                  }}
                  transition={{ duration: 0.1, ease: "linear" }}
                />
              )}
            </motion.button>{" "}
            for <strong>2 seconds</strong> to charge and enter.
          </p>
        </motion.div>
      </motion.div>

      {/* Popup Notification */}
      <AnimatePresence>
        {showPopup && showGameScreen && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className={`px-6 py-4 rounded-lg shadow-2xl text-white font-semibold text-base sm:text-lg pointer-events-auto ${
                popupType === 'success'
                  ? 'bg-gradient-to-r from-green-600 to-green-700'
                  : 'bg-gradient-to-r from-red-600 to-red-700'
              }`}
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {popupMessage}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-lg">Loading...</div>
      </div>
    }>
      <GamePageContent />
    </Suspense>
  );
}
