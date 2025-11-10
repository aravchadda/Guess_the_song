'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAudioManager } from '@/lib/audioManager';
import { startPlay, submitGuess, skipLevel, searchSongs, API_URL } from '@/lib/api';
import type { Song, GuessResponse, SearchResult } from '@/lib/api';
import Carousel from '@/components/Carousel';

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
  'ab67616d000082c10a80b890ab011362fd7aa73b.jpeg',
  'ab67616d000082c114b55ab26f7463fd059d9f34.jpeg',
  'ab67616d000082c121ebf49b3292c3f0f575f0f5.jpeg',
  'ab67616d000082c134ef8f7d06cf2fc2146f420a.jpeg',
  'ab67616d000082c140c5b0a60c587bd0cee5ee0c.jpeg',
  'ab67616d000082c143511b8c20112757edddc7ba.jpeg',
  'ab67616d000082c151c02a77d09dfcd53c8676d0.jpeg',
  'ab67616d000082c155598d2d52fc249fa166a3ca.jpeg',
  'ab67616d000082c156072fea6785a3ad2d24237c.jpeg',
  'ab67616d000082c18399047ff71200928f5b6508.jpeg',
  'ab67616d000082c1d8a68fd3e16f7ff6932b47d9.jpeg',
  'ab67616d000082c1e44963b8bb127552ac761873.jpeg',
  'ab67616d000082c1e45161990e83649071399525.jpeg',
  'ab67616d000082c1e6d489d359c546fea254f440.jpeg',
  'ab67616d000082c1fbc71c99f9c1296c56dd51b6.jpeg',
  'B1TlPSY5bKS.jpg',
  'coldplay.jpg',
  'halloffame.jpg',
];

// Convert album covers to carousel items format
const carouselItems = albumCovers.map(cover => ({
  image: `/album-covers/${encodeURIComponent(cover)}`,
  name: cover,
}));

