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

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || (response.status < 500 && response.status !== 408 && response.status !== 429)) {
        return response;
      }

      lastError = new Error(`Request failed with status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    }
  }

  throw lastError;
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
 * Options returned by GET /api/songs/filters - what the "Play with Filters"
 * picker should render, computed from what's actually in the DB.
 */
export interface FilterOptions {
  genres: string[];
  decades: number[];
  minDecadesSelected: number;
  decadeExcludedFromMinimum: number;
  hindiToggle: boolean;
}

/**
 * Filter selection sent to POST /api/songs/random when playing a filtered
 * round instead of "Play All". `decades` must include at least
 * `minDecadesSelected` decades not counting `decadeExcludedFromMinimum`
 * (enforced client-side, and re-validated by the backend).
 */
export interface GameFilters {
  decades: number[];
  genres?: string[];
  includeHindi?: boolean;
}

/**
 * Fetch the available decades/genres for the filter picker.
 */
export async function getFilterOptions(): Promise<FilterOptions> {
  const response = await fetch(`${API_URL}/api/songs/filters`);

  if (!response.ok) {
    throw new Error('Failed to fetch filter options');
  }

  return response.json();
}

/**
 * Start a new round by picking a random song.
 *
 * Stateless on the backend now (no persisted play session) - `playId` in the
 * response is just the song's id, kept under that name so call sites below
 * don't need to change.
 *
 * Pass `filters` to switch the backend into filtered mode (`mode`/`minYear`
 * are ignored server-side in that case). Omit it for the existing
 * unrestricted "Play All" behavior.
 */
export async function startPlay(mode: 'random' | 'decade', minYear?: number, filters?: GameFilters): Promise<PlayResponse> {
  const body = filters
    ? { filtered: true, decades: filters.decades, genres: filters.genres, includeHindi: filters.includeHindi }
    : { mode, minYear };

  const response = await fetchWithRetry(`${API_URL}/api/songs/random`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
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
  const response = await fetch(`${API_URL}/api/songs/${playId}/guess`, {
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
 * Skip to next level. Fully deterministic (level+1, capped at 3) now that
 * every song has all three levels, so the current level has to be passed in
 * since the backend no longer keeps any session state to read it from.
 */
export async function skipLevel(playId: string, currentLevel: number): Promise<SkipResponse> {
  const response = await fetch(`${API_URL}/api/songs/${playId}/skip`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ currentLevel }),
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
