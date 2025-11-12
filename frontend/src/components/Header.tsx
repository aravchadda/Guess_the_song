'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Header() {
  const pathname = usePathname();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGameScreenActive, setIsGameScreenActive] = useState(false);
  
  // Check for game screen data attribute
  useEffect(() => {
    const checkGameScreen = () => {
      setIsGameScreenActive(
        document.documentElement.hasAttribute('data-game-screen')
      );
    };
    
    // Check initially
    checkGameScreen();
    
    // Watch for changes using MutationObserver
    const observer = new MutationObserver(checkGameScreen);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-game-screen'],
    });
    
    return () => observer.disconnect();
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Hide header when game screen is active (but show during carousel)
  if (pathname?.startsWith('/game') && isGameScreenActive) {
    return null;
  }

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.log("Fullscreen error:", err);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-transparent">
      {/* Replay text - Top left */}
      <Link href="/" className="text-white text-3xl font-bold hover:opacity-80 transition-opacity">
        Replay
      </Link>
      
      {/* Fullscreen button - Top right */}
      <button
        onClick={toggleFullscreen}
        className="text-white text-2xl hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent rounded p-1"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        <svg 
          width="32" 
          height="32" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          {isFullscreen ? (
            // Exit fullscreen icon (two overlapping squares)
            <path d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
          ) : (
            // Enter fullscreen icon (two arrows pointing outward)
            <path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m-5.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          )}
        </svg>
      </button>
    </header>
  );
}