export default function GamePage() {
  const [showGameScreen, setShowGameScreen] = useState(false);
  const [carouselOpacity, setCarouselOpacity] = useState(1);
  const [isSpacebarHeld, setIsSpacebarHeld] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showBlackScreen, setShowBlackScreen] = useState(false);
  const [showYear, setShowYear] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [showFullGameScreen, setShowFullGameScreen] = useState(false);
  const spacebarHoldStartTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
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
  const [remainingAttempts, setRemainingAttempts] = useState(3);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const audioManager = useRef(getAudioManager());
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Initialize game
  const initializeGame = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Initialize audio context
      await audioManager.current.initialize();
      
      // Start play
      const playResponse = await startPlay('random');
      
      setPlayId(playResponse.playId);
      setSong(playResponse.song);
      setRemainingAttempts(3);
      
      // Preload audio
      await audioManager.current.preloadAudio(
        playResponse.song.id,
        playResponse.song.audio_urls,
        API_URL
      );
      
      setIsLoading(false);
      setMessage('🎧 Audio loaded! Press Play to start.');
    } catch (error: any) {
      console.error('Error initializing game:', error);
      setMessage(`❌ Error: ${error.message}`);
      setIsLoading(false);
    }
  }, []);

  const handlePlay = () => {
    if (!song) return;
    
    if (isPlaying) {
      audioManager.current.stop();
      setIsPlaying(false);
    } else {
      audioManager.current.play(song.id, currentLevel);
      setIsPlaying(true);
      setMessage(`🎵 Playing Level ${currentLevel}...`);
    }
  };

  const handleSkip = async () => {
    if (!playId || currentLevel === 3 || isFinished) return;
    
    try {
      await skipLevel(playId);
      audioManager.current.stop();
      setIsPlaying(false);
      const nextLevel = (currentLevel + 1) as 1 | 2 | 3;
      setCurrentLevel(nextLevel);
      setRemainingAttempts(prev => prev - 1);
      setMessage(`⏭️ Skipped to Level ${nextLevel}`);
    } catch (error: any) {
      setMessage(`❌ ${error.message}`);
    }
  };

  const handleGuess = async (guessText?: string) => {
    const finalGuess = guessText || guess;
    if (!playId || !finalGuess.trim() || isFinished) return;
    
    try {
      const response = await submitGuess(playId, finalGuess);
      
      if (response.correct) {
        setIsCorrect(true);
        setIsFinished(true);
        setReveal(response.reveal || null);
        audioManager.current.stop();
        setIsPlaying(false);
        setMessage(`🎉 Correct! You guessed on Level ${currentLevel}!`);
      } else {
        setRemainingAttempts(response.remainingAttempts || 0);
        
        if (response.remainingAttempts === 0) {
          setIsFinished(true);
          setReveal(response.reveal || null);
          audioManager.current.stop();
          setIsPlaying(false);
          setMessage(`❌ Out of attempts. The song was revealed.`);
        } else {
          setMessage(`❌ Incorrect. ${response.remainingAttempts} attempts left.`);
        }
      }
      
      setGuess('');
      setShowSuggestions(false);
    } catch (error: any) {
      setMessage(`❌ ${error.message}`);
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
    setRemainingAttempts(3);
    setSearchResults([]);
    setShowSuggestions(false);
    
    // Reset carousel state
    setIsSpacebarHeld(false);
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

  // Function to return to carousel from game screen
  const returnToCarousel = useCallback(() => {
    if (!showGameScreen) return;
    
    // Reset animation sequence states
    setShowBlackScreen(false);
    setShowYear(false);
    setShowViews(false);
    setShowFullGameScreen(false);
    
    // Reset carousel state
    setIsSpacebarHeld(false);
    setSpeedMultiplier(1);
    setHoldProgress(0);
    spacebarHoldStartTimeRef.current = null;
    
    // Hide game screen first, then fade in carousel
    setShowGameScreen(false);
    // Small delay to allow game screen to start fading out
    setTimeout(() => {
      setCarouselOpacity(1);
    }, 100);
  }, [showGameScreen]);

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
    }, 800);
    
    setTimeout(() => {
      setShowFullGameScreen(true);
      // Hide black screen when game screen fades in
      setTimeout(() => {
        setShowBlackScreen(false);
      }, 100);
    }, 1300);
  }, [showGameScreen, initializeGame]);

  // Handle speed acceleration while spacebar is held
  useEffect(() => {
    // Cleanup any existing animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (!isSpacebarHeld || showGameScreen) {
      setSpeedMultiplier(1);
      setHoldProgress(0);
      spacebarHoldStartTimeRef.current = null;
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
        setSpeedMultiplier(1);
        setHoldProgress(0);
        animationFrameRef.current = null;
        return;
      }

      const elapsed = (Date.now() - startTime) / 1000; // in seconds
      // Accelerate: speed increases exponentially with hold duration
      // Max speed multiplier of 5x - once reached, maintain constant speed
      const accelerationRate = 0.3;
      const maxMultiplier = 5;
      const threshold = 0.99; // When to cap (99% of max)
      
      let newMultiplier;
      const calculatedMultiplier = 1 + (maxMultiplier - 1) * (1 - Math.exp(-accelerationRate * elapsed));
      
      // Once we reach threshold of max speed, maintain constant max speed
      if (calculatedMultiplier >= maxMultiplier * threshold) {
        newMultiplier = maxMultiplier;
      } else {
        newMultiplier = calculatedMultiplier;
      }
      
      setSpeedMultiplier(newMultiplier);
      
      // Update hold progress: reaches 100% after 2 seconds
      const progress = Math.min(elapsed / 2, 1);
      setHoldProgress(progress);

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

  // Handle spacebar key press and release
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        
        if (showGameScreen) {
          // If on game screen, return to carousel
          returnToCarousel();
        } else {
          // If on carousel, start holding
          setIsSpacebarHeld(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !showGameScreen && isSpacebarHeld) {
        e.preventDefault();
        
        // Check if 2 seconds have passed
        const elapsed = spacebarHoldStartTimeRef.current 
          ? (Date.now() - spacebarHoldStartTimeRef.current) / 1000 
          : 0;
        const hasHeldFor2Seconds = elapsed >= 2;
        
        // Reset speed and progress
        setSpeedMultiplier(1);
        setHoldProgress(0);
        spacebarHoldStartTimeRef.current = null;
        setIsSpacebarHeld(false);
        
        // Only transition to game screen if held for 2 seconds
        if (hasHeldFor2Seconds) {
          cutToGameScreen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showGameScreen, isSpacebarHeld, cutToGameScreen, returnToCarousel]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioManager.current.stop();
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center overflow-hidden relative bg-black">
      {/* Three-row Carousel Container */}
      <AnimatePresence>
        {!showGameScreen && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={false}
            animate={{ opacity: carouselOpacity }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            {/* Row 1 - Top (slower, right to left) */}
            <div className="w-full absolute" style={{ top: 'calc(50vh - 210px)', transform: 'translateY(-50%)' }}>
              <Carousel 
                direction="left" 
                items={carouselItems} 
                speed={1.5}
                speedMultiplier={speedMultiplier}
              />
            </div>
            
            {/* Row 2 - Middle (normal speed, left to right) */}
            <div className="w-full absolute" style={{ top: '50vh', transform: 'translateY(-50%)' }}>
              <Carousel 
                direction="left" 
                items={carouselItems} 
                speed={1}
                speedMultiplier={speedMultiplier}
              />
            </div>
            
            {/* Row 3 - Bottom (faster, right to left) */}
            <div className="w-full absolute" style={{ top: 'calc(50vh + 210px)', transform: 'translateY(-50%)' }}>
              <Carousel 
                direction="left" 
                items={carouselItems} 
                speed={0.7}
                speedMultiplier={speedMultiplier}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Black Screen Overlay */}
      <AnimatePresence>
        {showBlackScreen && (
          <motion.div
            className="fixed inset-0 bg-black z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0 }}
          >
            {/* Year Animation */}
            {song && showYear && (
              <motion.div
                className="absolute"
                style={{ top: 'calc(50% - 100px)' }}
               
              >
                <p className="text-8xl font-bold text-white">{song.release_year}</p>
              </motion.div>
            )}
            
            {/* Views Animation */}
            {song && showViews && (
              <motion.div
                className="absolute"
                style={{ top: 'calc(50% + 10px)' }}
               
              >
                <p className="text-6xl font-bold text-[#e2dcde]">{song.viewcount_formatted}</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Screen */}
      <AnimatePresence>
        {showGameScreen && showFullGameScreen && (
          <motion.div
            className="w-full max-w-2xl mx-auto p-4 md:p-6 bg-gray-800 rounded-xl shadow-2xl z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            {isLoading ? (
              <div className="text-center py-8 flex-1 flex items-center justify-center">
                <div>
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
                  <p className="text-white text-lg">Loading audio...</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col">
                {/* Song Info */}
                {song && (
                  <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-600 rounded-xl">
                    <div className="text-center">
                      <p className="text-xs text-gray-300 mb-1">Release Year</p>
                      <p className="text-xl font-bold text-white">{song.release_year}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-300 mb-1">Views</p>
                      <p className="text-xl font-bold text-white">{song.viewcount_formatted}</p>
                    </div>
                  </div>
                )}
                
                {/* Level Indicator */}
                <div className="flex justify-center gap-2 mb-4">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                        level === currentLevel
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-110'
                          : level < currentLevel
                          ? 'bg-gray-600 text-gray-300'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      Level {level}
                    </div>
                  ))}
                </div>
                
                {/* Level Description */}
                <p className="text-center text-gray-300 mb-4 text-xs">
                  {currentLevel === 1 && '🥁 Drums only'}
                  {currentLevel === 2 && '🎸 Drums + Instruments'}
                  {currentLevel === 3 && '🎤 Full song with vocals'}
                </p>
                
                {/* Play Button and Skip Song Button */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={handlePlay}
                    disabled={isFinished}
                    className={`flex-1 py-2 rounded-xl text-white font-bold text-base transition-all ${
                      isFinished
                        ? 'bg-gray-500 cursor-not-allowed'
                        : isPlaying
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg'
                        : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg'
                    }`}
                  >
                    {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                  </button>
                  <button
                    onClick={handleNext}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl text-sm transition shadow-lg"
                  >
                    ⏭️ Skip
                  </button>
                </div>
                
                {/* Message */}
                {message && (
                  <div className={`p-3 rounded-lg mb-4 text-center font-semibold text-xs ${
                    isCorrect
                      ? 'bg-green-800 text-green-100'
                      : isFinished
                      ? 'bg-red-800 text-red-100'
                      : 'bg-blue-800 text-blue-100'
                  }`}>
                    {message}
                  </div>
                )}
                
                {/* Guess Input */}
                {!isFinished && (
                  <div className="space-y-3 mb-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={guess}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                        placeholder="Type your guess..."
                        className="w-full px-3 py-2 border-2 border-gray-500 rounded-lg focus:border-indigo-500 focus:ring focus:ring-indigo-200 bg-gray-800 text-white text-sm"
                        disabled={isFinished}
                      />
                      
                      {/* Autocomplete Suggestions */}
                      {showSuggestions && searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
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
                    
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleGuess()}
                        disabled={!guess.trim()}
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-2 rounded-lg transition text-sm"
                      >
                        Submit Guess
                      </button>
                      
                      {currentLevel < 3 && (
                        <button
                          onClick={handleSkip}
                          className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-2 rounded-lg transition text-sm"
                        >
                          Skip to Level {currentLevel + 1}
                        </button>
                      )}
                    </div>
                    
                    <p className="text-center text-gray-300 text-xs">
                      Attempts: <span className="font-bold">{remainingAttempts}</span>
                    </p>
                  </div>
                )}
                
                {/* Reveal */}
                {reveal && (
                  <div className="bg-gray-600 p-4 rounded-xl mb-4">
                    <h2 className="text-lg font-bold text-center mb-2 text-white">
                      {reveal.name}
                    </h2>
                    <p className="text-base text-center mb-3 text-gray-200">
                      by {reveal.artists}
                    </p>
                    <a
                      href={reveal.youtube_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-center transition text-sm"
                    >
                      🎥 Watch on YouTube
                    </a>
                  </div>
                )}
                
                {/* Next Button */}
                {isFinished && (
                  <button
                    onClick={handleNext}
                    className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold py-3 rounded-xl text-base transition shadow-lg"
                  >
                    ▶️ Next Song
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacebar Button - Always visible */}
      <motion.div
        className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50"
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
            Hold{" "}
            <motion.button
              onClick={showGameScreen ? returnToCarousel : undefined}
              className="relative text-[10px] sm:text-xs px-4 sm:px-6 py-0.5 rounded border-2 border-gray-100 tracking-widest bg-white text-black shadow-lg overflow-hidden"
              style={{ minWidth: '80px' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10">SPACE</span>
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
    </div>
  );
}
