/**
 * API Client for backend communication
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Song {
  id: string;
  release_year: number;
  viewcount_formatted: string;
  audio_urls: {
    level1: string;
    level2: string;
    level3: string;
  };
}

export interface PlayResponse {
  playId: string;
  song: Song;
}

export interface GuessResponse {
  correct: boolean;
  reveal?: {
    name: string;
    artists: string;
    youtube_link: string;
  };
}

export interface SkipResponse {
  currentLevel: number;
}

export interface Stats {
  totalPlays: number;
  correctPlays: number;
  averageLevel: number;
  distribution: {
    level1: number;
    level2: number;
    level3: number;
    failed: number;
  };
}

export interface SearchResult {
  id: string;
  hint: string;
}

/**
 * Start a new play session
 */
export async function startPlay(mode: 'random' | 'decade', minYear?: number): Promise<PlayResponse> {
  const response = await fetch(`${API_URL}/api/plays/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode, minYear }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start play');
  }
  
  return response.json();
}

/**
 * Submit a guess
 */
export async function submitGuess(playId: string, guess: string, level?: number): Promise<GuessResponse> {
  const response = await fetch(`${API_URL}/api/plays/${playId}/guess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ guess, level }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit guess');
  }
  
  return response.json();
}

/**
 * Skip to next level
 */
export async function skipLevel(playId: string): Promise<SkipResponse> {
  const response = await fetch(`${API_URL}/api/plays/${playId}/skip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to skip');
  }
  
  return response.json();
}

/**
 * Get statistics
 */
export async function getStats(): Promise<Stats> {
  const response = await fetch(`${API_URL}/api/stats`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }
  
  return response.json();
}

/**
 * Search songs (for autocomplete)
 */
export async function searchSongs(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];
  
  const response = await fetch(`${API_URL}/api/songs/search?q=${encodeURIComponent(query)}`);
  
  if (!response.ok) {
    return [];
  }
  
  return response.json();
}

export { API_URL };

