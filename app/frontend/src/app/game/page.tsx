'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAudioManager } from '@/lib/audioManager';
import { startPlay, submitGuess, skipLevel, searchSongs, API_URL } from '@/lib/api';
import type { Song, GuessResponse, SearchResult } from '@/lib/api';

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

export default function GamePage() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isShrunk, setIsShrunk] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [currentOffsetRow2, setCurrentOffsetRow2] = useState(0);
  const [currentOffsetRow3, setCurrentOffsetRow3] = useState(0);
  const animationRef = useRef<number | null>(null);
  const isSpinningRef = useRef<boolean>(false);
  const currentOffsetRef = useRef<number>(0);
  const currentOffsetRow2Ref = useRef<number>(0);
  const currentOffsetRow3Ref = useRef<number>(0);
  
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

  // Keep refs in sync with state
  useEffect(() => {
    currentOffsetRef.current = currentOffset;
  }, [currentOffset]);

  useEffect(() => {
    currentOffsetRow2Ref.current = currentOffsetRow2;
  }, [currentOffsetRow2]);

  useEffect(() => {
    currentOffsetRow3Ref.current = currentOffsetRow3;
  }, [currentOffsetRow3]);

  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  // Trigger flip animation 0.5 seconds after stopping
  useEffect(() => {
    if (hasSpun && !isFlipped) {
      const timer = setTimeout(() => {
        setIsFlipped(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasSpun, isFlipped]);

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

  // Trigger shrink and game initialization after flip completes
  useEffect(() => {
    if (isFlipped && !isShrunk) {
      const timer = setTimeout(() => {
        setIsShrunk(true);
        initializeGame();
      }, 800); // Wait for flip animation to complete
      return () => clearTimeout(timer);
    }
  }, [isFlipped, isShrunk, initializeGame]);

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
    // Reset state
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
    setIsLoading(true);
    
    // Start new game
    initializeGame();
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioManager.current.stop();
    };
  }, []);


  // Main animation loop - handles both idle and spinning (initial spin)
  useEffect(() => {
    if (hasSpun) {
      // After spinning, only row 1 stops, rows 2 and 3 continue at their speeds (reversed direction)
      let lastTime = Date.now();
      
      const animate = () => {
        const now = Date.now();
        const deltaTime = now - lastTime;
        lastTime = now;

        // Row 2 continues at 1.5x speed (left to right, so subtract)
        const ROW2_SPEED = 0.06;
        currentOffsetRow2Ref.current -= ROW2_SPEED * (deltaTime / 16.67);
        currentOffsetRow2Ref.current = ((currentOffsetRow2Ref.current % albumCovers.length) + albumCovers.length) % albumCovers.length;
        setCurrentOffsetRow2(currentOffsetRow2Ref.current);

        // Row 3 continues at 0.7x speed (left to right, so subtract)
        const ROW3_SPEED = 0.028;
        currentOffsetRow3Ref.current -= ROW3_SPEED * (deltaTime / 16.67);
        currentOffsetRow3Ref.current = ((currentOffsetRow3Ref.current % albumCovers.length) + albumCovers.length) % albumCovers.length;
        setCurrentOffsetRow3(currentOffsetRow3Ref.current);

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      };
    }

    let lastTime = Date.now();
    let spinStartTime: number | null = null;
    let finalStopStartTime: number | null = null;
    let stopStartOffset: number | null = null;
    let stopTargetOffset: number | null = null;

    const IDLE_SPEED = 0.04;
    const START_SPEED = 0.04;
    const TARGET_SPEED = 0.008;
    const DECELERATION_TIME = 3000;
    const FINAL_STOP_DURATION = 800;

    // Different speeds for each row
    const ROW2_SPEED_MULTIPLIER = 1.5; // Row 2 goes 1.5x faster
    const ROW3_SPEED_MULTIPLIER = 0.7; // Row 3 goes 0.7x slower

    const animate = () => {
      const now = Date.now();
      const deltaTime = now - lastTime;
      lastTime = now;

      let speed = IDLE_SPEED;

      // Set spin start time when spinning begins
      if (isSpinningRef.current && spinStartTime === null) {
        spinStartTime = now;
      }

      // If spinning, calculate deceleration
      if (isSpinningRef.current && spinStartTime !== null) {
        const elapsed = now - spinStartTime;

        // Check if we should start the final smooth stop
        if (elapsed >= DECELERATION_TIME && finalStopStartTime === null) {
          const nearestAlbum = Math.round(currentOffsetRef.current);
          const distanceToNearest = Math.abs(currentOffsetRef.current - nearestAlbum);

          if (distanceToNearest < 0.3) {
            finalStopStartTime = now;
            stopStartOffset = currentOffsetRef.current;
            stopTargetOffset = nearestAlbum;
          }
        }

        // Handle final smooth stop
        if (finalStopStartTime !== null && stopStartOffset !== null && stopTargetOffset !== null) {
          const stopElapsed = now - finalStopStartTime;

          if (stopElapsed < FINAL_STOP_DURATION) {
            const progress = stopElapsed / FINAL_STOP_DURATION;
            const easeOut = 1 - Math.pow(1 - progress, 4);
            currentOffsetRef.current = stopStartOffset + (stopTargetOffset - stopStartOffset) * easeOut;
            setCurrentOffset(currentOffsetRef.current % albumCovers.length);
            
            // Continue animating rows 2 and 3 (reversed direction - left to right)
            const row2Speed = IDLE_SPEED * ROW2_SPEED_MULTIPLIER;
            currentOffsetRow2Ref.current -= row2Speed * (deltaTime / 16.67);
            currentOffsetRow2Ref.current = ((currentOffsetRow2Ref.current % albumCovers.length) + albumCovers.length) % albumCovers.length;
            setCurrentOffsetRow2(currentOffsetRow2Ref.current);

            const row3Speed = IDLE_SPEED * ROW3_SPEED_MULTIPLIER;
            currentOffsetRow3Ref.current -= row3Speed * (deltaTime / 16.67);
            currentOffsetRow3Ref.current = ((currentOffsetRow3Ref.current % albumCovers.length) + albumCovers.length) % albumCovers.length;
            setCurrentOffsetRow3(currentOffsetRow3Ref.current);

            animationRef.current = requestAnimationFrame(animate);
            return;
          } else {
            // Final stop
            const finalAlbum = stopTargetOffset % albumCovers.length;
            currentOffsetRef.current = finalAlbum;
            setCurrentOffset(finalAlbum);
            setSelectedIndex(finalAlbum);
            setIsSpinning(false);
            setHasSpun(true);
            return;
          }
        }

        // Normal deceleration
        if (elapsed < DECELERATION_TIME) {
          const progress = elapsed / DECELERATION_TIME;
          const easeOut = 1 - Math.pow(1 - progress, 3);
          speed = START_SPEED - (START_SPEED - TARGET_SPEED) * easeOut;
        } else {
          speed = TARGET_SPEED;
        }
      }

      // Move row 1 (main carousel) - right to left
      currentOffsetRef.current += speed * (deltaTime / 16.67);
      currentOffsetRef.current = currentOffsetRef.current % albumCovers.length;
      setCurrentOffset(currentOffsetRef.current);

      // Move row 2 at different speed (left to right, so subtract)
      const row2Speed = speed * ROW2_SPEED_MULTIPLIER;
      currentOffsetRow2Ref.current -= row2Speed * (deltaTime / 16.67);
      currentOffsetRow2Ref.current = ((currentOffsetRow2Ref.current % albumCovers.length) + albumCovers.length) % albumCovers.length;
      setCurrentOffsetRow2(currentOffsetRow2Ref.current);

      // Move row 3 at different speed (left to right, so subtract)
      const row3Speed = speed * ROW3_SPEED_MULTIPLIER;
      currentOffsetRow3Ref.current -= row3Speed * (deltaTime / 16.67);
      currentOffsetRow3Ref.current = ((currentOffsetRow3Ref.current % albumCovers.length) + albumCovers.length) % albumCovers.length;
      setCurrentOffsetRow3(currentOffsetRow3Ref.current);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [hasSpun]);

  const startSpin = useCallback(() => {
    if (isSpinningRef.current) return;
    setIsSpinning(true);
  }, []);

  // Handle spacebar key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !hasSpun) {
        e.preventDefault();
        if (!isSpinning) {
          startSpin();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSpinning, hasSpun, startSpin]);

  // Helper function to render a carousel row
  const renderCarouselRow = (
    rowOffset: number,
    rowOffsetRef: React.MutableRefObject<number>,
    rowIndex: number,
    isMainRow: boolean = false,
    reverseDirection: boolean = false
  ) => {
    const coverSize = 180; // Same size for all rows
    const spacing = 200; // Spacing between covers
    
    return (
      <div className="flex items-center justify-center relative" style={{ width: '100%', height: `${coverSize}px` }}>
        {albumCovers.map((cover, index) => {
          // Calculate the raw difference, handling wrap-around
          let diff = index - rowOffset;
          
          // Normalize to [-length/2, length/2] range for shortest distance
          while (diff > albumCovers.length / 2) diff -= albumCovers.length;
          while (diff < -albumCovers.length / 2) diff += albumCovers.length;
          
          const distanceFromCenter = Math.abs(diff);
          
          // Calculate visibility and position
          let opacity = 0;
          let scale = 1;
          let zIndex = 0;
          // Reverse direction: negate the diff for left-to-right movement
          let translateX = reverseDirection ? -diff * spacing : diff * spacing;
          let display = 'none';

          if (isMainRow && hasSpun) {
            // After spinning stops, fade out other albums and show only the selected album
            if (index === selectedIndex) {
              opacity = 1;
              scale = 1;
              zIndex = 10;
              display = 'block';
              translateX = 0; // Center horizontally
            } else {
              // Fade out other albums
              opacity = 0;
              display = 'block';
            }
          } else if (!isMainRow) {
            // For non-main rows (top and bottom), fade out when spinning starts
            if (isSpinning || hasSpun) {
              // Fade out top and bottom rows when spacebar is pressed
              if (distanceFromCenter <= 4) {
                display = 'block';
                opacity = 0; // Fade out completely
                scale = 1;
                zIndex = 0;
              }
            } else {
              // During idle, show albums within reasonable distance
              if (distanceFromCenter <= 4) {
                display = 'block';
                const normalizedDistance = distanceFromCenter / 4;
                opacity = 1 - normalizedDistance * 0.5;
                // No scale effect - all items same size
                scale = 1;
                zIndex = Math.floor((1 - normalizedDistance) * 10);
              }
            }
          } else if (!hasSpun) {
            // Main row during idle or spinning
            if (distanceFromCenter <= 4) {
              display = 'block';
              const normalizedDistance = distanceFromCenter / 4;
              opacity = 1 - normalizedDistance * 0.5;
              // No scale effect - all items same size
              scale = 1;
              zIndex = Math.floor((1 - normalizedDistance) * 10);
            }
          }

          // Don't render albums that are too far away
          if (display === 'none') return null;

          return (
            <motion.div
              key={`row-${rowIndex}-${index}`}
              className="absolute"
              initial={{ opacity: 0 }}
              animate={{
                opacity,
                x: translateX,
                scale,
                zIndex,
              }}
              transition={{
                opacity: isMainRow && hasSpun
                  ? (index === selectedIndex ? { duration: 0.5, ease: "easeIn" } : { duration: 1, ease: "easeOut" })
                  : (!isMainRow && (isSpinning || hasSpun))
                  ? { duration: 0.8, ease: "easeOut" } // Smooth fade-out for top/bottom rows
                  : { duration: 0.3, ease: "easeOut" },
                x: { duration: 0, ease: "linear" }, // Instant update for manual position control
                scale: { duration: 0.3, ease: "easeOut" },
              }}
              style={{
                pointerEvents: isMainRow && hasSpun && index === selectedIndex ? 'auto' : 'none',
              }}
            >
              <motion.div 
                style={{ 
                  width: isShrunk ? '500px' : `${coverSize}px`, 
                  height: isShrunk ? '700px' : `${coverSize}px`,
                }}
                animate={{
                  width: isShrunk ? '500px' : `${coverSize}px`,
                  height: isShrunk ? '700px' : `${coverSize}px`,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {isMainRow && hasSpun && index === selectedIndex ? (
                  // Flip animation container
                  <motion.div 
                    className="w-full h-full relative"
                    style={{
                      transformStyle: 'preserve-3d',
                    }}
                    initial={{ opacity: 0, rotateY: 0 }}
                    animate={{
                      opacity: 1,
                      rotateY: isFlipped ? 180 : 0,
                    }}
                    transition={{
                      opacity: { duration: 0.5, ease: "easeIn" },
                      rotateY: { duration: 0.8, ease: "easeInOut" },
                    }}
                  >
                    {/* Front side - Question mark */}
                    <motion.div 
                      className="w-full h-full bg-[#be1d15] flex items-center justify-center absolute"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                      }}
                    >
                      <span className="text-[#E2DCDE] text-[30px] md:text-[40px] font-bold">REPLAY</span>
                    </motion.div>
                    {/* Back side - Game Interface */}
                    <motion.div 
                      className="w-full h-full bg-gray-700 absolute overflow-hidden"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        rotateY: 180,
                      }}
                    >
                      {isShrunk && (
                        <div className="w-full h-full p-4 md:p-6 flex flex-col">
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
                              
                              {/* Play Button */}
                              <button
                                onClick={handlePlay}
                                disabled={isFinished}
                                className={`w-full py-2 rounded-xl text-white font-bold text-base mb-4 transition-all ${
                                  isFinished
                                    ? 'bg-gray-500 cursor-not-allowed'
                                    : isPlaying
                                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg'
                                    : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg'
                                }`}
                              >
                                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                              </button>
                              
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
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                ) : (
                  // Normal album cover during idle and spinning
                  <motion.img
                    src={`/album-covers/${encodeURIComponent(cover)}`}
                    alt=""
                    className="w-full h-full object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${coverSize}' height='${coverSize}'%3E%3Crect fill='%23555' width='${coverSize}' height='${coverSize}'/%3E%3C/svg%3E`;
                    }}
                  />
                )}
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center overflow-hidden relative">
      {/* Three-row Carousel Container */}
      <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
        {/* Row 1 - Top (Row 3 offset, slower speed, left to right) */}
        {/* Top row: 180px height, positioned so center is at 50% - 210px (90px middle row half + 30px gap + 90px top row half) */}
        <div className="absolute left-0 right-0" style={{ top: 'calc(50% - 210px)', transform: 'translateY(-50%)' }}>
          {renderCarouselRow(currentOffsetRow3, currentOffsetRow3Ref, 3, false, true)}
        </div>
        
        {/* Row 2 - Middle (Main row with game functionality, right to left) */}
        <div className="absolute left-0 right-0" style={{ top: '50%', transform: 'translateY(-50%)' }}>
          {renderCarouselRow(currentOffset, currentOffsetRef, 1, true, false)}
        </div>
        
        {/* Row 3 - Bottom (Row 2 offset, faster speed, left to right) */}
        {/* Bottom row: 180px height, positioned so center is at 50% + 210px */}
        <div className="absolute left-0 right-0" style={{ top: 'calc(50% + 210px)', transform: 'translateY(-50%)' }}>
          {renderCarouselRow(currentOffsetRow2, currentOffsetRow2Ref, 2, false, true)}
        </div>
      </div>

      {/* Spacebar Button */}
      <AnimatePresence>
        {!hasSpun && (
          <motion.button
            onClick={startSpin}
            className="fixed bottom-8 bg-white text-black font-mono text-sm px-16 py-2 shadow-lg hover:bg-gray-100 z-50"
            style={{
              borderRadius: '6px',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            space
          </motion.button>
        )}
      </AnimatePresence>

    </div>
  );
}
