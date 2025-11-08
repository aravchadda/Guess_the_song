/**
 * Audio Manager - Handles preloading, decoding, and playback of audio
 * Uses Web Audio API for optimal performance
 */

export interface AudioUrls {
  level1: string;
  level2: string;
  level3: string;
}

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlaying: boolean = false;
  
  /**
   * Initialize audio context (requires user gesture)
   */
  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
  
  /**
   * Preload and decode all audio levels
   */
  async preloadAudio(songId: string, urls: AudioUrls, apiUrl: string): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call initialize() first.');
    }
    
    const levels: Array<keyof AudioUrls> = ['level1', 'level2', 'level3'];
    
    for (const level of levels) {
      const url = `${apiUrl}${urls[level]}`;
      const key = `${songId}-${level}`;
      
      try {
        // Fetch audio as ArrayBuffer
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${level}: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Decode audio data
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        // Store in memory
        this.buffers.set(key, audioBuffer);
      } catch (error) {
        console.error(`Error preloading ${level}:`, error);
        throw error;
      }
    }
  }
  
  /**
   * Play a specific level
   */
  play(songId: string, level: 1 | 2 | 3): void {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    
    // Stop current playback
    this.stop();
    
    const key = `${songId}-level${level}`;
    const buffer = this.buffers.get(key);
    
    if (!buffer) {
      throw new Error(`Audio buffer for ${key} not found. Preload first.`);
    }
    
    // Create source node
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    
    // Handle playback end
    source.onended = () => {
      this.isPlaying = false;
    };
    
    // Start playback
    source.start(0);
    this.currentSource = source;
    this.isPlaying = true;
  }
  
  /**
   * Stop current playback
   */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Already stopped
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }
  
  /**
   * Check if audio is currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }
  
  /**
   * Clear all buffers (cleanup)
   */
  clear(): void {
    this.stop();
    this.buffers.clear();
  }
  
  /**
   * Get loading progress (0-1)
   */
  getLoadedLevels(songId: string): number {
    let count = 0;
    for (let i = 1; i <= 3; i++) {
      if (this.buffers.has(`${songId}-level${i}`)) {
        count++;
      }
    }
    return count / 3;
  }
}

// Singleton instance
let audioManagerInstance: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
}

