import { Router, Request, Response } from 'express';
import Song from '../models/Song';
import Play from '../models/Play';
import User from '../models/User';
import { fuzzyMatch } from '../utils/fuzzyMatch';
import { formatViewCount } from '../utils/viewCountFormatter';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { getAvailableLevels } from '../utils/audioAvailability';

const router = Router();

const MAX_SONG_SELECTION_ATTEMPTS = 10;

// Points awarded for a correct guess, by the level it was guessed on
const LEVEL_POINTS: Record<number, number> = { 1: 10, 2: 5, 3: 1 };

// All play actions require an authenticated user
router.use(requireAuth);

/**
 * POST /api/plays/start
 * Start a new play session
 */
router.post('/start', async (req: AuthedRequest, res: Response) => {
  try {
    const { mode = 'random', value, minYear } = req.body;
    
    // Validate mode
    if (!['random', 'decade'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be "random" or "decade"' });
    }
    
    // Build query based on mode
    let query: any = {};
    let modeValue: string | undefined;
    
    if (mode === 'decade') {
      if (!value) {
        return res.status(400).json({ error: 'Decade mode requires a "value" parameter' });
      }
      const decade = parseInt(value);
      if (isNaN(decade)) {
        return res.status(400).json({ error: 'Decade must be a number (e.g., 1990)' });
      }
      query.decade = decade;
      modeValue = decade.toString();
    }
    
    // Filter by minimum year if provided
    if (minYear !== undefined && minYear !== null) {
      const year = parseInt(minYear);
      if (isNaN(year)) {
        return res.status(400).json({ error: 'minYear must be a number' });
      }
      query.release_year = { $gte: year };
    }
    
    // Get random song matching the criteria
    const count = await Song.countDocuments(query);
    if (count === 0) {
      return res.status(404).json({ error: 'No songs found for the selected criteria' });
    }

    // A song's audio can be missing a level (or all of them) on disk - e.g. a
    // silent/trimmed stem that never got exported. Re-roll a few times rather
    // than starting a play that can never be won.
    let song = null;
    let availableLevels: number[] = [];
    for (let attempt = 0; attempt < MAX_SONG_SELECTION_ATTEMPTS; attempt++) {
      const randomIndex = Math.floor(Math.random() * count);
      const candidate = await Song.findOne(query).skip(randomIndex);
      if (!candidate) continue;

      const levels = getAvailableLevels(candidate);
      if (levels.length > 0) {
        song = candidate;
        availableLevels = levels;
        break;
      }
    }

    if (!song) {
      return res.status(404).json({ error: 'No playable songs found for the selected criteria' });
    }

    // Create play record, starting at whichever level is actually available first
    const play = new Play({
      songId: song._id,
      userId: req.userId,
      mode,
      modeValue,
      startedAt: new Date(),
      currentLevel: Math.min(...availableLevels),
      availableLevels,
      wasCorrect: false,
      attempts: []
    });

    await play.save();

    // Return play data (without revealing song name/artists)
    // Use song ID-based URLs instead of file paths to hide song name
    res.json({
      playId: play._id,
      availableLevels,
      currentLevel: play.currentLevel,
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
    console.error('Error starting play:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/plays/:playId/guess
 * Submit a guess for the current play
 */
router.post('/:playId/guess', async (req: AuthedRequest, res: Response) => {
  try {
    const { playId } = req.params;
    const { guess, level } = req.body;

    if (!guess || typeof guess !== 'string') {
      return res.status(400).json({ error: 'Guess is required and must be a string' });
    }

    // Find play
    const play = await Play.findById(playId).populate<{ songId: any }>('songId');
    if (!play) {
      return res.status(404).json({ error: 'Play not found' });
    }

    // Ensure the play belongs to the authenticated user
    if (play.userId && play.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'This play does not belong to you' });
    }

    // Check if already finished
    if (play.finishedAt) {
      return res.status(400).json({ error: 'This play is already finished' });
    }
    
    // Use provided level or current level
    const guessLevel = level !== undefined ? parseInt(level) : play.currentLevel;
    if (guessLevel < 1 || guessLevel > 3) {
      return res.status(400).json({ error: 'Level must be between 1 and 3' });
    }
    
    const song = play.songId;
    
    // Perform fuzzy match
    const threshold = parseFloat(process.env.MATCH_THRESHOLD || '0.72');
    const isCorrect = fuzzyMatch(guess, song.name, song.artists, threshold);
    
    // Record attempt
    play.attempts.push({
      attemptNumber: play.attempts.length + 1,
      guessText: guess,
      timestamp: new Date(),
      correct: isCorrect
    });
    
    if (isCorrect) {
      // Correct guess - game won
      const pointsAwarded = LEVEL_POINTS[guessLevel] || 0;
      play.wasCorrect = true;
      play.guessedLevel = guessLevel;
      play.pointsAwarded = pointsAwarded;
      play.finishedAt = new Date();
      await play.save();

      const user = await User.findByIdAndUpdate(
        req.userId,
        { $inc: { totalPoints: pointsAwarded, songsPlayed: 1, successfulGuesses: 1 } },
        { new: true }
      );

      return res.json({
        correct: true,
        pointsAwarded,
        totalPoints: user?.totalPoints ?? pointsAwarded,
        reveal: {
          name: song.name,
          artists: song.artists,
          youtube_link: song.youtube_link
        }
      });
    }

    // Wrong guess
    const lastAvailableLevel = Math.max(...play.availableLevels);
    if (guessLevel === lastAvailableLevel) {
      // Wrong on the last available level - game over
      play.finishedAt = new Date();
      await play.save();

      const user = await User.findByIdAndUpdate(
        req.userId,
        { $inc: { songsPlayed: 1 } },
        { new: true }
      );

      return res.json({
        correct: false,
        pointsAwarded: 0,
        totalPoints: user?.totalPoints ?? 0,
        reveal: {
          name: song.name,
          artists: song.artists,
          youtube_link: song.youtube_link
        }
      });
    }
    
    // Wrong on drums or instruments - continue to next level
    // Don't finish the game, frontend will handle level progression
    await play.save();
    
    res.json({
      correct: false
    });
  } catch (error) {
    console.error('Error processing guess:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/plays/:playId/skip
 * Skip to next level without guessing
 */
router.post('/:playId/skip', async (req: AuthedRequest, res: Response) => {
  try {
    const { playId } = req.params;

    const play = await Play.findById(playId);
    if (!play) {
      return res.status(404).json({ error: 'Play not found' });
    }

    // Ensure the play belongs to the authenticated user
    if (play.userId && play.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'This play does not belong to you' });
    }

    if (play.finishedAt) {
      return res.status(400).json({ error: 'This play is already finished' });
    }
    
    // Find the next available level beyond the current one
    const nextLevel = play.availableLevels
      .filter((lvl) => lvl > play.currentLevel)
      .sort((a, b) => a - b)[0];

    if (nextLevel === undefined) {
      return res.status(400).json({ error: 'Already on the last level' });
    }

    play.currentLevel = nextLevel;
    
    // Record skip as an attempt with placeholder text
    play.attempts.push({
      attemptNumber: play.attempts.length + 1,
      guessText: '[SKIPPED]',
      timestamp: new Date(),
      correct: false
    });
    
    await play.save();
    
    res.json({
      currentLevel: play.currentLevel
    });
  } catch (error) {
    console.error('Error skipping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

