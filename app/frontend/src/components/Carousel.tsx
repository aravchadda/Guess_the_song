"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, animate, useMotionValue } from "framer-motion";
import useMeasure from "react-use-measure";
import Card from "./Card";

interface CarouselProps {
  direction?: "left" | "right";
  items: Array<{ name?: string; image: string }>;
  speed?: number; // Higher number = slower
  speedMultiplier?: number; // Multiplier for speed (1 = normal, >1 = faster)
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

const Carousel = ({ 
  direction = "left", 
  items, 
  speed = 1,
  speedMultiplier = 1,
  onHoverStart,
  onHoverEnd 
}: CarouselProps) => {
  const FAST_DURATION = 37;
  const SLOW_DURATION = 75;
  
  const [mustFinish, setMustFinish] = useState(false);
  const [rerender, setRerender] = useState(false);
  const [ref, { width }] = useMeasure();
  const xTranslation = useMotionValue(0);
  const controlsRef = useRef<any>(null);
  const lastSpeedMultiplierRef = useRef(speedMultiplier);

  useEffect(() => {
    if (width === 0) return;
    
    const finalPosition = direction === "left" ? -width / 2 - 19 : width / 2 + 19;
    const duration = FAST_DURATION * speed / speedMultiplier;
    const speedChanged = lastSpeedMultiplierRef.current !== speedMultiplier;
    lastSpeedMultiplierRef.current = speedMultiplier;

    // Stop existing animation if speed multiplier changed
    if (controlsRef.current && speedChanged) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }

    if (mustFinish) {
      controlsRef.current = animate(xTranslation, [xTranslation.get(), finalPosition], {
        ease: "linear",
        duration: duration * (1 - Math.abs(xTranslation.get()) / Math.abs(finalPosition)),
        onComplete: () => {
          setMustFinish(false);
          setRerender(!rerender);
          controlsRef.current = null;
        },
      });
    } else {
      // Only restart animation if speed multiplier changed or no animation is running
      if (!controlsRef.current || speedChanged) {
        // Get current position
        const currentPos = xTranslation.get();
        
        // If speed is resetting to 1 (abrupt transition), restart from current position with full duration
        // Otherwise, calculate remaining duration for smooth transition
        if (speedMultiplier === 1 && speedChanged) {
          // Abrupt transition: restart with full duration from current position
          controlsRef.current = animate(xTranslation, [currentPos, finalPosition], {
            ease: "linear",
            duration: duration,
            repeat: Infinity,
            repeatType: "loop",
            repeatDelay: 0,
          });
        } else {
          // Smooth transition: calculate remaining distance
          const cycleLength = Math.abs(finalPosition);
          const normalizedPos = direction === "left" ? -currentPos : currentPos;
          const currentCycleProgress = normalizedPos % cycleLength;
          const remainingDistance = cycleLength - currentCycleProgress;
          
          // Calculate remaining duration based on current speed
          const remainingDuration = (remainingDistance / cycleLength) * duration;
          
          // Continue from current position with adjusted duration
          controlsRef.current = animate(xTranslation, [currentPos, finalPosition], {
            ease: "linear",
            duration: remainingDuration,
            repeat: Infinity,
            repeatType: "loop",
            repeatDelay: 0,
          });
        }
      }
    }

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [rerender, xTranslation, speed, speedMultiplier, width, direction, mustFinish]);

  return (
    <div className="relative h-[200px] md:h-[220px] overflow-x-hidden flex-1 w-full max-w-full">
      <motion.div
        className="absolute left-0 flex gap-12 md:gap-16 items-center"
        style={{ x: xTranslation }}
        ref={ref}
      
      >
        {[...items, ...items].map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <Card image={item.image} name={item.name} />
          </motion.div>
        ))}
      </motion.div>
      {/* Fade Overlay */}
      <div className="absolute inset-0 z-10 w-full pointer-events-none bg-[linear-gradient(to_right,_black_0%,_rgba(0,0,0,0.35)_40%,_rgba(0,0,0,0)_60%,_rgba(0,0,0,0.35)_80%,_black_100%)]" />
    </div>
  );
};

export default Carousel;

