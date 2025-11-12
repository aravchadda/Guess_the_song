import { Router, Request, Response } from 'express';
import Song from '../models/Song';
import path from 'path';
import fs from 'fs';

const router = Router();

/**
 * GET /api/audio/:songId/:level
 * Serve audio files by song ID and level without exposing song name
 */
router.get('/:songId/:level', async (req: Request, res: Response) => {
  try {
    const { songId, level } = req.params;
    
    // Validate level
    if (!['level1', 'level2', 'level3'].includes(level)) {
      return res.status(400).json({ error: 'Invalid level. Must be level1, level2, or level3' });
    }
    
    // Find song by ID
    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    // Get the file path from the preprocessed field
    const filePath = song.preprocessed[level as 'level1' | 'level2' | 'level3'];
    if (!filePath) {
      return res.status(404).json({ error: 'Audio file not found for this level' });
    }
    
    // Convert the URL path to actual file system path
    // Remove leading /preprocessed/ and decode any URL encoding
    let relativePath = filePath.replace(/^\/preprocessed\//, '');
    // Decode URL-encoded characters (e.g., %20 -> space, %27 -> apostrophe)
    relativePath = decodeURIComponent(relativePath);
    const audioPath = process.env.AUDIO_PATH || path.join(__dirname, '../../preprocessed');
    const fullPath = path.join(audioPath, relativePath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Audio file not found on disk' });
    }
    
    // Set headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send the file
    res.sendFile(fullPath);
  } catch (error) {
    console.error('Error serving audio file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
