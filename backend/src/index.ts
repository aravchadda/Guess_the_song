import express, { Application, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import playsRouter from './routes/plays';
import statsRouter from './routes/stats';
import songsRouter from './routes/songs';
import audioRouter from './routes/audio';

const app: Application = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());

// Configure CORS with support for multiple origins
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Rate limiting for guess endpoint
const guessLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many guess attempts, please try again later'
});

// Routes
app.use('/api/plays', playsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/songs', songsRouter);
app.use('/api/audio', audioRouter);

// Apply rate limiting to guess endpoint
app.post('/api/plays/:playId/guess', guessLimiter);

// Serve audio files
const audioPath = process.env.AUDIO_PATH || path.join(__dirname, '../preprocessed');
app.use('/preprocessed', express.static(audioPath, {
  maxAge: '1y', // Cache for 1 year
  immutable: true,
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Connect to MongoDB and start server
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guess-the-song';

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📁 Serving audio from: ${audioPath}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;

