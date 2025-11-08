'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAudioManager } from '@/lib/audioManager';
import { startPlay, submitGuess, skipLevel, searchSongs, API_URL } from '@/lib/api';
import type { Song, GuessResponse, SearchResult } from '@/lib/api';
import Link from 'next/link';

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = searchParams.get('mode') as 'random' | 'decade' || 'random';
  const decade = searchParams.get('decade');
  
  const [playId, setPlayId] = useState<string | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [currentLevel, setCurrentLevel] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [reveal, setReveal] = useState<GuessResponse['reveal'] | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState(3);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedDecade, setSelectedDecade] = useState<string | null>(decade);
  
  const audioManager = useRef(getAudioManager());
  const searchTimeout = useRef<NodeJS.Timeout>();
  
  // Initialize and start play
  useEffect(() => {
    if (mode === 'decade' && !selectedDecade) {
      // Show decade picker
      setIsLoading(false);
      return;
    }
    
    initializeGame();
    
    return () => {
      audioManager.current.stop();
    };
  }, [selectedDecade]);
  
  const initializeGame = async () => {
    try {
      setIsLoading(true);
      
      // Initialize audio context
      await audioManager.current.initialize();
      
      // Start play
      const value = mode === 'decade' ? selectedDecade! : undefined;
      const playResponse = await startPlay(mode, value);
      
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
  };
  
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
  
  // Decade picker for decade mode
  if (mode === 'decade' && !selectedDecade) {
    const decades = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
    
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-purple-500 via-pink-500 to-red-500">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-12">
          <h1 className="text-4xl font-bold text-center mb-8 text-gray-800 dark:text-gray-100">
            Choose a Decade
          </h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {decades.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setSelectedDecade(d.toString());
                  router.push(`/game?mode=decade&decade=${d}`);
                }}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 px-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105"
              >
                {d}s
              </button>
            ))}
          </div>
          <Link href="/">
            <button className="mt-8 w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl">
              ← Back to Home
            </button>
          </Link>
        </div>
      </main>
    );
  }
  
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-xl font-semibold">Loading audio...</p>
        </div>
      </main>
    );
  }
  
  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/">
            <button className="mb-4 bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-6 rounded-lg backdrop-blur-sm transition">
              ← Back to Home
            </button>
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">🎵 Guess The Song</h1>
          <p className="text-white/80 text-lg">
            Mode: {mode === 'decade' ? `${selectedDecade}s` : 'Random'}
          </p>
        </div>
        
        {/* Game Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 mb-6">
          {/* Song Info */}
          {song && (
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">Release Year</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{song.release_year}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">Views</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{song.viewcount_formatted}</p>
              </div>
            </div>
          )}
          
          {/* Level Indicator */}
          <div className="flex justify-center gap-4 mb-6">
            {[1, 2, 3].map((level) => (
              <div
                key={level}
                className={`px-6 py-3 rounded-lg font-semibold text-lg transition-all ${
                  level === currentLevel
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-110'
                    : level < currentLevel
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500'
                }`}
              >
                Level {level}
              </div>
            ))}
          </div>
          
          {/* Level Description */}
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            {currentLevel === 1 && '🥁 Drums only'}
            {currentLevel === 2 && '🎸 Drums + Instruments'}
            {currentLevel === 3 && '🎤 Full song with vocals'}
          </p>
          
          {/* Play Button */}
          <button
            onClick={handlePlay}
            disabled={isFinished}
            className={`w-full py-4 rounded-xl text-white font-bold text-xl mb-6 transition-all ${
              isFinished
                ? 'bg-gray-400 cursor-not-allowed'
                : isPlaying
                ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg'
                : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg'
            }`}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </button>
          
          {/* Message */}
          {message && (
            <div className={`p-4 rounded-lg mb-6 text-center font-semibold ${
              isCorrect
                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                : isFinished
                ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
                : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100'
            }`}>
              {message}
            </div>
          )}
          
          {/* Guess Input */}
          {!isFinished && (
            <div className="space-y-4 mb-6">
              <div className="relative">
                <input
                  type="text"
                  value={guess}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                  placeholder="Type your guess..."
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:ring focus:ring-indigo-200 dark:bg-gray-800 dark:text-white"
                  disabled={isFinished}
                />
                
                {/* Autocomplete Suggestions */}
                {showSuggestions && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleSuggestionClick(result.hint)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                      >
                        {result.hint}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => handleGuess()}
                  disabled={!guess.trim()}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 rounded-lg transition"
                >
                  Submit Guess
                </button>
                
                {currentLevel < 3 && (
                  <button
                    onClick={handleSkip}
                    className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-3 rounded-lg transition"
                  >
                    Skip to Level {currentLevel + 1}
                  </button>
                )}
              </div>
              
              <p className="text-center text-gray-600 dark:text-gray-400">
                Attempts remaining: <span className="font-bold text-lg">{remainingAttempts}</span>
              </p>
            </div>
          )}
          
          {/* Reveal */}
          {reveal && (
            <div className="bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 p-6 rounded-xl">
              <h2 className="text-2xl font-bold text-center mb-4 text-gray-800 dark:text-gray-100">
                {reveal.name}
              </h2>
              <p className="text-xl text-center mb-4 text-gray-700 dark:text-gray-200">
                by {reveal.artists}
              </p>
              <a
                href={reveal.youtube_link}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg text-center transition"
              >
                🎥 Watch on YouTube
              </a>
            </div>
          )}
          
          {/* Next Button */}
          {isFinished && (
            <button
              onClick={handleNext}
              className="w-full mt-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold py-4 rounded-xl text-xl transition shadow-lg"
            >
              ▶️ Next Song
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-xl font-semibold">Loading...</p>
        </div>
      </main>
    }>
      <GameContent />
    </Suspense>
  );
}

