import stringSimilarity from 'string-similarity';

/**
 * Normalize a string for comparison:
 * - Convert to lowercase
 * - Remove punctuation and special characters
 * - Replace '&' with 'and'
 * - Remove extra whitespace
 * - Remove common words that might cause issues
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Calculate token overlap between two strings
 * Returns a score from 0 to 1 based on how many tokens match
 */
function calculateTokenOverlap(str1: string, str2: string): number {
  const tokens1 = new Set(str1.split(' ').filter(t => t.length > 2));
  const tokens2 = new Set(str2.split(' ').filter(t => t.length > 2));
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

/**
 * Fuzzy match a guess against song name and artists
 * Returns true if the guess is close enough to the song
 */
export function fuzzyMatch(
  guess: string,
  songName: string,
  artists: string,
  threshold: number = 0.72
): boolean {
  const normalizedGuess = normalizeString(guess);
  const normalizedSongName = normalizeString(songName);
  const normalizedArtists = normalizeString(artists);
  
  // If guess is empty or too short, reject
  if (normalizedGuess.length < 3) return false;
  
  // Strategy 1: Check if guess contains the full song name or vice versa
  if (normalizedGuess.includes(normalizedSongName) || 
      normalizedSongName.includes(normalizedGuess)) {
    return true;
  }
  
  // Strategy 2: Check if guess contains artist name
  const artistList = normalizedArtists.split(/,|and/).map(a => a.trim());
  for (const artist of artistList) {
    if (artist && (normalizedGuess.includes(artist) || artist.includes(normalizedGuess))) {
      // If artist is mentioned, check if song name is also somewhat present
      const tokenOverlap = calculateTokenOverlap(normalizedGuess, normalizedSongName);
      if (tokenOverlap > 0.3) return true;
    }
  }
  
  // Strategy 3: Levenshtein similarity for song name
  const songSimilarity = stringSimilarity.compareTwoStrings(normalizedGuess, normalizedSongName);
  if (songSimilarity >= threshold) return true;
  
  // Strategy 4: Check similarity with combined "song by artist" format
  const combined = `${normalizedSongName} ${normalizedArtists}`;
  const combinedSimilarity = stringSimilarity.compareTwoStrings(normalizedGuess, combined);
  if (combinedSimilarity >= threshold - 0.1) return true;
  
  // Strategy 5: Token overlap as fallback
  const tokenOverlap = calculateTokenOverlap(normalizedGuess, `${normalizedSongName} ${normalizedArtists}`);
  if (tokenOverlap >= 0.6) return true;
  
  return false;
}

/**
 * Get a match score for debugging/testing purposes
 */
export function getMatchScore(guess: string, songName: string, artists: string): number {
  const normalizedGuess = normalizeString(guess);
  const normalizedSongName = normalizeString(songName);
  const normalizedArtists = normalizeString(artists);
  
  const songSimilarity = stringSimilarity.compareTwoStrings(normalizedGuess, normalizedSongName);
  const combined = `${normalizedSongName} ${normalizedArtists}`;
  const combinedSimilarity = stringSimilarity.compareTwoStrings(normalizedGuess, combined);
  
  return Math.max(songSimilarity, combinedSimilarity);
}

