import { Router, Request, Response } from 'express';
import Play from '../models/Play';

const router = Router();

/**
 * GET /api/stats
 * Get global statistics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Count all plays
    const totalPlays = await Play.countDocuments();
    
    // Count correct plays
    const correctPlays = await Play.countDocuments({ wasCorrect: true });
    
    // Get distribution by guessed level
    const level1 = await Play.countDocuments({ wasCorrect: true, guessedLevel: 1 });
    const level2 = await Play.countDocuments({ wasCorrect: true, guessedLevel: 2 });
    const level3 = await Play.countDocuments({ wasCorrect: true, guessedLevel: 3 });
    const failed = await Play.countDocuments({ wasCorrect: false, finishedAt: { $exists: true } });
    
    // Calculate average guessed level (only for successful plays)
    const successfulPlays = await Play.find({ wasCorrect: true }).select('guessedLevel');
    const averageLevel = successfulPlays.length > 0
      ? successfulPlays.reduce((sum, play) => sum + (play.guessedLevel || 0), 0) / successfulPlays.length
      : 0;
    
    res.json({
      totalPlays,
      correctPlays,
      averageLevel: parseFloat(averageLevel.toFixed(2)),
      distribution: {
        level1,
        level2,
        level3,
        failed
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

