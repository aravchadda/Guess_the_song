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
  private currentGainNode: GainNode | null = null;
  private isPlaying: boolean = false;
  private playbackStartTime: number = 0;
  private currentBuffer: AudioBuffer | null = null;
  private currentKey: string | null = null;
  private pausedKey: string | null = null;
  private pausedOffset: number = 0;
  private stoppedSources: WeakSet<AudioBufferSourceNode> = new WeakSet();
  private volumeGain: number = 1.5; // 50% louder (1.0 = normal, 1.5 = 50% increase)
  private onEndedCallback: (() => void) | null = null;
  private loadingPromises: Map<string, Promise<void>> = new Map();
  
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
   * Preload and decode all audio levels (deprecated - use loadLevel instead)
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
   * Load and decode a single audio level
   */
  async loadLevel(songId: string, level: 1 | 2 | 3, urls: AudioUrls, apiUrl: string): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call initialize() first.');
    }
    
    const levelKey: keyof AudioUrls = `level${level}` as keyof AudioUrls;
    const url = `${apiUrl}${urls[levelKey]}`;
    const key = `${songId}-level${level}`;
    
    // Check if already loaded
    if (this.buffers.has(key)) {
      return; // Already loaded, skip
    }

    const existingLoad = this.loadingPromises.get(key);
    if (existingLoad) {
      return existingLoad;
    }
    
    const loadPromise = this.fetchAndDecodeWithRetry(url, level, key);
    this.loadingPromises.set(key, loadPromise);

    try {
      await loadPromise;
    } finally {
      this.loadingPromises.delete(key);
    }
  }

  /**
   * Check if a specific level has already been decoded.
   */
  hasLevel(songId: string, level: 1 | 2 | 3): boolean {
    return this.buffers.has(`${songId}-level${level}`);
  }

  private async fetchAndDecodeWithRetry(url: string, level: 1 | 2 | 3, key: string): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call initialize() first.');
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, { cache: attempt === 1 ? 'default' : 'reload' });
        if (!response.ok) {
          throw new Error(`Failed to fetch level${level}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
        this.buffers.set(key, audioBuffer);
        return;
      } catch (error) {
        lastError = error;
        console.error(`Error loading level${level} (attempt ${attempt}/3):`, error);

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 350));
        }
      }
    }

    throw lastError;
  }
  
  /**
   * Play a specific level
   */
  play(songId: string, level: 1 | 2 | 3): void {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const key = `${songId}-level${level}`;
    const buffer = this.buffers.get(key);
    
    if (!buffer) {
      throw new Error(`Audio buffer for ${key} not found. Preload first.`);
    }

    const startOffset = this.pausedKey === key ? this.pausedOffset : 0;
    this.stopSource(false);
    
    // Create source node
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Create gain node to increase volume
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.volumeGain;
    
    // Connect: source -> gainNode -> destination
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Store references
    this.currentSource = source;
    this.currentGainNode = gainNode;
    
    // Handle playback end
    source.onended = () => {
      if (this.stoppedSources.has(source)) {
        this.stoppedSources.delete(source);
        return;
      }

      if (source !== this.currentSource) {
        return;
      }

      this.isPlaying = false;
      this.currentSource = null;
      this.currentGainNode = null;
      this.currentKey = null;
      this.currentBuffer = null;
      this.playbackStartTime = 0;

      this.pausedKey = null;
      this.pausedOffset = 0;
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    };
    
    // Start playback
    source.start(0, Math.min(startOffset, buffer.duration));
    this.currentBuffer = buffer;
    this.currentKey = key;
    this.playbackStartTime = this.audioContext.currentTime - startOffset;
    this.isPlaying = true;
    this.pausedKey = null;
    this.pausedOffset = 0;
  }

  /**
   * Pause current playback while preserving position for resume.
   */
  pause(): void {
    if (!this.currentSource || !this.audioContext || !this.currentBuffer || !this.currentKey) {
      return;
    }

    const elapsed = this.audioContext.currentTime - this.playbackStartTime;
    this.pausedOffset = Math.min(Math.max(elapsed, 0), this.currentBuffer.duration);
    this.pausedKey = this.currentKey;
    this.stopSource(false);
  }
  
  /**
   * Stop current playback
   */
  stop(): void {
    this.stopSource(true);
  }

  private stopSource(resetPausedPosition: boolean): void {
    if (this.currentSource) {
      const source = this.currentSource;
      this.currentSource = null;
      try {
        this.stoppedSources.add(source);
        source.stop();
      } catch (e) {
        // Already stopped
      }
    }
    this.currentGainNode = null;
    this.isPlaying = false;
    this.playbackStartTime = 0;
    this.currentBuffer = null;
    this.currentKey = null;

    if (resetPausedPosition) {
      this.pausedKey = null;
      this.pausedOffset = 0;
    }
  }
  
  /**
   * Get current playback progress (0-1)
   */
  getProgress(): number {
    if (!this.isPlaying || !this.currentBuffer || !this.audioContext) {
      return 0;
    }
    
    const elapsed = this.audioContext.currentTime - this.playbackStartTime;
    const duration = this.currentBuffer.duration;
    return Math.min(elapsed / duration, 1);
  }
  
  /**
   * Get current audio duration in seconds
   */
  getDuration(): number {
    return this.currentBuffer?.duration || 0;
  }
  
  /**
   * Check if audio is currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Check if playback is paused with a saved resume position.
   */
  getIsPaused(): boolean {
    return Boolean(this.pausedKey && this.pausedOffset > 0);
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

  /**
   * Set callback for when audio playback ends
   */
  setOnEnded(callback: (() => void) | null): void {
    this.onEndedCallback = callback;
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
