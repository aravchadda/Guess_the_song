# 🎵 Guess The Song - Project Summary

## Overview

A complete full-stack music guessing game built with modern web technologies. Players listen to progressive audio reveals (drums → drums+instruments → full song) and try to guess the song title and artist.

## ✅ What's Been Built

### 🎯 Core Features Implemented

1. **Progressive Audio System**
   - 3 difficulty levels (drums only → +instruments → +vocals)
   - Web Audio API for seamless preloading and playback
   - FFmpeg preprocessing pipeline to generate level audio files

2. **Game Modes**
   - Random: Play any song from the database
   - Decade: Filter songs by release decade (1950s-2020s)
   - Extensible for future modes (genre, artist, etc.)

3. **Smart Guessing**
   - Fuzzy matching algorithm handles typos and variations
   - Autocomplete suggestions while typing
   - 3 attempts per song

4. **Statistics & Analytics**
   - Global performance tracking
   - Average guessed level calculation
   - Distribution visualization (Recharts)
   - Success rate metrics

5. **Modern UI/UX**
   - Responsive design with Tailwind CSS
   - Beautiful gradients and animations
   - Dark mode support
   - Mobile-friendly controls

## 🏗️ Architecture

### Backend (Node.js + Express + TypeScript + MongoDB)

**Models:**
- `Song`: Stores song metadata and preprocessed audio paths
- `Play`: Tracks game sessions, attempts, and results

**API Endpoints:**
- `POST /api/plays/start` - Start new game
- `POST /api/plays/:id/guess` - Submit guess
- `POST /api/plays/:id/skip` - Skip to next level
- `GET /api/stats` - Get statistics
- `GET /api/songs/search` - Autocomplete search

**Features:**
- Fuzzy matching with string-similarity
- Rate limiting on guess endpoint
- Static audio file serving
- CORS configured for frontend

### Frontend (Next.js 14 + TypeScript + Tailwind CSS)

**Pages:**
- `/` - Home with mode selection
- `/game` - Main game interface
- `/stats` - Statistics dashboard

**Key Components:**
- `AudioManager` - Web Audio API wrapper for preloading/playback
- API client with TypeScript interfaces
- Autocomplete search component

### Preprocessing (FFmpeg + TypeScript)

**Script:** `app/scripts/preprocess.ts`

**What it does:**
1. Reads CSV with song metadata
2. For each song, processes stems:
   - Level 1: Copy drums.mp3 → level1.mp3
   - Level 2: Mix drums+guitar+bass+piano → level2.mp3
   - Level 3: Mix all 5 stems → level3.mp3
3. Generates JSON metadata for seeding

**Audio Quality:**
- MP3 format with VBR quality 4
- `amix` filter for clean mixing
- Maintains first stream duration

## 📊 Database Schema

### Songs Collection
```typescript
{
  _id: ObjectId
  name: string                    // Song title
  artists: string                 // Artist(s)
  youtube_link: string            // YouTube URL
  viewcount: number               // YouTube views
  release_year: number            // e.g., 1982
  decade: number                  // e.g., 1980
  preprocessed: {
    level1: string                // Path to level1.mp3
    level2: string                // Path to level2.mp3
    level3: string                // Path to level3.mp3
  }
  createdAt: Date
  updatedAt: Date
}
```

### Plays Collection
```typescript
{
  _id: ObjectId
  songId: ObjectId (ref Song)
  mode: 'random' | 'decade'
  modeValue: string               // e.g., "1990" for decade mode
  startedAt: Date
  finishedAt: Date
  guessedLevel: number            // 1, 2, or 3
  wasCorrect: boolean
  attempts: [{
    attemptNumber: number
    guessText: string
    timestamp: Date
    correct: boolean
  }]
  createdAt: Date
  updatedAt: Date
}
```

## 🧪 Testing

### Backend Unit Tests (Jest)
- `fuzzyMatch.test.ts` - 20+ test cases for matching algorithm
- `viewCountFormatter.test.ts` - View count formatting

**Run:** `cd app/backend && npm test`

### Frontend E2E Tests (Playwright)
- Navigation flows
- Game mode selection
- UI rendering

