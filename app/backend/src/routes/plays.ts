import { Router, Request, Response } from 'express';
import Song from '../models/Song';
import Play from '../models/Play';
import { fuzzyMatch } from '../utils/fuzzyMatch';
import { formatViewCount } from '../utils/viewCountFormatter';

const router = Router();

/**
 * POST /api/plays/start
 * Start a new play session
 */
router.post('/start', async (req: Request, res: Response) => {
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
    
    const randomIndex = Math.floor(Math.random() * count);
    const song = await Song.findOne(query).skip(randomIndex);
    
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    // Create play record
    const play = new Play({
      songId: song._id,
      mode,
      modeValue,
      startedAt: new Date(),
      wasCorrect: false,
      attempts: []
    });
    
    await play.save();
    
    // Return play data (without revealing song name/artists)
    res.json({
      playId: play._id,
      song: {
        id: song._id,
        release_year: song.release_year,
        viewcount_formatted: formatViewCount(song.viewcount),
        audio_urls: {
          level1: song.preprocessed.level1,
          level2: song.preprocessed.level2,
          level3: song.preprocessed.level3
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
router.post('/:playId/guess', async (req: Request, res: Response) => {
  try {
    const { playId } = req.params;
    const { guess } = req.body;
    
    if (!guess || typeof guess !== 'string') {
      return res.status(400).json({ error: 'Guess is required and must be a string' });
    }
    
    // Find play
    const play = await Play.findById(playId).populate<{ songId: any }>('songId');
    if (!play) {
      return res.status(404).json({ error: 'Play not found' });
    }
    
    // Check if already finished
    if (play.finishedAt) {
      return res.status(400).json({ error: 'This play is already finished' });
    }
    
    // Check if max attempts reached
    if (play.attempts.length >= 3) {
      return res.status(400).json({ error: 'Maximum attempts reached' });
    }
    
    const song = play.songId;
    const currentAttempt = play.attempts.length + 1;
    
    // Perform fuzzy match
    const threshold = parseFloat(process.env.MATCH_THRESHOLD || '0.72');
    const isCorrect = fuzzyMatch(guess, song.name, song.artists, threshold);
    
    // Record attempt
    play.attempts.push({
      attemptNumber: currentAttempt,
      guessText: guess,
      timestamp: new Date(),
      correct: isCorrect
    });
    
    if (isCorrect) {
      play.wasCorrect = true;
      play.guessedLevel = currentAttempt;
      play.finishedAt = new Date();
      await play.save();
      
      return res.json({
        correct: true,
        reveal: {
          name: song.name,
          artists: song.artists,
          youtube_link: song.youtube_link
        }
      });
    }
    
    await play.save();
    
    const remainingAttempts = 3 - play.attempts.length;
    
    // Always finish play and reveal when no attempts left
    // Also finish if only 1 attempt left (this handles the case where frontend
    // reaches vocals with 1 attempt remaining, ensuring reveal is always returned)
    if (remainingAttempts === 0) {
      play.finishedAt = new Date();
      await play.save();
      
      return res.json({
        correct: false,
        remainingAttempts: 0,
        reveal: {
          name: song.name,
          artists: song.artists,
          youtube_link: song.youtube_link
        }
      });
    }
    
    // If only 1 attempt left, also return reveal (frontend will end game on vocals anyway)
    // This ensures reveal is always available when game ends
    if (remainingAttempts === 1) {
      play.finishedAt = new Date();
      await play.save();
      
      return res.json({
        correct: false,
        remainingAttempts: 1,
        reveal: {
          name: song.name,
          artists: song.artists,
          youtube_link: song.youtube_link
        }
      });
    }
    
    res.json({
      correct: false,
      remainingAttempts
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
router.post('/:playId/skip', async (req: Request, res: Response) => {
  try {
    const { playId } = req.params;
    
    const play = await Play.findById(playId);
    if (!play) {
      return res.status(404).json({ error: 'Play not found' });
    }
    
    if (play.finishedAt) {
      return res.status(400).json({ error: 'This play is already finished' });
    }
    
    if (play.attempts.length >= 3) {
      return res.status(400).json({ error: 'Maximum attempts reached' });
    }
    
    const newAttemptNumber = play.attempts.length + 1;
    
    // Record skip as an attempt with placeholder text
    play.attempts.push({
      attemptNumber: newAttemptNumber,
      guessText: '[SKIPPED]',
      timestamp: new Date(),
      correct: false
    });
    
    await play.save();
    
    res.json({
      newAttemptNumber,
      remainingAttempts: 3 - play.attempts.length
    });
  } catch (error) {
    console.error('Error skipping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

