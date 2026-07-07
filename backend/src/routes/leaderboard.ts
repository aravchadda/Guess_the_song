import { Router, Response } from 'express';
import User from '../models/User';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  picture?: string;
  totalPoints: number;
}

/**
 * GET /api/leaderboard
 * Top 10 users by total points. If the caller is signed in and not in the
 * top 10, their own entry (with real rank) is returned separately as `me`.
 */
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const topUsers = await User.find()
      .sort({ totalPoints: -1 })
      .limit(10)
      .select('name picture totalPoints');

    const top: LeaderboardEntry[] = topUsers.map((u, i) => ({
      rank: i + 1,
      id: String(u._id),
      name: u.name,
      picture: u.picture,
      totalPoints: u.totalPoints || 0
    }));

    let me: LeaderboardEntry | null = null;

    if (req.userId) {
      const inTop = top.find((entry) => entry.id === req.userId);
      if (inTop) {
        me = inTop;
      } else {
        const currentUser = await User.findById(req.userId).select('name picture totalPoints');
        if (currentUser) {
          const higherCount = await User.countDocuments({
            totalPoints: { $gt: currentUser.totalPoints || 0 }
          });
          me = {
            rank: higherCount + 1,
            id: String(currentUser._id),
            name: currentUser.name,
            picture: currentUser.picture,
            totalPoints: currentUser.totalPoints || 0
          };
        }
      }
    }

    res.json({ top, me });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