**Run:** `cd app/frontend && npm test`

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Port 80/443)                  │
│  - Reverse proxy                                        │
│  - Static audio file serving                           │
│  - HTTPS termination (Let's Encrypt)                   │
└───────────┬──────────────────────────┬──────────────────┘
            │                          │
            ▼                          ▼
    ┌───────────────┐          ┌──────────────┐
    │  Backend API  │          │   Frontend   │
    │  (Express)    │◄─────────│  (Next.js)   │
    │  Port 4000    │          │  Port 3000   │
    └───────┬───────┘          └──────────────┘
            │
            ▼
    ┌───────────────┐
    │   MongoDB     │
    │  Port 27017   │
    └───────────────┘
```

## 📁 File Structure

```
guess-song/
├── app/                            # This project
│   ├── backend/                    # Express API
│   │   ├── src/
│   │   │   ├── models/            # Mongoose models
│   │   │   ├── routes/            # API endpoints
│   │   │   ├── utils/             # Helper functions
│   │   │   ├── scripts/           # Seed script
│   │   │   ├── __tests__/         # Unit tests
│   │   │   └── index.ts           # Entry point
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   ├── frontend/                   # Next.js app
│   │   ├── src/
│   │   │   ├── app/               # Pages (App Router)
│   │   │   └── lib/               # Utils (audioManager, api)
│   │   ├── tests/                 # Playwright tests
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   │
│   ├── scripts/                    # Preprocessing
│   │   ├── preprocess.ts          # FFmpeg pipeline
│   │   ├── setup.sh               # System setup
│   │   ├── start-dev.sh           # Dev server launcher
│   │   └── deploy-prod.sh         # Production deploy
│   │
│   ├── README.md                   # Full documentation
│   ├── SETUP.md                    # Quick setup guide
│   └── PROJECT_SUMMARY.md          # This file
│
├── getting_the_data/               # Your existing data
│   └── spotify_playlist_tracks.csv
│
├── separated/                      # Input stems (to be provided)
│   └── <Song_Name>/
│       ├── drums.mp3
│       ├── guitar.mp3
│       ├── bass.mp3
│       ├── piano.mp3
│       └── vocals.mp3
│
└── preprocessed/                   # Generated audio (after preprocessing)
    └── <Song_Name>/
        ├── level1.mp3
        ├── level2.mp3
        └── level3.mp3
```

## 🔧 Configuration Files

### Backend `.env`
```env
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/guess-the-song
AUDIO_PATH=/absolute/path/to/preprocessed
MATCH_THRESHOLD=0.72
CORS_ORIGIN=http://localhost:3000
```

### Frontend `.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## 🎮 How It Works (User Flow)

1. **User lands on home page** → Chooses mode (Random or Decade)
2. **Backend:** Selects random song matching criteria
3. **Frontend:** Preloads all 3 level MP3s using Web Audio API
4. **User plays Level 1** (drums only)
5. **User types guess** → Autocomplete shows suggestions
6. **User submits guess** → Backend fuzzy matches
   - ✅ **Correct:** Reveal song details + YouTube link
   - ❌ **Incorrect:** Show remaining attempts
7. **User can skip** to next level (counts as attempt)
8. **After 3 attempts or correct guess:** Show next button
9. **Statistics** are updated in real-time

## 🧠 Technical Highlights

### Fuzzy Matching Algorithm
```typescript
// Handles:
- Case insensitivity
- Punctuation removal
- Typos (Levenshtein distance)
- Token overlap
- Artist name inclusion
- Substring matching
- Configurable threshold (default 0.72)

// Examples that match:
"africa toto" → "Africa" by TOTO ✅
"Bohemian Rapsody" → "Bohemian Rhapsody" ✅
"satisfaction rolling stones" → "(I Can't Get No) Satisfaction" ✅
```

### Web Audio API Preloading
```typescript
// Optimizations:
1. Fetch all 3 levels as ArrayBuffer
2. Decode with audioContext.decodeAudioData()
3. Store AudioBuffers in memory
4. Instant playback with createBufferSource()
5. No lag between levels
```

### View Count Formatting
```typescript
1,500,000,000 → "1.5B"
1,200,000     → "1M"
5,000         → "5K"
```

## 📈 Performance Considerations

1. **Audio Preloading:** All levels fetched and decoded before game starts
2. **Static Serving:** Audio files served with `max-age=1y` cache headers
3. **MongoDB Indexing:** Indexed on decade, release_year, viewcount
4. **Rate Limiting:** 30 guesses per minute per IP
5. **Autocomplete Debouncing:** 300ms delay on search

## 🔐 Security Features

- Helmet.js for security headers
- CORS configured
- Rate limiting on sensitive endpoints
- Input sanitization
- No song data leaked before correct guess

## 🎨 UI/UX Features

- **Responsive:** Works on mobile, tablet, desktop
- **Dark Mode:** Automatic based on system preference
- **Animations:** Smooth transitions and hover effects
- **Accessibility:** Semantic HTML, ARIA labels
- **Loading States:** Spinners and progress indicators
- **Error Handling:** User-friendly error messages

## 📦 Scripts & Commands

### Setup
```bash
./app/scripts/setup.sh              # Install all dependencies
```

### Development
```bash
cd app/backend && npm run dev       # Start backend
cd app/frontend && npm run dev      # Start frontend
./app/scripts/start-dev.sh          # Start both
```

### Preprocessing
```bash
cd app/scripts && npm run preprocess  # Process stems
cd app/backend && npm run seed        # Seed database
```

### Production
```bash
cd app/backend && npm run build && npm start
cd app/frontend && npm run build && npm start
./app/scripts/deploy-prod.sh        # Deploy with PM2
```

### Testing
```bash
cd app/backend && npm test          # Jest unit tests
cd app/frontend && npm test         # Playwright E2E
```

## 🚀 Next Steps (Optional Enhancements)

1. **User Accounts**
   - Persistent stats per user
   - Leaderboards
   - Achievement system

2. **Additional Modes**
   - Genre filtering
   - Artist-specific challenges
   - Multiplayer mode

3. **Audio Enhancements**
   - Volume normalization
   - Fade in/out
   - Adjustable playback speed

4. **Social Features**
   - Share results
   - Challenge friends
   - Social media integration

5. **Admin Panel**
   - Add/edit songs
   - View analytics
   - Manage database

## 📝 Notes

- **Dataset:** Currently uses 318 songs from Spotify playlist
- **Audio Format:** MP3 (VBR quality 4, ~128-192 kbps)
- **Browser Support:** Modern browsers with Web Audio API
- **Mobile:** Requires user gesture for audio playback (browser restriction)

## 🙏 Credits

- **Frontend:** Next.js, React, Tailwind CSS
- **Backend:** Node.js, Express, MongoDB
- **Audio Processing:** FFmpeg
- **Testing:** Jest, Playwright
- **Charts:** Recharts
- **Matching:** string-similarity (Levenshtein distance)

---

**Status:** ✅ Complete and ready for deployment

**Last Updated:** November 2024

**Version:** 1.0.0

