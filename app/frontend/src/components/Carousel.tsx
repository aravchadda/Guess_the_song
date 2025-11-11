"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { motion, useMotionValue } from "framer-motion";
import useMeasure from "react-use-measure";
import Card from "./Card";

interface CarouselProps {
  direction?: "left" | "right";
  items: Array<{ name?: string; image: string }>;
  speed?: number; // Higher number = slower
  speedMultiplierRef: React.MutableRefObject<number>; // Ref for smooth updates without re-renders
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

const Carousel = React.memo(({ 
  direction = "left", 
  items, 
  speed = 1,
  speedMultiplierRef,
  onHoverStart,
  onHoverEnd 
}: CarouselProps) => {
  const FAST_DURATION = 37;
  
  const [ref, { width }] = useMeasure();
  const xTranslation = useMotionValue(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const speedRef = useRef(speed);
  const directionRef = useRef(direction);

  // Memoize duplicated items to prevent re-creation
  const duplicatedItems = useMemo(() => [...items, ...items], [items]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    if (width === 0) return;
    
    const cycleLength = width / 2 + 19;
    // Pre-calculate base speed multiplier to avoid division every frame
    const baseSpeedMultiplier = 1 / (FAST_DURATION * speedRef.current);
    let isRunning = true;
    isRunningRef.current = true;

    const animate = (currentTime: number) => {
      if (!isRunning || !isRunningRef.current) return;

      if (lastTimeRef.current === null) {
        lastTimeRef.current = currentTime;
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
      lastTimeRef.current = currentTime;

      if (deltaTime > 0.1) {
        // Skip large time deltas (e.g., when tab is inactive)
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate movement based on current speed (optimized - no division per frame)
      const pixelsPerSecond = cycleLength * baseSpeedMultiplier * speedMultiplierRef.current;
      const movement = directionRef.current === "left" 
        ? -pixelsPerSecond * deltaTime 
        : pixelsPerSecond * deltaTime;

      const currentPos = xTranslation.get();
      let newPos = currentPos + movement;

      // Handle looping
      if (directionRef.current === "left") {
        if (newPos <= -cycleLength) {
          newPos = newPos + cycleLength;
        }
      } else {
        if (newPos >= cycleLength) {
          newPos = newPos - cycleLength;
        }
      }

      xTranslation.set(newPos);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);
    lastTimeRef.current = null;

    return () => {
      isRunning = false;
      isRunningRef.current = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastTimeRef.current = null;
    };
  }, [width, speed]);

  return (
    <div className="relative h-[200px] md:h-[220px] overflow-x-hidden flex-1 w-full max-w-full">
      <motion.div
        className="absolute left-0 flex  md:gap-4 items-center"
        style={{ x: xTranslation }}
        ref={ref}
      
      >
        {duplicatedItems.map((item, idx) => (
          <div key={idx}>
            <Card image={item.image} name={item.name} />
          </div>
        ))}
      </motion.div>
      {/* Fade Overlay */}
      <div className="absolute inset-0 z-10 w-full pointer-events-none bg-[linear-gradient(to_right,_black_0%,_rgba(0,0,0,0.35)_40%,_rgba(0,0,0,0)_60%,_rgba(0,0,0,0.35)_80%,_black_100%)]" />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if items, speed, or direction actually change
  // speedMultiplierRef is a ref, so it doesn't need to be compared
  return (
    prevProps.items === nextProps.items &&
    prevProps.speed === nextProps.speed &&
    prevProps.direction === nextProps.direction &&
    prevProps.speedMultiplierRef === nextProps.speedMultiplierRef
  );
});

Carousel.displayName = 'Carousel';

export default Carousel;

