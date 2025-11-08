# 🚀 Quick Start Guide - Your Setup

## Your File Locations

✅ **CSV File:** `C:\Users\dell\Desktop\Guess_the_song\app\backend\spotify_playlist_tracks.csv`
✅ **Separated Stems:** `C:\Users\dell\Desktop\Guess_the_song\app\backend\separated\`
✅ **Preprocessed Output:** `C:\Users\dell\Desktop\Guess_the_song\app\backend\preprocessed\` (will be created)

## Setup Steps (Windows)

### 1. Install Prerequisites

Download and install:
- **Node.js 20 LTS** from [nodejs.org](https://nodejs.org)
- **MongoDB Community Server** from [mongodb.com](https://www.mongodb.com/try/download/community)
- **FFmpeg** from [ffmpeg.org](https://ffmpeg.org/download.html) - Add to PATH!

Verify installation:
```powershell
node --version    # Should show v20.x.x
npm --version     # Should show 10.x.x
ffmpeg -version   # Should show FFmpeg version
mongod --version  # Should show MongoDB version
```

### 2. Install Project Dependencies

```powershell
cd C:\Users\dell\Desktop\Guess_the_song\app

# Backend
cd backend
npm install

# Frontend
cd ..\frontend
npm install

# Scripts
cd ..\scripts
npm install
```

### 3. Environment Files (Already Created!)

✅ Backend `.env` is ready at: `app/backend/.env`
✅ Frontend `.env.local` is ready at: `app/frontend/.env.local`

### 4. Place Your Stems

Put your separated audio files in:
```
C:\Users\dell\Desktop\Guess_the_song\app\backend\separated\
```

Structure:
```
separated/
  Africa/
    drums.mp3
    guitar.mp3
    bass.mp3
    piano.mp3
    vocals.mp3
  7 rings/
    drums.mp3
    guitar.mp3
    bass.mp3
    piano.mp3
    vocals.mp3
  ...
```

**Note:** Folder names must match the `Song_Name` column in your CSV exactly!

### 5. Preprocess Audio

This creates the 3 game levels from your stems:

```powershell
cd C:\Users\dell\Desktop\Guess_the_song\app\scripts
npm run preprocess
```

**What it does:**
- Reads: `backend/spotify_playlist_tracks.csv`
- Processes: `backend/separated/<Song_Name>/` (5 stems per song)
- Creates: `backend/preprocessed/<Song_Name>/` (3 levels per song)
- Skips songs without stems automatically

**Time:** ~5-10 seconds per song
- 10 songs: ~1-2 minutes
- 100 songs: ~10-15 minutes
- 311 songs: ~30-50 minutes

### 6. Start MongoDB

```powershell
# MongoDB should start automatically as a Windows Service
# If not, start it manually:
net start MongoDB
```

### 7. Seed Database

```powershell
cd C:\Users\dell\Desktop\Guess_the_song\app\backend
npm run seed
```

This loads all preprocessed songs into MongoDB.

### 8. Start Development Servers

**Terminal 1** - Backend:
```powershell
cd C:\Users\dell\Desktop\Guess_the_song\app\backend
npm run dev
```

You should see:
```
✅ Connected to MongoDB
🚀 Server running on http://localhost:4000
📁 Serving audio from: C:/Users/dell/Desktop/Guess_the_song/app/backend/preprocessed
```

**Terminal 2** - Frontend:
```powershell
cd C:\Users\dell\Desktop\Guess_the_song\app\frontend
npm run dev
```

You should see:
```
✓ Ready in 2.5s
○ Local: http://localhost:3000
```

### 9. Play! 🎉

Open your browser to: **http://localhost:3000**

---

## Common Issues & Solutions

### ❌ "FFmpeg not found"
**Solution:** 
1. Download FFmpeg from ffmpeg.org
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to System PATH
4. Restart PowerShell
5. Test: `ffmpeg -version`

### ❌ "MongoDB connection failed"
**Solution:**
1. Check if MongoDB is running: `net start MongoDB`
2. Or start MongoDB service in Windows Services
3. Verify: `mongosh` (should connect)

### ❌ "Cannot find module"
**Solution:** Reinstall dependencies:
```powershell
cd C:\Users\dell\Desktop\Guess_the_song\app\backend
npm install

