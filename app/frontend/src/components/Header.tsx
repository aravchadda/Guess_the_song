'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-transparent">
      {/* Replay text - Top left */}
      <Link href="/" className="text-white text-3xl font-bold hover:opacity-80 transition-opacity">
        Replay
      </Link>
      
      {/* Music logo - Top right */}
      <div className="text-white text-2xl">
        <svg 
          width="32" 
          height="32" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="hover:opacity-80 transition-opacity"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
    </header>
  );
}

