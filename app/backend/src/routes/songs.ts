import { Router, Request, Response } from 'express';
import Song from '../models/Song';

const router = Router();

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

export default router;

