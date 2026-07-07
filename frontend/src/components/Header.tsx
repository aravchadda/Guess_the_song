'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Header() {
  const pathname = usePathname();
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

  // Hide header when game screen is active (but show during carousel)
  if (pathname?.startsWith('/game') && isGameScreenActive) {
    return null;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center px-4 py-4 sm:px-6 bg-transparent pointer-events-none">
      {/* Replay text - Top left */}
      <Link href="/" className="text-white text-3xl max-[480px]:text-2xl font-bold hover:opacity-80 transition-opacity pointer-events-auto">
        Replay
      </Link>
    </header>
  );
}
