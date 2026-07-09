import { Router, Request, Response } from 'express';
import User, { IUser } from '../models/User';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

interface StatsTotals {
  drums: number;
  instruments: number;
  vocals: number;
  failed: number;
  songsPlayed: number;
}

/**
 * Build the public Stats shape from a set of raw totals (either one user's
 * counters, or a sum across all users).
 */
function buildStats(totals: StatsTotals) {
  const correctPlays = totals.drums + totals.instruments + totals.vocals;
  const totalPlays = correctPlays + totals.failed;

  const averageLevel =
    correctPlays > 0
      ? (1 * totals.drums + 2 * totals.instruments + 3 * totals.vocals) / correctPlays
      : 0;

  return {
    totalPlays,
    correctPlays,
    averageLevel: parseFloat(averageLevel.toFixed(2)),
    distribution: {
      level1: totals.drums,
      level2: totals.instruments,
      level3: totals.vocals,
      failed: totals.failed
    }
  };
}

/**
 * GET /api/stats
 * Global statistics, summed across every signed-in user's counters.
 *
 * Note: unlike the old Play-collection design, guest (unauthenticated) plays
 * are never persisted anywhere, so they no longer contribute to this total -
 * only signed-in users' outcomes are counted.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const agg = await User.aggregate([
      {
        $group: {
          _id: null,
          drums: { $sum: '$successfulGuesses.drums' },
          instruments: { $sum: '$successfulGuesses.instruments' },
          vocals: { $sum: '$successfulGuesses.vocals' },
          failed: { $sum: '$failedGuesses' },
          songsPlayed: { $sum: '$songsPlayed' }
        }
      }
    ]);

    const totals: StatsTotals = agg[0] || {
      drums: 0,
      instruments: 0,
      vocals: 0,
      failed: 0,
      songsPlayed: 0
    };

    res.json(buildStats(totals));
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stats/me
 * Statistics for the authenticated user only, read directly off their
 * User document (no aggregation needed - it's just that one document).
 */
router.get('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select(
      'totalPoints songsPlayed successfulGuesses failedGuesses'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totals: StatsTotals = {
      drums: user.successfulGuesses?.drums || 0,
      instruments: user.successfulGuesses?.instruments || 0,
      vocals: user.successfulGuesses?.vocals || 0,
      failed: user.failedGuesses || 0,
      songsPlayed: user.songsPlayed || 0
    };

    const base = buildStats(totals);
    const totalPoints = user.totalPoints || 0;
    const songsPlayed = user.songsPlayed || 0;
    const successfulGuesses = base.correctPlays;

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
