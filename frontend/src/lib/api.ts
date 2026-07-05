/**
 * API Client for backend communication
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'auth_token';

/**
 * Build request headers, including the Bearer token if the user is signed in.
 */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * If a response is a 401, the stored token is stale/invalid (e.g. the server
 * rotated its signing secret). Notify AuthProvider to clear the session so
 * the app returns to the sign-in gate instead of getting stuck on the error.
 */
function notifyIfAuthExpired(response: Response) {
  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:expired'));
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

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
  availableLevels: number[];
  currentLevel: number;
}

export interface GuessResponse {
  correct: boolean;
  pointsAwarded?: number;
  totalPoints?: number;
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
  totalPoints?: number;
  songsPlayed?: number;
  successfulGuesses?: number;
  averagePointsPerSong?: number;
  guessRate?: number;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  picture?: string;
  totalPoints: number;
}

export interface LeaderboardResponse {
  top: LeaderboardEntry[];
  me: LeaderboardEntry | null;
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
    headers: authHeaders(),
    body: JSON.stringify({ mode, minYear }),
  });
  
  if (!response.ok) {
    notifyIfAuthExpired(response);
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
    headers: authHeaders(),
    body: JSON.stringify({ guess, level }),
  });
  
  if (!response.ok) {
    notifyIfAuthExpired(response);
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
    headers: authHeaders(),
  });
  
  if (!response.ok) {
    notifyIfAuthExpired(response);
    const error = await response.json();
    throw new Error(error.error || 'Failed to skip');
  }
  
  return response.json();
}

/**
 * Get global statistics
 */
export async function getStats(): Promise<Stats> {
  const response = await fetch(`${API_URL}/api/stats`);

  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }

  return response.json();
}

/**
 * Get statistics for the signed-in user
 */
export async function getMyStats(): Promise<Stats> {
  const response = await fetch(`${API_URL}/api/stats/me`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    notifyIfAuthExpired(response);
    throw new Error('Failed to fetch your stats');
  }

  return response.json();
}

/**
 * Exchange a Google ID token (credential) for an app session token + user.
 */
export async function loginWithGoogle(credential: string): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch(`${API_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Google sign-in failed');
  }

  return response.json();
}

/**
 * Fetch the current user's profile using the stored token.
 */
export async function getMe(): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    notifyIfAuthExpired(response);
    throw new Error('Not authenticated');
  }

  const data = await response.json();
  return data.user;
}

/**
 * Get the leaderboard (top 10 + the signed-in user's own rank if outside it)
 */
export async function getLeaderboard(): Promise<LeaderboardResponse> {
  const response = await fetch(`${API_URL}/api/leaderboard`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
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