cd ..\frontend
npm install

cd ..\scripts
npm install
```

### ❌ "Separated folder not found"
**Solution:**
1. Create folder: `C:\Users\dell\Desktop\Guess_the_song\app\backend\separated`
2. Add your stem folders there
3. Each song should have its own folder with 5 MP3 files

### ❌ "Port 4000 already in use"
**Solution:**
```powershell
# Find process using port 4000
netstat -ano | findstr :4000
# Kill process (replace PID with actual number)
taskkill /PID <PID> /F
```

### ❌ Audio won't play in browser
**Solution:**
1. Click anywhere on the page first (browser autoplay restriction)
2. Check browser console for errors (F12)
3. Verify files exist in `backend/preprocessed/`

---

## Testing Your Setup

### Test Preprocessing (1 song)

Create a test song in `backend/separated/Test_Song/`:
- drums.mp3
- guitar.mp3
- bass.mp3
- piano.mp3
- vocals.mp3

Run preprocessing:
```powershell
cd app\scripts
npm run preprocess
```

Check if created: `backend/preprocessed/Test_Song/level1.mp3, level2.mp3, level3.mp3`

### Test Backend API

With backend running:
```powershell
# In browser, visit:
http://localhost:4000/health

# Should show: {"status":"ok","timestamp":"..."}
```

### Test Full Flow

1. Start both servers
2. Go to http://localhost:3000
3. Click "Random Song"
4. Click "Play" 
5. Hear drums
6. Type a guess
7. See autocomplete suggestions

---

## What Gets Created

After preprocessing, you'll have:

```
app/backend/
├── preprocessed/          # Generated by preprocess script
│   ├── Africa/
│   │   ├── level1.mp3     # Drums only (~1-2 MB)
│   │   ├── level2.mp3     # Drums + instruments (~1-2 MB)
│   │   └── level3.mp3     # Full song (~1-2 MB)
│   ├── 7 rings/
│   │   ├── level1.mp3
│   │   ├── level2.mp3
│   │   └── level3.mp3
│   └── ...
└── node_modules/          # Dependencies

app/scripts/
└── preprocessed_songs.json  # Metadata for seeding

app/frontend/
└── .next/                 # Next.js build files
```

---

## Next Steps

Once everything is working:

1. **Add more songs**: Place stems in `separated/`, run preprocess, run seed
2. **Customize matching**: Edit `MATCH_THRESHOLD` in `backend/.env` (0.5 = lenient, 0.9 = strict)
3. **Check stats**: Play a few games, then visit http://localhost:3000/stats
4. **Run tests**: 
   ```powershell
   cd app\backend && npm test
   cd app\frontend && npm test
   ```

---

## Useful Commands

```powershell
# Stop servers: Ctrl+C in each terminal

# View MongoDB data:
mongosh
use guess-the-song
db.songs.countDocuments()
db.plays.find().limit(5)

# Clear database and re-seed:
cd app\backend
npm run seed

# Rebuild preprocessed audio:
cd app\scripts
npm run preprocess

# Check logs:
# Backend logs in terminal
# Frontend logs in browser console (F12)
```

---

## File Locations Summary

| Item | Path |
|------|------|
| CSV | `app/backend/spotify_playlist_tracks.csv` |
| Stems (input) | `app/backend/separated/` |
| Preprocessed (output) | `app/backend/preprocessed/` |
| Backend | `app/backend/` |
| Frontend | `app/frontend/` |
| Scripts | `app/scripts/` |

---

**Ready to start!** 🎵

If you have stems ready, just run steps 5-8 above!

