'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OrientationLockProps {
  children: React.ReactNode;
}

export default function OrientationLock({ children }: OrientationLockProps) {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if device is mobile (phone specifically, not tablet)
    const checkMobile = () => {
      const userAgent = navigator.userAgent;
      const isPhone = /iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
        (window.matchMedia && window.matchMedia('(max-width: 768px)').matches && 
         !/iPad|tablet/i.test(userAgent));
      setIsMobile(isPhone);
    };

    // Check orientation
    const checkOrientation = () => {
      // Use screen orientation API if available, otherwise fall back to dimensions
      if (window.screen && window.screen.orientation) {
        const angle = window.screen.orientation.angle;
        setIsPortrait(angle === 90 || angle === -90 ? false : true);
      } else {
        // Fallback: check if height > width
        setIsPortrait(window.innerHeight > window.innerWidth);
      }
    };

    // Initial checks
    checkMobile();
    checkOrientation();

    // Listen for orientation changes
    const handleOrientationChange = () => {
      // Small delay to ensure dimensions are updated
      setTimeout(checkOrientation, 100);
    };

    // Listen for resize events (handles both orientation and window resize)
    const handleResize = () => {
      checkOrientation();
    };

    // Listen for screen orientation changes (more reliable on modern devices)
    const handleScreenOrientationChange = () => {
      setTimeout(checkOrientation, 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);
    
    // Use Screen Orientation API if available
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handleScreenOrientationChange);
    }

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', handleScreenOrientationChange);
      }
    };
  }, []);

  // Only show lock screen on mobile devices in portrait mode
  const showLockScreen = isMobile && isPortrait;

  return (
    <>
      <AnimatePresence>
        {showLockScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] bg-[#0E0E10] flex items-center justify-center"
            style={{ touchAction: 'none' }}
          >
            <div className="text-center px-8 max-w-md">
              <motion.div
                animate={{ rotate: [0, 90, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-24 h-24 mx-auto mb-8 flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  className="w-24 h-24 text-white"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </motion.div>
              
              <h2 className="text-white text-2xl font-bold mb-4">
                Please Rotate Your Device
              </h2>
              
              <p className="text-gray-300 text-base mb-6">
                This experience is designed for landscape mode. Please rotate your phone to continue.
              </p>
              
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span>Rotate to landscape mode</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Hide content when lock screen is shown */}
      <div style={{ display: showLockScreen ? 'none' : 'block' }}>
        {children}
      </div>
    </>
  );
}

