'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPause, FaPlay } from 'react-icons/fa';
import { getAudioManager } from '@/lib/audioManager';
import { useAuth } from '@/lib/auth';
import { startPlay, submitGuess, skipLevel, searchSongs, getMyStats, API_URL } from '@/lib/api';
import type { Song, GuessResponse, SearchResult, GameFilters, PlayResponse } from '@/lib/api';
import Carousel from '@/components/Carousel';
import VideoPlayer from '@/components/VideoPlayer';
import Leaderboard from '@/components/Leaderboard';
import Spacebar from '@/components/Spacebar';
import SignInPrompt from '@/components/SignInPrompt';

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

// Shuffle function to randomize array order
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Create three shuffled versions for each row
const carouselItemsRow1 = shuffleArray(carouselItems);
const carouselItemsRow2 = shuffleArray(carouselItems);
const carouselItemsRow3 = shuffleArray(carouselItems);
const portraitCarouselRows = Array.from({ length: 7 }, () => shuffleArray(carouselItems));

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

const GAME_SIGN_IN_PROMPT_KEY = 'game_sign_in_prompt_seen';

function GamePageContent() {
  const searchParams = useSearchParams();
  const { token, user, isLoading: isAuthLoading, logout } = useAuth();
  const gameMode = searchParams.get('mode') || 'all'; // 'all', 'genre', or 'decade'
  const routeCategoryFilter = useMemo<GameFilters | undefined>(() => {
    if (gameMode === 'genre') {
      const rawGenres = searchParams.get('genres') || searchParams.get('genre');
      const genres = rawGenres
        ? rawGenres.split(',').map((genre) => genre.trim()).filter(Boolean)
        : [];
      return genres.length > 0 ? { mode: 'genre', genres } : undefined;
    }

    if (gameMode === 'decade') {
      const rawDecades = searchParams.get('decades') || searchParams.get('decade');
      const decades = rawDecades
        ? rawDecades
            .split(',')
            .map((decade) => Number(decade.trim()))
            .filter((decade) => Number.isFinite(decade))
        : [];
      return decades.length > 0 ? { mode: 'decade', decades } : undefined;
    }

    return undefined;
  }, [gameMode, searchParams]);
  const routeCategoryKey = routeCategoryFilter
    ? routeCategoryFilter.mode === 'genre'
      ? `genre:${routeCategoryFilter.genres.join('|')}`
      : `decade:${routeCategoryFilter.decades.join('|')}`
    : null;

  // Fetch the user's existing point total on mount
  useEffect(() => {
    if (!token) return;
    getMyStats()
      .then((stats) => {
        if (typeof stats.totalPoints === 'number') setTotalPoints(stats.totalPoints);
      })
      .catch(() => {
        // Non-critical; leave totalPoints as-is
      });
  }, [token]);
  
  const [showGameScreen, setShowGameScreen] = useState(false);
  const [carouselOpacity, setCarouselOpacity] = useState(1);
  const [isSpacebarHeld, setIsSpacebarHeld] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false); // Drives the keycap press visual
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showBlackScreen, setShowBlackScreen] = useState(false);
  const [showYear, setShowYear] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [showFullGameScreen, setShowFullGameScreen] = useState(false);
  const [isGameVideoLoading, setIsGameVideoLoading] = useState(false);
  // Pre-game mode selection ("Play All" vs "Play with Filters") - shown on
  // the TV once cutToGameScreen fires, before a song is actually picked.
  // The black-screen/year/views reveal sequence only starts once this
  // resolves (see startRevealSequence), so its delicate timing is untouched.
  const [gameStarted, setGameStarted] = useState(false);
  const [filterSubmitting, setFilterSubmitting] = useState(false);
  const [filterSubmitError, setFilterSubmitError] = useState<string | null>(null);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
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
  const [scoreProfile, setScoreProfile] = useState<'all' | 'reduced'>('all');
  const levelPointLabels = scoreProfile === 'reduced'
    ? { 1: '+8', 2: '+4', 3: '+1' }
    : { 1: '+10', 2: '+5', 3: '+1' };
  const [currentLevel, setCurrentLevel] = useState<1 | 2 | 3>(1);
  // Which levels actually have audio on disk for the current song - some songs
  // are missing a level (e.g. a silent/trimmed stem), so don't assume 1/2/3 always exist.
  const [availableLevels, setAvailableLevels] = useState<number[]>([1, 2, 3]);
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
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [lastPointsAwarded, setLastPointsAwarded] = useState<number | null>(null);
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);
  
  const audioManager = useRef(getAudioManager());
  const searchTimeout = useRef<NodeJS.Timeout>();
  const routeCategoryStartedRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || token || !routeCategoryFilter || !showGameScreen) return;
    setShowSignInPrompt(true);
  }, [isAuthLoading, routeCategoryFilter, showGameScreen, token]);

  useEffect(() => {
    if (isAuthLoading || token || routeCategoryFilter || !showFullGameScreen || !song) return;
    const hasSeenPrompt = localStorage.getItem(GAME_SIGN_IN_PROMPT_KEY) === 'true';
    if (hasSeenPrompt) return;

    const timer = setTimeout(() => {
      setShowSignInPrompt(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isAuthLoading, routeCategoryFilter, showFullGameScreen, song, token]);

  const closeOptionalSignInPrompt = useCallback(() => {
    localStorage.setItem(GAME_SIGN_IN_PROMPT_KEY, 'true');
    setShowSignInPrompt(false);
  }, []);

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

  // Initialize game.
  // `filters` switches the backend into filtered mode ("Play with Filters").
  // `prefetched` lets a caller that already fetched the song (e.g. to
  // validate filters before starting the reveal animation) skip a second
  // network round-trip here.
  const initializeGame = useCallback(async (filters?: GameFilters, prefetched?: PlayResponse) => {
    try {
      setIsLoading(true);

      // Reset level to 1
      setCurrentLevel(1);
      setLastGuessedLevel(null);
      setReveal(null);

      // Reset video loaded states to ensure videos reload properly
      setVideosLoaded({
        on: false,
        running: false,
        off: false,
        overlay: false,
      });

      // Start play with appropriate mode (or reuse an already-fetched response)
      const playResponse = prefetched ?? await startPlay('random', gameMode === 'post00s' ? 2000 : undefined, filters);

      setPlayId(playResponse.playId);
      setScoreProfile(playResponse.scoreProfile || 'all');
      setSong(playResponse.song);
      setAvailableLevels(playResponse.availableLevels);
      const startingLevel = playResponse.currentLevel as 1 | 2 | 3;
      setCurrentLevel(startingLevel);

      try {
        // Initialize and load audio after the song/session is already ready.
        // On mobile, first-interaction audio unlock can be flaky; don't let it
        // block the guess UI from receiving the song.
        await audioManager.current.initialize();
        await audioManager.current.loadLevel(
          playResponse.song.id,
          startingLevel,
          playResponse.song.audio_urls,
          API_URL
        );
      } catch (audioError) {
        console.error('Error preparing initial audio:', audioError);
        setMessage('Audio is still loading. Tap play to retry.');
      }
      
      setIsLoading(false);
      if (audioManager.current.hasLevel(playResponse.song.id, startingLevel)) {
        setMessage('');
      }
    } catch (error: any) {
      console.error('Error initializing game:', error);
      setMessage(`❌ Error: ${error.message}`);
      setIsLoading(false);
    }
  }, [gameMode]);

  const handleGuess = async (guessText?: string) => {
    const finalGuess = guessText || guess;
    
    // Validation checks
    if (!playId || !song || !finalGuess.trim() || isFinished) return;
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
        if (typeof response.totalPoints === 'number') setTotalPoints(response.totalPoints);
        if (typeof response.pointsAwarded === 'number') setLastPointsAwarded(response.pointsAwarded);
        setLeaderboardRefreshKey((k) => k + 1);
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
        
        const lastAvailableLevel = Math.max(...availableLevels);
        if (currentLevel === lastAvailableLevel) {
          // Wrong on the last available level - game over
          console.log('Wrong guess on last available level - ending game', { reveal: response.reveal });
          setIsCorrect(false);
          setIsFinished(true);
          setReveal(response.reveal);
          if (typeof response.totalPoints === 'number') setTotalPoints(response.totalPoints);
          setLeaderboardRefreshKey((k) => k + 1);
          audioManager.current.stop();
          setIsPlaying(false);
          stopVideoSequence();
          setMessage('');
        } else {
          // Advance to the next level that's actually available for this song
          audioManager.current.stop();
          setIsPlaying(false);
          stopVideoSequence();

          const nextLevel = availableLevels
            .filter((lvl) => lvl > currentLevel)
            .sort((a, b) => a - b)[0] as 1 | 2 | 3;
          setCurrentLevel(nextLevel);
          setLastGuessedLevel(null); // Reset for new level
          setIsLoading(true);
          await audioManager.current.loadLevel(
            song.id,
            nextLevel,
            song.audio_urls,
            API_URL
          );
          setIsLoading(false);
          setMessage('');
        }
      }
    } catch (error: any) {
      console.error('Error submitting guess:', error);
      const errorMessage = error.message || 'Failed to submit guess';
      setLastGuessedLevel(null);
      setIsLoading(false);
      
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
    setScoreProfile('all');
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

    // Reset pre-game selection so the next visit shows Play All / Filters again
    setGameStarted(false);
    setFilterSubmitting(false);
    setFilterSubmitError(null);
    routeCategoryStartedRef.current = null;

    // Stop video sequence
    stopVideoSequence();

    // Reset video loaded states so videos reload properly on next game
    setVideosLoaded({
      on: false,
      running: false,
      off: false,
      overlay: false,
    });

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

  // Function to immediately cut to the game screen. The selected route mode
  // starts automatically once this screen is visible.
  const cutToGameScreen = useCallback(() => {
    if (showGameScreen) return;

    setShowGameScreen(true);
    setCarouselOpacity(0);
  }, [showGameScreen]);

  // Kicks off the existing black-screen -> year -> views -> full game screen
  // reveal sequence. Unchanged from the original cutToGameScreen body, just
  // extracted so it can be deferred until after mode/filter selection.
  const startRevealSequence = useCallback((filters?: GameFilters, prefetched?: PlayResponse) => {
    setGameStarted(true);
    setShowBlackScreen(true);
    initializeGame(filters, prefetched);

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
  }, [initializeGame]);

  useEffect(() => {
    if (!showGameScreen || gameStarted || routeCategoryFilter) return;
    startRevealSequence();
  }, [gameStarted, routeCategoryFilter, showGameScreen, startRevealSequence]);

  useEffect(() => {
    if (!showGameScreen || gameStarted || !routeCategoryFilter || !routeCategoryKey || filterSubmitting || !token) return;
    if (routeCategoryStartedRef.current === routeCategoryKey) return;

    routeCategoryStartedRef.current = routeCategoryKey;
    setFilterSubmitError(null);
    setFilterSubmitting(true);
    startPlay('random', undefined, routeCategoryFilter)
      .then((prefetched) => {
        setFilterSubmitting(false);
        startRevealSequence(routeCategoryFilter, prefetched);
      })
      .catch((error: any) => {
        setFilterSubmitting(false);
        setFilterSubmitError(error.message || 'Failed to start game with this category');
      });
  }, [filterSubmitting, gameStarted, routeCategoryFilter, routeCategoryKey, showGameScreen, startRevealSequence, token]);

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
    
    // Stop and hide on video immediately
    if (onVideoRef.current) {
      onVideoRef.current.pause();
      onVideoRef.current.currentTime = 0;
      onVideoRef.current.style.display = 'none';
    }
    
    // Keep running video visible but paused until off video is fully loaded
    // Pause running video but keep it visible
    if (runningVideoRef.current) {
      runningVideoRef.current.pause();
      // Keep it visible - don't hide it yet
    }
    
    // Ensure off video is loaded and ready before switching
    let offVideoReady = false;
    try {
      // Always ensure off video is loaded (preloadVideo will skip if already loaded)
      if (offVideoRef.current) {
        // Check if video src is set correctly and video is actually ready
        const hasSrc = offVideoRef.current.src && offVideoRef.current.src.includes('off.mp4');
        const isReady = offVideoRef.current.readyState >= 3;
        const needsReload = !hasSrc || !videosLoaded.off || !isReady;
        
        if (needsReload) {
          // Force reload if not ready - reset src to ensure clean reload
          if (hasSrc && !isReady) {
            // If src is set but not ready, reload it
            offVideoRef.current.load();
            // Wait a bit for load to start
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          // Preload/reload the video
          await preloadVideo(offVideoRef.current, '/off.mp4');
          setVideosLoaded(prev => ({ ...prev, off: true }));
        }
        
        // Always wait for video to be ready to play, even if marked as loaded
        if (offVideoRef.current.readyState < 3) {
          await new Promise<void>((resolve, reject) => {
            if (!offVideoRef.current) {
              reject(new Error('Off video ref is null'));
              return;
            }
            const video = offVideoRef.current;
            let timeoutId: NodeJS.Timeout;
            
            const checkReady = () => {
              if (video && video.readyState >= 3) {
                if (timeoutId) clearTimeout(timeoutId);
                video.removeEventListener('canplay', checkReady);
                video.removeEventListener('loadeddata', checkReady);
                resolve();
              } else if (video) {
                // Add both canplay and loadeddata listeners for better reliability
                video.addEventListener('canplay', checkReady, { once: true });
                video.addEventListener('loadeddata', checkReady, { once: true });
              } else {
                if (timeoutId) clearTimeout(timeoutId);
                reject(new Error('Video element became null'));
              }
            };
            
            // Set a timeout to prevent infinite waiting
            timeoutId = setTimeout(() => {
              video.removeEventListener('canplay', checkReady);
              video.removeEventListener('loadeddata', checkReady);
              // If video has any data, try to proceed anyway
              if (video.readyState >= 2) {
                resolve();
              } else {
                reject(new Error('Timeout waiting for off video to be ready'));
              }
            }, 5000);
            
            checkReady();
          });
        }
        offVideoReady = true;
      }
    } catch (err) {
      console.error('Error preloading off video:', err);
      // Try to proceed anyway if video element exists and has some data
      if (offVideoRef.current && offVideoRef.current.readyState >= 2) {
        console.log('Proceeding with off video despite error, readyState:', offVideoRef.current.readyState);
        offVideoReady = true;
      } else {
        // If off video fails to load, keep running video visible (already paused)
        console.error('Off video not ready, keeping running video visible');
        return;
      }
    }
    
    // Now that off video is loaded and ready, switch to it
    if (offVideoReady && offVideoRef.current) {
      // Hide running video
      if (runningVideoRef.current) {
        runningVideoRef.current.currentTime = 0;
        runningVideoRef.current.style.display = 'none';
      }
      
      // Show and play off video
      offVideoRef.current.style.display = 'block';
      offVideoRef.current.currentTime = 0;
      videoSequenceRef.current = 'off';
      
      try {
        await offVideoRef.current.play();
      } catch (err) {
        console.log('Error playing off video:', err);
        // Try to play again after a short delay
        setTimeout(async () => {
          if (offVideoRef.current) {
            try {
              await offVideoRef.current.play();
            } catch (retryErr) {
              console.error('Error retrying off video play:', retryErr);
            }
          }
        }, 100);
      }
    }
    
    // When off video ends, show first frame of on video
    const handleOffVideoEnd = async () => {
      if (!onVideoRef.current || !offVideoRef.current) return;
      
      // Reset off video for next use
      if (offVideoRef.current) {
        offVideoRef.current.pause();
        offVideoRef.current.currentTime = 0;
        offVideoRef.current.style.display = 'none';
        // Reset the video element to ensure it can be played again
        offVideoRef.current.load();
      }
      
      // Ensure on video is ready
      try {
        if (!videosLoaded.on && onVideoRef.current) {
          await preloadVideo(onVideoRef.current, '/on.mp4');
          setVideosLoaded(prev => ({ ...prev, on: true }));
        }
      } catch (err) {
        console.error('Error preloading on video:', err);
      }
      
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

  const handleSkip = useCallback(async () => {
    if (!playId || currentLevel === Math.max(...availableLevels) || isFinished || !song) return;
    
    try {
      // Replace the current audio buffer without running the off/reset video
      // sequence. Level switches should feel continuous: the TV stays in its
      // current playing/running state while the next stem level loads.
      audioManager.current.setOnEnded(null);
      audioManager.current.stop();
      
      const response = await skipLevel(playId, currentLevel);
      // Use the level from backend response, or advance manually
      const nextLevel = (response.currentLevel || currentLevel + 1) as 1 | 2 | 3;
      setCurrentLevel(nextLevel);
      setLastGuessedLevel(null);
      setReveal(null);
      setMessage('');
      
      // Load the next level audio, then auto-play
      try {
        await audioManager.current.loadLevel(
          song.id,
          nextLevel,
          song.audio_urls,
          API_URL
        );
        
        // Ensure callback is set before playing
        if (showGameScreen && showFullGameScreen) {
          const handleAudioEnd = () => {
            audioManager.current.stop();
            setIsPlaying(false);
            stopVideoSequence();
          };
          audioManager.current.setOnEnded(handleAudioEnd);
        }
        
        // Auto-play after loading
        audioManager.current.play(song.id, nextLevel);
        setIsPlaying(true);
        const levelNames = ['', 'drums', 'Instruments', 'vocals'];
        setMessage(`🎵 Playing ${levelNames[nextLevel]}...`);
        if (videoSequenceRef.current === 'idle' || videoSequenceRef.current === 'off') {
          startVideoSequence();
        }
      } catch (loadError) {
        console.error(`Error loading level ${nextLevel}:`, loadError);
        setMessage(`❌ Error loading audio. Tap play to retry.`);
      }
    } catch (error: any) {
      // If skip fails because game is finished, that's okay - just show message
      if (error.message?.includes('finished')) {
        setIsFinished(true);
        setMessage(`❌ ${error.message}`);
      } else {
        setMessage(`❌ ${error.message}`);
      }
    }
  }, [playId, currentLevel, availableLevels, isFinished, song, stopVideoSequence, showGameScreen, showFullGameScreen, startVideoSequence]);

  // Helper function to set up audio end callback
  const setupAudioEndCallback = useCallback(() => {
    if (!showGameScreen || !showFullGameScreen) {
      return;
    }

    const handleAudioEnd = () => {
      // Auto-pause when audio finishes
      audioManager.current.stop();
      setIsPlaying(false);
      stopVideoSequence(); // This will play the off video
    };

    audioManager.current.setOnEnded(handleAudioEnd);
  }, [showGameScreen, showFullGameScreen, stopVideoSequence]);

  // Set up audio end callback to auto-pause and show off video
  useEffect(() => {
    if (!showGameScreen || !showFullGameScreen) {
      audioManager.current.setOnEnded(null);
      return;
    }

    setupAudioEndCallback();

    return () => {
      audioManager.current.setOnEnded(null);
    };
  }, [showGameScreen, showFullGameScreen, setupAudioEndCallback]);

  const handlePlay = useCallback(async () => {
    if (!song) return;
    
    if (isPlaying) {
      audioManager.current.stop();
      setIsPlaying(false);
      stopVideoSequence();
    } else {
      const levelNames = ['', 'drums', 'Instruments', 'vocals'];

      try {
        if (!audioManager.current.hasLevel(song.id, currentLevel)) {
          setIsLoading(true);
          setMessage('Loading audio...');
          await audioManager.current.initialize();
          await audioManager.current.loadLevel(
            song.id,
            currentLevel,
            song.audio_urls,
            API_URL
          );
        }

        // Ensure callback is set before playing
        setupAudioEndCallback();
        audioManager.current.play(song.id, currentLevel);
        setIsPlaying(true);
        setMessage(`🎵 Playing ${levelNames[currentLevel]}...`);
        startVideoSequence();
      } catch (error) {
        console.error(`Error playing level ${currentLevel}:`, error);
        setMessage('❌ Error loading audio. Tap play to retry.');
      } finally {
        setIsLoading(false);
      }
    }
  }, [song, isPlaying, currentLevel, stopVideoSequence, startVideoSequence, setupAudioEndCallback]);

  // Function to return to carousel from game screen
  const returnToCarousel = useCallback(() => {
    if (!showGameScreen) return;

    // Reset game state
    audioManager.current.clear();
    setPlayId(null);
    setScoreProfile('all');
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

    // Reset pre-game selection so the next visit shows Play All / Filters again
    setGameStarted(false);
    setFilterSubmitting(false);
    setFilterSubmitError(null);
    routeCategoryStartedRef.current = null;

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

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768; // md breakpoint
      const mobile = isTouchDevice || isSmallScreen;
      setIsMobile(mobile);
      setIsPortraitMobile(mobile && window.innerHeight >= window.innerWidth);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Helper function to start holding (for carousel)
  const startCarouselHold = useCallback(() => {
    if (showGameScreen) return;
    setIsSpacebarHeld(true);
  }, [showGameScreen]);

  // Helper function to stop holding and check if should transition
  const stopCarouselHold = useCallback(() => {
    if (showGameScreen || !isSpacebarHeld) return;

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
  }, [showGameScreen, isSpacebarHeld, cutToGameScreen]);

  // Handle spacebar key press and release, and 'p' key for play button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );
      
      if (e.code === 'Space') {
        if (isInputFocused) {
          return; // Allow normal spacebar behavior in input fields
        }
        
        e.preventDefault();
        setIsSpacePressed(true);

        if (showGameScreen) {
          // If on game screen, return to carousel
          returnToCarousel();
        } else {
          // If on carousel, start holding
          startCarouselHold();
        }
      } else if (e.key === 'p' || e.key === 'P') {
        // 'p' key shortcut for play button - only on game screen
        if (isInputFocused) {
          return; // Allow normal 'p' behavior in input fields
        }
        
        if (showGameScreen && showFullGameScreen && !isFinished) {
          e.preventDefault();
          handlePlay();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true'
        );

        if (isInputFocused) {
          return; // Allow normal spacebar behavior in input fields
        }

        setIsSpacePressed(false);

        if (!showGameScreen && isSpacebarHeld) {
          e.preventDefault();
          stopCarouselHold();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showGameScreen, isSpacebarHeld, startCarouselHold, stopCarouselHold, returnToCarousel, handlePlay, showFullGameScreen, isFinished]);

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
    <div className="h-[100dvh] min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden relative bg-black">
      {showSignInPrompt && !token && (
        <SignInPrompt
          message={
            routeCategoryFilter
              ? 'Sign in to choose categories and save your score.'
              : 'Sign in to save points and see the leaderboard.'
          }
          onClose={routeCategoryFilter ? undefined : closeOptionalSignInPrompt}
        />
      )}

      <Link
        href="/?menu=1"
        onClick={() => {
          audioManager.current.stop();
          stopVideoSequence();
        }}
        className="fixed left-4 top-4 z-[75] rounded-md border border-white/70 bg-black/45 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] backdrop-blur-sm transition hover:bg-white hover:text-black sm:left-6 sm:top-6"
      >
        Back
      </Link>

      {!isAuthLoading && (
        <div className="fixed top-4 right-4 sm:right-6 z-[70] flex items-center gap-2 text-white/80">
          {token && user ? (
            <>
              <span className="text-xs sm:text-sm hidden sm:inline">{user.name}</span>
              <button
                onClick={logout}
                className="text-xs sm:text-sm underline hover:text-white transition-colors"
              >
                Sign out
              </button>
            </>
          ) : null}
        </div>
      )}

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
          <div className="absolute inset-0 z-[2] flex h-full w-full items-center justify-center overflow-hidden overscroll-none">
            {/* Grouped container for video and play button - they resize together (same pattern as TVWithVideo) */}
            <div 
              className="relative aspect-video w-[clamp(300px,65vw,1000px)] max-w-[1000px] overflow-hidden overscroll-none max-[900px]:w-[46vw] max-[900px]:min-w-[270px] max-[700px]:w-[42vw] max-[700px]:min-w-[230px] [@media_(max-width:700px)_and_(orientation:portrait)]:w-[88vw] [@media_(max-width:700px)_and_(orientation:portrait)]:min-w-0 [@media_(max-width:700px)_and_(orientation:portrait)]:max-w-[420px] [@media_(max-width:700px)_and_(orientation:portrait)]:translate-y-10"
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
              
              {/* Play Button - Positioned absolutely within container, size relative to video height */}
              {showFullGameScreen && (
                <button
                  onClick={handlePlay}
                  disabled={isFinished}
                  className="absolute z-10 flex touch-manipulation items-center justify-center rounded-full border-2 border-white bg-transparent text-white transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    bottom: '18.1%',
                    left: '25%',
                    height: '12%',
                    aspectRatio: '1 / 1',
                    borderRadius: '50%',
                    boxSizing: 'border-box',
                  }}
                >
                  {isPlaying ? (
                    <FaPause
                      aria-hidden="true"
                      className="ml-0.5"
                      style={{
                        width: 'clamp(0.875rem, 3%, 1.125rem)',
                        height: 'clamp(0.875rem, 3%, 1.125rem)',
                      }}
                    />
                  ) : (
                    <FaPlay
                      aria-hidden="true"
                      className="ml-1"
                      style={{
                        width: 'clamp(0.875rem, 3%, 1.125rem)',
                        height: 'clamp(0.875rem, 3%, 1.125rem)',
                      }}
                    />
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGameScreen && !gameStarted && routeCategoryFilter && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-full max-w-lg rounded-lg border-2 border-[#6f7a8d] bg-[#111820]/90 p-5 sm:p-8 text-center shadow-[0_12px_28px_rgba(0,0,0,0.45),inset_0_0_20px_rgba(255,255,255,0.04)] backdrop-blur-sm">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-[#9aa3b2]">
                {filterSubmitError || 'Starting...'}
              </p>
            </div>
          </motion.div>
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
            <div className="hidden [@media_(max-width:700px)_and_(orientation:portrait)]:contents">
              {[
                { items: portraitCarouselRows[0], speed: 1.5, top: '18%' },
                { items: portraitCarouselRows[1], speed: 1, top: '29%' },
                { items: portraitCarouselRows[2], speed: 0.7, top: '40%' },
                { items: portraitCarouselRows[3], speed: 1.25, top: '51%' },
                { items: portraitCarouselRows[4], speed: 0.85, top: '62%' },
                { items: portraitCarouselRows[5], speed: 1.1, top: '73%' },
                { items: portraitCarouselRows[6], speed: 0.65, top: '84%' },
              ].map((row, index) => (
                <div
                  key={index}
                  className="w-full absolute"
                  style={{ top: row.top, transform: 'translateY(-50%)' }}
                >
                  <Carousel
                    direction="left"
                    items={row.items}
                    speed={row.speed}
                    speedMultiplierRef={speedMultiplierRef}
                  />
                </div>
              ))}
            </div>

            <div className="contents [@media_(max-width:700px)_and_(orientation:portrait)]:hidden">
              {/* Row 1 - Top (slower, right to left) */}
              <div className="absolute inset-x-0 w-full" style={{ top: 'calc(50vh - clamp(80px, 14vw, 300px))', transform: 'translateY(-50%)' }}>
                <Carousel 
                  direction="left" 
                  items={carouselItemsRow1} 
                  speed={1.5}
                  speedMultiplierRef={speedMultiplierRef}
                />
              </div>
              
              {/* Row 2 - Middle (normal speed, left to right) */}
              <div className="absolute inset-x-0 w-full" style={{ top: '50vh', transform: 'translateY(-50%)' }}>
                <Carousel 
                  direction="left" 
                  items={carouselItemsRow2} 
                  speed={1}
                  speedMultiplierRef={speedMultiplierRef}
                />
              </div>
              
              {/* Row 3 - Bottom (faster, right to left) */}
              <div className="absolute inset-x-0 w-full" style={{ top: 'calc(50vh + clamp(80px, 14vw, 300px))', transform: 'translateY(-50%)' }}>
            
                <Carousel 
                  direction="left" 
                  items={carouselItemsRow3} 
                  speed={0.7}
                  speedMultiplierRef={speedMultiplierRef}
                />
              </div>
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
            className="w-full h-full flex items-center justify-center z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <div className="w-full h-full flex items-center justify-center relative">
              {/* Search bar at top of screen */}
              {!isFinished && !isCorrect && (
                <div className="fixed top-3 sm:top-4 md:top-8 left-1/2 transform -translate-x-1/2 w-full max-w-[min(42rem,calc(100vw-2rem))] max-[900px]:max-w-[52vw] max-[700px]:max-w-[48vw] [@media_(max-width:900px)_and_(max-height:500px)]:top-2 [@media_(max-width:900px)_and_(max-height:500px)]:max-w-[58vw] [@media_(max-width:700px)_and_(orientation:portrait)]:top-16 [@media_(max-width:700px)_and_(orientation:portrait)]:max-w-[94vw] px-4 z-30 pointer-events-auto">
                    <div className="relative overflow-visible rounded-lg border-2 border-[#6f7a8d] bg-[#111820]/90 shadow-[0_12px_28px_rgba(0,0,0,0.45),inset_0_0_20px_rgba(255,255,255,0.04)] backdrop-blur-sm">
                      <div className="absolute inset-0 pointer-events-none rounded-md opacity-20 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.14),transparent_24%),linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:100%_100%,100%_5px]" />
                      <input
                        type="text"
                        value={guess}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                        placeholder="Type your guess..."
                        className="relative w-full rounded-md border-0 bg-transparent py-2 pl-3 pr-[5.25rem] sm:py-3 sm:pl-4 sm:pr-28 [@media_(max-width:900px)_and_(max-height:500px)]:py-1.5 [@media_(max-width:700px)_and_(orientation:portrait)]:py-2.5 text-base font-semibold text-[#f4f4f4] placeholder:text-[#9aa3b2] outline-none focus:ring-2 focus:ring-white/35 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isFinished || lastGuessedLevel === currentLevel}
                      />
                      <button
                        type="button"
                        onClick={() => handleGuess()}
                        disabled={isFinished || lastGuessedLevel === currentLevel || !guess.trim()}
                        className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded-md border border-white/80 px-2.5 py-1 text-[9px] font-bold uppercase leading-none text-white transition hover:bg-white hover:text-[#111820] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-white sm:right-2 sm:px-3 sm:py-1.5 sm:text-[10px] md:text-xs"
                      >
                        Submit
                      </button>

                      {/* Autocomplete Suggestions */}
                      {showSuggestions && searchResults.length > 0 && (
                        <div className="absolute left-0 right-0 z-20 mt-2 max-h-48 overflow-y-auto rounded-lg border-2 border-[#6f7a8d] bg-[#0b0e0f]/95 p-1 shadow-[0_14px_34px_rgba(0,0,0,0.55),inset_0_0_18px_rgba(255,255,255,0.035)] backdrop-blur-sm">
                          {searchResults.map((result) => (
                            <button
                              key={result.id}
                              onClick={() => handleSuggestionClick(result.hint)}
                              className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-[#e8ebf0] transition-colors hover:bg-white hover:text-[#0b0e0f] focus:bg-white focus:text-[#0b0e0f] focus:outline-none"
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
                <div className="fixed top-4 sm:top-6 md:top-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-10 flex flex-col items-center gap-2 pointer-events-auto">
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
                <div className="fixed top-4 sm:top-6 md:top-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-10 flex flex-col items-center gap-2 pointer-events-auto">
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
                <div className="fixed top-16 sm:top-20 md:top-24 max-[900px]:!top-14 left-3 sm:left-4 md:left-8 max-[900px]:!left-3 [@media_(max-width:900px)_and_(max-height:500px)]:hidden [@media_(max-width:700px)_and_(orientation:portrait)]:hidden text-white z-10">
                  <p className="text-base sm:text-xl md:text-3xl lg:text-4xl max-[900px]:!text-lg font-bold">{song.release_year}</p>
                </div>
              )}
              
              {/* Views - Top right corner */}
              {song && (
                <div className="fixed top-16 sm:top-20 md:top-24 max-[900px]:!top-14 right-3 sm:right-4 md:right-8 max-[900px]:!right-3 [@media_(max-width:900px)_and_(max-height:500px)]:hidden [@media_(max-width:700px)_and_(orientation:portrait)]:hidden text-white z-10">
                  <p className="text-base sm:text-xl md:text-3xl lg:text-4xl max-[900px]:!text-lg font-bold">{song.viewcount_formatted}</p>
                </div>
              )}

              {song && (
                <div className="hidden [@media_(max-width:700px)_and_(orientation:portrait)]:grid fixed top-[7.25rem] left-6 right-6 z-10 grid-cols-2 gap-2 text-white">
                  <div className="rounded-md border border-[#6f7a8d]/80 bg-[#111820]/70 px-2 py-1.5 text-left shadow-[0_8px_18px_rgba(0,0,0,0.28),inset_0_0_12px_rgba(255,255,255,0.025)] backdrop-blur-sm">
                    <p className="text-[6px] uppercase tracking-widest text-[#9aa3b2]">Year</p>
                    <p className="mt-0.5 text-sm font-bold leading-none">{song.release_year}</p>
                  </div>
                  <div className="rounded-md border border-[#6f7a8d]/80 bg-[#111820]/70 px-2 py-1.5 text-right shadow-[0_8px_18px_rgba(0,0,0,0.28),inset_0_0_12px_rgba(255,255,255,0.025)] backdrop-blur-sm">
                    <p className="text-[6px] uppercase tracking-widest text-[#9aa3b2]">Views</p>
                    <p className="mt-0.5 text-sm font-bold leading-none">{song.viewcount_formatted}</p>
                  </div>
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
              
              {/* Left side - Now playing indicator */}
              <div className="absolute left-2 sm:left-4 md:left-6 lg:left-8 max-[900px]:!left-2 top-1/2 transform -translate-y-1/2 [@media_(max-width:900px)_and_(max-height:500px)]:hidden [@media_(max-width:700px)_and_(orientation:portrait)]:hidden flex flex-col items-start gap-2 sm:gap-3 md:gap-5 max-[900px]:!gap-2 px-1 sm:px-2 md:px-6 lg:px-8 max-[900px]:!px-1 z-10 max-w-[28vw] sm:max-w-[30vw] md:max-w-none max-[900px]:!max-w-[28vw]">
                <p className="text-white text-[9px] sm:text-xs md:text-sm max-[900px]:!text-[9px] uppercase tracking-widest opacity-60 font-semibold">
                  Now playing:
                </p>
                {/* Stem indicators - plain text, not buttons */}
                <div className="flex flex-col gap-1.5 sm:gap-2 md:gap-3 max-[900px]:!gap-1.5">
                  {[
                    { level: 1, name: 'Drums', points: levelPointLabels[1] },
                    { level: 2, name: 'Instruments', points: levelPointLabels[2] },
                    { level: 3, name: 'Vocals', points: levelPointLabels[3] }
                  ].map(({ level, name, points }) => {
                    // Is this stem currently audible in the mix?
                    const isActive =
                      currentLevel === 1 && level === 1 || // Drums: only drums audible
                      currentLevel === 2 && level <= 2 ||   // Instruments: drums + instruments audible
                      currentLevel === 3 && level <= 3;    // Vocals: everything audible

                    return (
                      <div
                        key={level}
                        className={`flex items-center gap-1.5 sm:gap-2 md:gap-3 max-[900px]:!gap-1.5 font-semibold text-xs sm:text-sm md:text-xl max-[900px]:!text-sm transition-all ${
                          isActive ? 'text-white opacity-100' : 'text-white opacity-30'
                        }`}
                      >
                        <span
                          className={`inline-block w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all ${
                            isActive ? 'bg-white' : 'bg-transparent border border-white/40'
                          }`}
                        />
                        {name}
                        {level === currentLevel && (
                          <span className="text-xs sm:text-sm opacity-60 font-normal">{points}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Skip to Level button */}
                {(() => {
                  const nextLevel = availableLevels.filter((lvl) => lvl > currentLevel).sort((a, b) => a - b)[0];
                  const levelNames: Record<number, string> = { 1: 'Drums', 2: 'Instruments', 3: 'Vocals' };
                  return nextLevel !== undefined && !isFinished && (
                    <div className="flex flex-col items-start gap-1">
                      <p className="text-gray-400 text-[10px] sm:text-xs md:text-sm max-[900px]:!text-[10px]">Too hard?</p>
                      <button
                        onClick={handleSkip}
                        className="px-2 py-1 md:px-3 md:py-1.5 max-[900px]:!px-2 max-[900px]:!py-1 rounded-lg font-semibold text-[10px] sm:text-xs md:text-sm max-[900px]:!text-[10px] border-2 border-white text-white bg-transparent transition-all opacity-100 hover:opacity-60 whitespace-nowrap pointer-events-auto"
                      >
                        Try with {levelNames[nextLevel]}
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Right side - Points + Leaderboard */}
              <div className="absolute right-2 sm:right-4 md:right-6 lg:right-8 max-[900px]:!right-2 top-1/2 transform -translate-y-1/2 [@media_(max-width:900px)_and_(max-height:500px)]:hidden [@media_(max-width:700px)_and_(orientation:portrait)]:hidden flex flex-col items-stretch gap-1.5 sm:gap-2 md:gap-3 max-[900px]:!gap-1.5 px-1 sm:px-2 md:px-6 lg:px-8 max-[900px]:!px-1 z-10 w-36 sm:w-44 md:w-64 lg:w-72 max-[900px]:!w-40 pointer-events-auto">
                {totalPoints !== null && (
                  <div className="text-right">
                    <p className="text-white text-[8px] sm:text-[10px] md:text-xs uppercase tracking-widest opacity-60 font-semibold">
                      Your points
                    </p>
                    <p className="text-white text-base sm:text-xl md:text-2xl font-bold">
                      {totalPoints}
                      {lastPointsAwarded ? (
                        <span className="text-green-400 text-xs sm:text-sm font-semibold ml-2">
                          +{lastPointsAwarded}
                        </span>
                      ) : null}
                    </p>
                  </div>
                )}
                <Leaderboard refreshKey={leaderboardRefreshKey} />
              </div>

              <div className="hidden [@media_(max-width:700px)_and_(orientation:portrait)]:flex fixed bottom-[5.75rem] left-4 right-4 z-10 flex-col gap-1.5 pointer-events-auto">
                {totalPoints !== null && (
                  <div className="text-center text-white">
                    <p className="text-[7px] uppercase tracking-widest opacity-60 font-semibold">
                      Your points
                    </p>
                    <p className="text-base font-bold leading-tight">
                      {totalPoints}
                      {lastPointsAwarded ? (
                        <span className="text-green-400 text-[10px] font-semibold ml-1.5">
                          +{lastPointsAwarded}
                        </span>
                      ) : null}
                    </p>
                  </div>
                )}
                <div className="mx-auto w-full max-w-[15rem]">
                  <Leaderboard refreshKey={leaderboardRefreshKey} />
                </div>
              </div>

              <div className="hidden [@media_(max-width:900px)_and_(max-height:500px)]:flex [@media_(max-width:700px)_and_(orientation:portrait)]:flex fixed left-3 right-3 z-20 flex-col items-center gap-1.5 pointer-events-auto [@media_(max-width:900px)_and_(max-height:500px)]:top-[5.25rem] [@media_(max-width:700px)_and_(orientation:portrait)]:top-[10rem]">
                <div className="w-full max-w-[22rem] rounded-lg border border-[#6f7a8d] bg-[#111820]/85 px-2 py-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.35),inset_0_0_16px_rgba(255,255,255,0.035)] backdrop-blur-sm">
                  <p className="mb-1 text-center text-[7px] font-semibold uppercase tracking-widest text-white/60">
                    Now playing
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { level: 1, name: 'Drums', points: levelPointLabels[1] },
                      { level: 2, name: 'Instruments', points: levelPointLabels[2] },
                      { level: 3, name: 'Vocals', points: levelPointLabels[3] }
                    ].map(({ level, name, points }) => {
                      const isActive =
                        currentLevel === 1 && level === 1 ||
                        currentLevel === 2 && level <= 2 ||
                        currentLevel === 3 && level <= 3;

                      return (
                        <div
                          key={level}
                          className={`flex min-w-0 items-center justify-center gap-1 rounded-md border px-1 py-1 text-[8px] font-semibold leading-none transition-all ${
                            isActive
                              ? 'border-white text-white opacity-100'
                              : 'border-white/25 text-white opacity-35'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              isActive ? 'bg-white' : 'border border-white/50'
                            }`}
                          />
                          <span className="min-w-0 truncate">{name}</span>
                          {level === currentLevel && (
                            <span className="shrink-0 text-[7px] font-normal opacity-65">{points}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  const nextLevel = availableLevels.filter((lvl) => lvl > currentLevel).sort((a, b) => a - b)[0];
                  const levelNames: Record<number, string> = { 1: 'Drums', 2: 'Instruments', 3: 'Vocals' };
                  return nextLevel !== undefined && !isFinished && (
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-[9px] leading-none text-white/65 [@media_(max-width:900px)_and_(max-height:500px)]:text-[8px]">
                        Too hard?
                      </p>
                      <button
                        type="button"
                        onClick={handleSkip}
                        className="rounded-md border border-white bg-black/35 px-2.5 py-1 text-[9px] font-semibold leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)] backdrop-blur-sm transition-opacity hover:opacity-70"
                      >
                        Try with {levelNames[nextLevel]}
                      </button>
                    </div>
                  );
                })()}
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
        className="fixed bottom-2 sm:bottom-3 md:bottom-8 [@media_(max-width:900px)_and_(max-height:500px)]:bottom-1 [@media_(max-width:700px)_and_(orientation:portrait)]:bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 transform -translate-x-1/2 z-50 w-full px-2 sm:px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: showGameScreen ? 1 : carouselOpacity }}
            transition={{ duration: 0.3 }}
      >
        <motion.div
          className="flex flex-col items-center space-y-2 sm:space-y-3 md:space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0 }}
        >
          <div className="text-gray-400 text-[10px] sm:text-xs md:text-sm [@media_(max-width:900px)_and_(max-height:500px)]:text-[9px] px-2 sm:px-4 text-center flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
            {isMobile ? 'Tap and hold' : 'Hold'}{" "}
            <Spacebar
              pressed={isSpacePressed}
              label={isMobile ? 'Here' : undefined}
              onMouseDown={isMobile ? undefined : (e) => {
                e.preventDefault();
                setIsSpacePressed(true);
                if (showGameScreen) {
                  returnToCarousel();
                  // Physical spacebar key-repeat naturally re-fires keydown while held,
                  // re-evaluating showGameScreen and starting the charge. Mouse/touch only
                  // fire once per press, so start charging immediately here too, or holding
                  // through the transition does nothing until the button is released and pressed again.
                  setIsSpacebarHeld(true);
                } else {
                  startCarouselHold();
                }
              }}
              onMouseUp={isMobile ? undefined : (e) => {
                e.preventDefault();
                setIsSpacePressed(false);
                if (!showGameScreen) stopCarouselHold();
              }}
              onMouseLeave={isMobile ? undefined : (e) => {
                e.preventDefault();
                setIsSpacePressed(false);
                if (!showGameScreen) stopCarouselHold();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                setIsSpacePressed(true);
                if (showGameScreen) {
                  returnToCarousel();
                  setIsSpacebarHeld(true);
                } else {
                  startCarouselHold();
                }
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                setIsSpacePressed(false);
                if (!showGameScreen) stopCarouselHold();
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                setIsSpacePressed(false);
                if (!showGameScreen) stopCarouselHold();
              }}
              style={{
                minWidth: isPortraitMobile
                  ? 'clamp(150px, 44vw, 190px)'
                  : isMobile ? 'clamp(112px, 18vw, 170px)' : 'clamp(150px, 19.5vw, 240px)',
                minHeight: isPortraitMobile
                  ? 'clamp(32px, 9vw, 42px)'
                  : isMobile ? 'clamp(26px, 4vw, 34px)' : 'clamp(21px, 2.4vw, 27px)',
                padding: isPortraitMobile
                  ? 'clamp(0.28rem, 1vw, 0.45rem) clamp(1.25rem, 4vw, 1.75rem)'
                  : isMobile
                  ? 'clamp(0.22rem, 0.7vw, 0.36rem) clamp(1rem, 2.6vw, 1.6rem)'
                  : 'clamp(0.15rem, 0.45vw, 0.3rem) clamp(1.125rem, 2.25vw, 1.875rem)',
                fontSize: isPortraitMobile
                  ? 'clamp(0.85rem, 3.5vw, 1rem)'
                  : isMobile
                  ? 'clamp(0.75rem, 1.45vw, 0.95rem)'
                  : 'clamp(0.75rem, 1.2vw, 0.9375rem)',
              }}
              overlay={
                !showGameScreen && (
                  <span
                    className="absolute inset-0 rounded-full bg-white pointer-events-none"
                    style={{
                      clipPath: `inset(0 ${(1 - holdProgress) * 100}% 0 0)`,
                    }}
                  />
                )
              }
            />{" "}
            <span className="[@media_(max-width:900px)_and_(max-height:500px)]:hidden">for the next song.</span>
          </div>
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
