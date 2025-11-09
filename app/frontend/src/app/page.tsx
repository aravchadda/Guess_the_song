'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-12">
        <h1 className="text-5xl font-bold text-center mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          🎵 Guess The Song
        </h1>
        
        <p className="text-lg text-gray-700 dark:text-gray-300 text-center mb-8">
          Test your music knowledge! Listen to progressive reveals and guess the song.
        </p>
        
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
            How to Play:
          </h2>
          <ol className="space-y-3 text-gray-700 dark:text-gray-300">
            <li className="flex items-start">
              <span className="font-bold text-indigo-600 mr-3">1.</span>
              <span>Listen to <strong>Level 1</strong> (drums only)</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-indigo-600 mr-3">2.</span>
              <span>If you can't guess, advance to <strong>Level 2</strong> (drums + instruments)</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-indigo-600 mr-3">3.</span>
              <span>Still stuck? Advance to <strong>Level 3</strong> (full song with vocals)</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-indigo-600 mr-3">4.</span>
              <span>You have <strong>3 attempts</strong> to guess correctly</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold text-indigo-600 mr-3">5.</span>
              <span>Your goal: Guess with as few clues as possible!</span>
            </li>
          </ol>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-center mb-4 text-gray-800 dark:text-gray-200">
            Choose Mode:
          </h2>
          
          <Link href="/game?mode=random">
            <button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105">
              🎲 Random Song
            </button>
          </Link>
          
          <Link href="/game?mode=decade">
            <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105">
              📅 Pick a Decade
            </button>
          </Link>
          
          <Link href="/stats">
            <button className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105">
              📊 View Statistics
            </button>
          </Link>
          
          <Link href="/carousel">
            <button className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105">
              🎰 Album Slot Machine
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}

