import { Router, Request, Response } from 'express';
import Play from '../models/Play';
import User from '../models/User';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

/**
 * Compute play statistics for an optional filter (e.g. a single user).
 */
async function computeStats(filter: Record<string, any> = {}) {
  const totalPlays = await Play.countDocuments(filter);
  const correctPlays = await Play.countDocuments({ ...filter, wasCorrect: true });

  const level1 = await Play.countDocuments({ ...filter, wasCorrect: true, guessedLevel: 1 });
  const level2 = await Play.countDocuments({ ...filter, wasCorrect: true, guessedLevel: 2 });
  const level3 = await Play.countDocuments({ ...filter, wasCorrect: true, guessedLevel: 3 });
  const failed = await Play.countDocuments({ ...filter, wasCorrect: false, finishedAt: { $exists: true } });

  const successfulPlays = await Play.find({ ...filter, wasCorrect: true }).select('guessedLevel');
  const averageLevel = successfulPlays.length > 0
    ? successfulPlays.reduce((sum, play) => sum + (play.guessedLevel || 0), 0) / successfulPlays.length
    : 0;

  return {
    totalPlays,
    correctPlays,
    averageLevel: parseFloat(averageLevel.toFixed(2)),
    distribution: { level1, level2, level3, failed }
  };
}

/**
 * GET /api/stats
 * Get global statistics
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await computeStats());
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stats/me
 * Get statistics for the authenticated user only
 */
router.get('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const base = await computeStats({ userId: req.userId });
    const user = await User.findById(req.userId).select('totalPoints songsPlayed successfulGuesses');

    const totalPoints = user?.totalPoints || 0;
    const songsPlayed = user?.songsPlayed || 0;
    const successfulGuesses = user?.successfulGuesses || 0;

    res.json({
      ...base,
      totalPoints,
      songsPlayed,
      successfulGuesses,
      averagePointsPerSong: songsPlayed > 0 ? parseFloat((totalPoints / songsPlayed).toFixed(2)) : 0,
      guessRate: songsPlayed > 0 ? parseFloat(((successfulGuesses / songsPlayed) * 100).toFixed(1)) : 0
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

