'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();
  const [isGameScreenActive, setIsGameScreenActive] = useState(false);

  useEffect(() => {
    const checkGameScreen = () => {
      setIsGameScreenActive(
        document.documentElement.hasAttribute('data-game-screen')
      );
    };

    checkGameScreen();

    const observer = new MutationObserver(checkGameScreen);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-game-screen'],
    });

    return () => observer.disconnect();
  }, []);

  if (pathname?.startsWith('/game') && isGameScreenActive) {
    return null;
  }
  
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 hidden sm:flex items-center justify-between px-6 py-4 bg-transparent pointer-events-none">
      {/* Copyright - Bottom left */}
      <p className="text-white text-sm opacity-70">
        © {currentYear} replay
      </p>
      
      {/* Social links - Bottom right */}
      <div className="flex items-center gap-4">
        <a 
          href="https://www.linkedin.com/in/aravchadda/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white text-sm hover:opacity-80 transition-opacity pointer-events-auto"
          aria-label="Arav"
        >
          Arav
        </a>
        <a 
          href="https://www.linkedin.com/in/suprotiv-moitra-07aa2521b/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white text-sm hover:opacity-80 transition-opacity pointer-events-auto"
          aria-label="Supro"
        >
          Supro
        </a>
        <a
          href="https://github.com/aravchadda/Guess_the_song"
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white text-sm hover:opacity-80 transition-opacity pointer-events-auto"
          aria-label="GitHub"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
