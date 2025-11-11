'use client';

import { forwardRef, useImperativeHandle } from 'react';

interface VideoPlayerProps {
  onVideoRef: React.RefObject<HTMLVideoElement>;
  runningVideoRef: React.RefObject<HTMLVideoElement>;
  offVideoRef: React.RefObject<HTMLVideoElement>;
  onPlayClick: () => void;
  isPlaying: boolean;
  isFinished: boolean;
}

const VideoPlayer = forwardRef<HTMLDivElement, VideoPlayerProps>(
  ({ onVideoRef, runningVideoRef, offVideoRef, onPlayClick, isPlaying, isFinished }, ref) => {
    return (
      <div ref={ref} className="relative w-1/2 h-full flex items-center justify-center">
        <video
          ref={onVideoRef}
          src="/on.mp4"
          playsInline
          muted
          preload="auto"
          className="w-full h-full object-contain"
          style={{ display: 'none' }}
        />
        <video
          ref={runningVideoRef}
          src="/running.mp4"
          loop
          playsInline
          muted
          preload="auto"
          className="w-full h-full object-contain"
          style={{ display: 'none' }}
        />
        <video
          ref={offVideoRef}
          src="/off.mp4"
          playsInline
          muted
          preload="auto"
          className="w-full h-full object-contain"
          style={{ display: 'none' }}
        />
        
        {/* Play Button - Positioned relative to video container, scales with video */}
        <button
          onClick={onPlayClick}
          disabled={isFinished}
          className="absolute rounded-full border-2 border-white bg-transparent text-white flex items-center justify-center z-10 hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            bottom: '27%',
            left: '17%',
            width: 'clamp(3rem, 8%, 5rem)',
            height: 'clamp(3rem, 8%, 5rem)',
          }}
        >
          {isPlaying ? (
            <span style={{ fontSize: 'clamp(1rem, 3vw, 1.75rem)' }}>⏸</span>
          ) : (
            <span style={{ fontSize: 'clamp(1rem, 3vw, 1.75rem)', marginLeft: '0.125rem' }}>▶</span>
          )}
        </button>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;

