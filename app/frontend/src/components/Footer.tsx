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
          href="https://twitter.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white text-sm hover:opacity-80 transition-opacity"
          aria-label="Twitter"
        >
          Twitter
        </a>
        <a 
          href="https://instagram.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white text-sm hover:opacity-80 transition-opacity"
          aria-label="Instagram"
        >
          Instagram
        </a>
        <a 
          href="https://github.com" 
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

