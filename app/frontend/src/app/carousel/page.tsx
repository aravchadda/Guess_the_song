'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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

export default function CarouselPage() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const animationRef = useRef<number | null>(null);
  const isSpinningRef = useRef<boolean>(false);
  const currentOffsetRef = useRef<number>(0);
  const isSpaceHeldRef = useRef<boolean>(false);

  // Keep refs in sync with state
  useEffect(() => {
    currentOffsetRef.current = currentOffset;
  }, [currentOffset]);

  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  useEffect(() => {
    isSpaceHeldRef.current = isSpaceHeld;
  }, [isSpaceHeld]);

  // Trigger flip animation 0.5 seconds after stopping
  useEffect(() => {
    if (hasSpun && !isFlipped) {
      const timer = setTimeout(() => {
        setIsFlipped(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasSpun, isFlipped]);

  // Animation loop for after stopping - hold spacebar to scroll
  useEffect(() => {
    if (!hasSpun) return; // Only run after initial stop

    let lastTime = Date.now();
    let releaseTime: number | null = null;
    let releaseStartOffset: number | null = null;
    let releaseTargetOffset: number | null = null;
    let finalStopStartTime: number | null = null;
    let wasScrolling = false;

    const SCROLL_SPEED = 0.05;
    const TARGET_SPEED = 0.008;
    const DECELERATION_TIME = 3000;
    const FINAL_STOP_DURATION = 800;

    const animate = () => {
      const now = Date.now();
      const deltaTime = now - lastTime;
      lastTime = now;

      // If spacebar is held, move at constant speed
      if (isSpaceHeldRef.current) {
        // If we were decelerating, cancel it and start scrolling
        if (releaseTime !== null) {
          releaseTime = null;
          releaseStartOffset = null;
          releaseTargetOffset = null;
          finalStopStartTime = null;
        }
        wasScrolling = true;
        currentOffsetRef.current += SCROLL_SPEED * (deltaTime / 16.67);
        currentOffsetRef.current = currentOffsetRef.current % albumCovers.length;
        setCurrentOffset(currentOffsetRef.current);
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // If spacebar was released, start deceleration
      if (!isSpaceHeldRef.current && releaseTime === null && wasScrolling) {
        releaseTime = now;
        releaseStartOffset = currentOffsetRef.current;
        wasScrolling = false;
      }

      // Handle deceleration after release
      if (releaseTime !== null && releaseStartOffset !== null) {
        const elapsed = now - releaseTime;

        // Check if we should start the final smooth stop
        if (elapsed >= DECELERATION_TIME && finalStopStartTime === null) {
          const nearestAlbum = Math.round(currentOffsetRef.current);
          const distanceToNearest = Math.abs(currentOffsetRef.current - nearestAlbum);

          if (distanceToNearest < 0.3) {
            finalStopStartTime = now;
            releaseStartOffset = currentOffsetRef.current; // Update to current position when final stop begins
            releaseTargetOffset = nearestAlbum;
          }
        }

        // Handle final smooth stop
        if (finalStopStartTime !== null && releaseStartOffset !== null && releaseTargetOffset !== null) {
          const stopElapsed = now - finalStopStartTime;

          if (stopElapsed < FINAL_STOP_DURATION) {
            const progress = stopElapsed / FINAL_STOP_DURATION;
            const easeOut = 1 - Math.pow(1 - progress, 4);
            currentOffsetRef.current = releaseStartOffset + (releaseTargetOffset - releaseStartOffset) * easeOut;
            setCurrentOffset(currentOffsetRef.current % albumCovers.length);
            animationRef.current = requestAnimationFrame(animate);
            return;
          } else {
            // Final stop
            const finalAlbum = releaseTargetOffset % albumCovers.length;
            currentOffsetRef.current = finalAlbum;
            setCurrentOffset(finalAlbum);
            setSelectedIndex(finalAlbum);
            setIsSpinning(false);
            releaseTime = null;
            releaseStartOffset = null;
            releaseTargetOffset = null;
            finalStopStartTime = null;
            wasScrolling = false;
            return;
          }
        }

        // Normal deceleration - exactly matching initial spin
        let speed;
        if (elapsed < DECELERATION_TIME) {
          const progress = elapsed / DECELERATION_TIME;
          const easeOut = 1 - Math.pow(1 - progress, 3);
          speed = SCROLL_SPEED - (SCROLL_SPEED - TARGET_SPEED) * easeOut;
        } else {
          speed = TARGET_SPEED;
        }

        currentOffsetRef.current += speed * (deltaTime / 16.67);
        currentOffsetRef.current = currentOffsetRef.current % albumCovers.length;
        setCurrentOffset(currentOffsetRef.current);
      }

      // Always continue animation loop to detect spacebar state changes
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [hasSpun, isSpaceHeld]);

  // Main animation loop - handles both idle and spinning (initial spin)
  useEffect(() => {
    if (hasSpun) return; // Don't animate after stopping

    let lastTime = Date.now();
    let spinStartTime: number | null = null;
    let finalStopStartTime: number | null = null;
    let stopStartOffset: number | null = null;
    let stopTargetOffset: number | null = null;

    const IDLE_SPEED = 0.05;
    const START_SPEED = 0.05;
    const TARGET_SPEED = 0.008;
    const DECELERATION_TIME = 3000;
    const FINAL_STOP_DURATION = 800;

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

      // Move the carousel
      currentOffsetRef.current += speed * (deltaTime / 16.67);
      currentOffsetRef.current = currentOffsetRef.current % albumCovers.length;
      setCurrentOffset(currentOffsetRef.current);

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

  // Handle spacebar key press and release
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!hasSpun) {
          // Initial spin
          if (!isSpinning) {
            startSpin();
          }
        } else {
          // After stopping, hold to scroll
          if (!isSpaceHeld) {
            setIsSpaceHeld(true);
            setIsSpinning(true);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (hasSpun && isSpaceHeld) {
          // Release spacebar - trigger deceleration
          setIsSpaceHeld(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpinning, hasSpun, isSpaceHeld, startSpin]);

  const reset = () => {
    setHasSpun(false);
    setIsSpinning(false);
    setIsFlipped(false);
    setIsSpaceHeld(false);
    setCurrentOffset(0);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-500 flex flex-col items-center justify-center overflow-hidden relative">
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
      {/* Full-page Carousel Container */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="flex items-center justify-center">
          {albumCovers.map((cover, index) => {
            // Calculate the raw difference, handling wrap-around
            let diff = index - currentOffset;
            
            // Normalize to [-length/2, length/2] range for shortest distance
            while (diff > albumCovers.length / 2) diff -= albumCovers.length;
            while (diff < -albumCovers.length / 2) diff += albumCovers.length;
            
            const distanceFromCenter = Math.abs(diff);
            
            // Calculate visibility and position
            let opacity = 0;
            let scale = 1;
            let zIndex = 0;
            let translateX = diff * 1000;
            let display = 'none';

            if (hasSpun) {
              // After spinning stops, fade out other albums and show only the selected album
              if (index === selectedIndex) {
                opacity = 1;
                scale = 1.2;
                zIndex = 10;
                display = 'block';
              } else {
                // Fade out other albums
                opacity = 0;
                display = 'block';
              }
            } else {
              // During spinning or idle, show only albums within reasonable distance
              if (distanceFromCenter <= 3) {
                display = 'block';
                const normalizedDistance = distanceFromCenter / 3;
                opacity = 1 - normalizedDistance * 0.6;
                // Scale effect: larger at center, smaller on sides
                scale = 1.2 - (normalizedDistance * 0.7); // 1.2 at center, 0.5 at edges
                zIndex = Math.floor((1 - normalizedDistance) * 10);
              }
            }

            // Don't render albums that are too far away
            if (display === 'none') return null;

            return (
              <div
                key={index}
                className="absolute"
                style={{
                  opacity,
                  transform: `translateX(${translateX}px) scale(${scale})`,
                  zIndex,
                  pointerEvents: 'none',
                  transition: hasSpun 
                    ? (index === selectedIndex ? 'opacity 0.5s ease-in' : 'opacity 1s ease-out')
                    : 'opacity 0.3s ease-out',
                }}
              >
                <div className="w-[675px] h-[675px]">
                  {hasSpun && index === selectedIndex ? (
                    // Flip animation container
                    <div 
                      className="w-full h-full relative"
                      style={{
                        transformStyle: 'preserve-3d',
                        transition: 'transform 0.8s ease-in-out',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        animation: 'fadeIn 0.5s ease-in',
                      }}
                    >
                      {/* Front side - Question mark */}
                      <div 
                        className="w-full h-full bg-gray-700 flex items-center justify-center absolute"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                        }}
                      >
                        <span className="text-white text-[300px] font-bold">?</span>
                      </div>
                      {/* Back side - Fully gray */}
                      <div 
                        className="w-full h-full bg-gray-700 absolute"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                        }}
                      />
                    </div>
                  ) : (
                    // Normal album cover during idle and spinning
                    <img
                      src={`/api/album-cover/${encodeURIComponent(cover)}`}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='675' height='675'%3E%3Crect fill='%23555' width='675' height='675'/%3E%3C/svg%3E`;
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spacebar Button */}
      {!hasSpun && (
        <button
          onClick={startSpin}
          className="fixed bottom-8 bg-white text-black font-mono text-sm px-16 py-2 shadow-lg hover:bg-gray-100 transition-colors z-50"
          style={{
            borderRadius: '6px',
          }}
        >
          space
        </button>
      )}
    </div>
  );
}

