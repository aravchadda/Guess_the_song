'use client';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-transparent">
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
          className="text-white text-sm hover:opacity-80 transition-opacity"
          aria-label="Arav"
        >
          Arav
        </a>
        <a 
          href="https://www.linkedin.com/in/suprotiv-moitra-07aa2521b/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white text-sm hover:opacity-80 transition-opacity"
          aria-label="Supro"
        >
          Supro
        </a>
        <a 
          href="https://github.com/aravchadda/Guess_the_song" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white text-sm hover:opacity-80 transition-opacity"
          aria-label="GitHub"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}

