"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface CardProps {
  image: string;
  name?: string;
}

const Card = ({ image, name }: CardProps) => {
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <motion.div
      className="relative overflow-hidden rounded-sm flex justify-center items-center group hover:cursor-pointer transition-all duration-500"
      style={{
        height: 'clamp(60px, 12vw, 200px)',
        minWidth: 'clamp(60px, 12vw, 200px)',
        width: 'clamp(60px, 12vw, 200px)',
      }}
      onHoverStart={() => setShowOverlay(true)}
      onHoverEnd={() => setShowOverlay(false)}
    >
      <div
        className="h-full w-full blur-load"
        style={{
          backgroundImage: `url(blur.jpg)`,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          height: "100%",
          width: "100%",
        }}
      >
        <div className="h-[80%] w-[90%] relative inner-div rounded-2xl">
          <img
            src={image}
            alt={name || "Album cover"}
            className="absolute h-full w-full object-cover filter opacity-80 group-hover:opacity-100 transition duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect fill='%23555' width='180' height='180'/%3E%3C/svg%3E`;
            }}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default Card;

