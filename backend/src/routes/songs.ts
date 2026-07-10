import { Router, Request, Response } from 'express';
import Song, { GENRES, Genre } from '../models/Song';
import User from '../models/User';
import { fuzzyMatch } from '../utils/fuzzyMatch';
import { formatViewCount } from '../utils/viewCountFormatter';
import { optionalAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

// The tickable genre checkboxes in the filter UI - every genre except Hindi,
// which is its own separate include/exclude toggle (a song's genre is still
// literally "Hindi" in the DB, it's just not offered as a checkbox alongside
// Pop/Rock/Hip-Hop/R&B).
const SELECTABLE_GENRES = GENRES.filter((g) => g !== 'Hindi') as Exclude<Genre, 'Hindi'>[];

// Decades don't count toward the "select at least 2" minimum when filtering
// - the 70s stratum is small enough that requiring it not count keeps the
// selected pool from being too thin.
const DECADE_MIN_EXCLUDED = 1970;
const MIN_DECADES_SELECTED = 2;

// Points awarded for a correct guess, by the level it was guessed on
const LEVEL_POINTS: Record<number, number> = { 1: 10, 2: 5, 3: 1 };

// Which per-level successfulGuesses counter a level corresponds to.
// level 1 = drums only (hardest), level 2 = vocals removed, level 3 = full mix (easiest).
const LEVEL_COUNTER: Record<number, 'drums' | 'instruments' | 'vocals'> = {
  1: 'drums',
  2: 'instruments',
  3: 'vocals'
};

// Play is available to guests. Signed-in users get persistent points/stats.
router.use(optionalAuth);

/**
 * GET /api/songs/search?q=query
 * Search songs for autocomplete (returns limited data)
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.json([]);
    }

    // Search in name and artists with regex
    const searchRegex = new RegExp(q.trim(), 'i');
    const songs = await Song.find({
      $or: [
        { name: searchRegex },
        { artists: searchRegex }
      ]
    })
    .select('_id name artists')
    .limit(10)
    .lean();

    // Return hints (partial info)
    const results = songs.map(song => ({
      id: song._id,
      hint: `${song.name} - ${song.artists}`
    }));

    res.json(results);
  } catch (error) {
    console.error('Error searching songs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/songs/filters
 * What the filter UI (decades on the left, genres on the right) should
 * render, computed from what's actually in the DB rather than hardcoded on
 * the frontend.
 */
router.get('/filters', async (_req: Request, res: Response) => {
  try {
    const decades = await Song.distinct('decade');
    res.json({
      genres: SELECTABLE_GENRES,
      decades: decades.sort((a: number, b: number) => a - b),
      minDecadesSelected: MIN_DECADES_SELECTED,
      decadeExcludedFromMinimum: DECADE_MIN_EXCLUDED,
      hindiToggle: true
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/songs/random
 * Pick a random song matching the given mode/criteria to start a round.
 *
 * Stateless -- unlike the old Play-collection design, there's no persisted
 * session. The "playId" in the response is just the song's id, kept under
 * that name so existing frontend calls don't need to change shape. Every
 * song in the current dataset has all three levels on disk, so there's no
 * need to retry for missing audio the way the old Play-based selection did.
 *
 * Two ways to call this:
 * 1. "Play All" - omit `filtered` (or send it false). Legacy `mode`/`value`/
 *    `minYear` fields still work exactly as before. Pool is unrestricted by
 *    genre, including Hindi.
 * 2. "Play with Filters" - send `filtered: true` plus `decades` (>= 2,
 *    not counting 1970), optionally `genres` (subset of Pop/Rock/Hip-Hop/R&B;
 *    omitted/empty = all 4) and `includeHindi` (default false, adds Hindi
 *    songs into the pool on top of whatever genres are selected).
 */
router.post('/random', async (req: AuthedRequest, res: Response) => {
  try {
    const { mode = 'random', value, minYear, filtered, decades, genres, includeHindi } = req.body;

    let query: any = {};

    if (filtered) {
      if (!Array.isArray(decades)) {
        return res.status(400).json({ error: '"decades" must be an array when filtered is true' });
      }
      const parsedDecades: number[] = decades.map((d: any) => parseInt(d, 10));
      if (parsedDecades.some((d) => isNaN(d))) {
        return res.status(400).json({ error: 'Every decade must be a number (e.g., 1990)' });
      }
      const countingTowardMinimum = parsedDecades.filter((d) => d !== DECADE_MIN_EXCLUDED);
      if (countingTowardMinimum.length < MIN_DECADES_SELECTED) {
        return res.status(400).json({
          error: `Select at least ${MIN_DECADES_SELECTED} decades (the ${DECADE_MIN_EXCLUDED}s don't count toward this minimum)`
        });
      }
      query.decade = { $in: parsedDecades };

      let genreList: string[] = Array.isArray(genres) && genres.length > 0 ? genres : SELECTABLE_GENRES;
      const invalidGenre = genreList.find((g) => !(SELECTABLE_GENRES as readonly string[]).includes(g));
      if (invalidGenre) {
        return res.status(400).json({ error: `Invalid genre "${invalidGenre}". Must be one of: ${SELECTABLE_GENRES.join(', ')}` });
      }
      if (includeHindi) {
        genreList = [...genreList, 'Hindi'];
      }
      query.genre = { $in: genreList };
    } else {
      if (!['random', 'decade'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Must be "random" or "decade"' });
      }

      if (mode === 'decade') {
        if (!value) {
          return res.status(400).json({ error: 'Decade mode requires a "value" parameter' });
        }
        const decade = parseInt(value);
        if (isNaN(decade)) {
          return res.status(400).json({ error: 'Decade must be a number (e.g., 1990)' });
        }
        query.decade = decade;
      }

      if (minYear !== undefined && minYear !== null) {
        const year = parseInt(minYear);
        if (isNaN(year)) {
          return res.status(400).json({ error: 'minYear must be a number' });
        }
        query.release_year = { $gte: year };
      }
    }

    const count = await Song.countDocuments(query);
    if (count === 0) {
      return res.status(404).json({ error: 'No songs found for the selected criteria' });
    }

    const randomIndex = Math.floor(Math.random() * count);
    const song = await Song.findOne(query).skip(randomIndex);
    if (!song) {
      return res.status(404).json({ error: 'No songs found for the selected criteria' });
    }

    res.json({
      playId: song._id,
      availableLevels: [1, 2, 3],
      currentLevel: 1,
      song: {
        id: song._id,
        release_year: song.release_year,
        viewcount_formatted: formatViewCount(song.viewcount),
        audio_urls: {
          level1: `/api/audio/${song._id}/level1`,
          level2: `/api/audio/${song._id}/level2`,
          level3: `/api/audio/${song._id}/level3`
        }
      }
    });
  } catch (error) {
    console.error('Error picking random song:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/songs/:id/guess
 * Submit a guess for a song. Stateless: verifies directly against the Song
 * record and, for signed-in users, increments the relevant counter instead
 * of writing a Play session document.
 */
router.post('/:id/guess', async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { guess, level } = req.body;

    if (!guess || typeof guess !== 'string') {
      return res.status(400).json({ error: 'Guess is required and must be a string' });
    }

    const guessLevel = level !== undefined ? parseInt(level) : 1;
    if (guessLevel < 1 || guessLevel > 3) {
      return res.status(400).json({ error: 'Level must be between 1 and 3' });
    }

    const song = await Song.findById(id);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const threshold = parseFloat(process.env.MATCH_THRESHOLD || '0.72');
    const isCorrect = fuzzyMatch(guess, song.name, song.artists, threshold);

    if (isCorrect) {
      const pointsAwarded = LEVEL_POINTS[guessLevel] || 0;
      const counter = LEVEL_COUNTER[guessLevel];

      const user = req.userId
        ? await User.findByIdAndUpdate(
            req.userId,
            {
              $inc: {
                [`successfulGuesses.${counter}`]: 1,
                totalPoints: pointsAwarded,
                songsPlayed: 1
              }
            },
            { new: true }
          )
        : null;

      return res.json({
        correct: true,
        pointsAwarded,
        totalPoints: user?.totalPoints,
        reveal: {
          name: song.name,
          artists: song.artists,
          youtube_link: song.youtube_link
        }
      });
    }

    // Wrong guess
    if (guessLevel === 3) {
      // Wrong on the last level (full mix) - game over
      const user = req.userId
        ? await User.findByIdAndUpdate(
            req.userId,
            { $inc: { songsPlayed: 1, failedGuesses: 1 } },
            { new: true }
          )
        : null;

      return res.json({
        correct: false,
        pointsAwarded: 0,
        totalPoints: user?.totalPoints,
        reveal: {
          name: song.name,
          artists: song.artists,
          youtube_link: song.youtube_link
        }
      });
    }

    // Wrong on drums or instruments - frontend advances to the next level
    res.json({ correct: false });
  } catch (error) {
    console.error('Error processing guess:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/songs/:id/skip
 * Advance to the next level. Fully stateless/deterministic now that every
 * song has all three levels on disk -- just level+1, capped at 3.
 */
router.post('/:id/skip', async (req: AuthedRequest, res: Response) => {
  try {
    const { currentLevel } = req.body;
    const level = currentLevel !== undefined ? parseInt(currentLevel) : 1;

    if (isNaN(level) || level < 1 || level > 3) {
      return res.status(400).json({ error: 'currentLevel must be between 1 and 3' });
    }

    if (level >= 3) {
      return res.status(400).json({ error: 'Already on the last level' });
    }

    res.json({ currentLevel: level + 1 });
  } catch (error) {
    console.error('Error skipping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
