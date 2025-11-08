# 🚀 Getting Started with Guess The Song

## Quick Overview

You now have a complete full-stack music guessing game! Here's what to do next:

## 📋 Before You Begin

Make sure you have:
- ✅ Your project in `C:\Users\dell\Desktop\Guess_the_song\app\`
- ✅ CSV file at `getting_the_data/spotify_playlist_tracks.csv`
- ⏳ Separated stems (to be provided) - should go in `separated/` folder

## 🎯 Development Setup (Local Windows)

### 1. Install Prerequisites

You'll need these installed on your Windows machine:
- **Node.js 18+** (download from nodejs.org)
- **MongoDB** (download MongoDB Community Server)
- **FFmpeg** (download from ffmpeg.org and add to PATH)

### 2. Install Project Dependencies

Open PowerShell and run:

```powershell
# Backend
cd C:\Users\dell\Desktop\Guess_the_song\app\backend
npm install

# Frontend
cd C:\Users\dell\Desktop\Guess_the_song\app\frontend
npm install

# Scripts
cd C:\Users\dell\Desktop\Guess_the_song\app\scripts
npm install
```

### 3. Configure Environment

**Backend** - Create `app/backend/.env`:
```env
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/guess-the-song
AUDIO_PATH=C:/Users/dell/Desktop/Guess_the_song/app/backend/preprocessed
MATCH_THRESHOLD=0.72
CORS_ORIGIN=http://localhost:3000
```

**Frontend** - Create `app/frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 4. Prepare Stems

Place your separated stems in `C:\Users\dell\Desktop\Guess_the_song\app\backend\separated\`:

```
app/backend/separated/
  Africa/
    drums.mp3
    guitar.mp3
    bass.mp3
    piano.mp3
    vocals.mp3
  (I Can't Get No) Satisfaction - Mono/
    drums.mp3
    ...
```

**Important:** 
- Folder names must exactly match the `Song_Name` column in your CSV
- Songs without stems will be automatically skipped during preprocessing

### 5. Preprocess Audio

```powershell
cd C:\Users\dell\Desktop\Guess_the_song\app\scripts
npm run preprocess
```

This will create `preprocessed/` folder with 3 level MP3s for each song.

⏱️ **Time:** ~5-10 seconds per song (for 318 songs: ~30-50 minutes)

### 6. Seed Database

Make sure MongoDB is running, then:

```powershell
cd C:\Users\dell\Desktop\Guess_the_song\app\backend
npm run seed
```

### 7. Start Development Servers

**Terminal 1** - Backend:
```powershell
cd C:\Users\dell\Desktop\Guess_the_song\app\backend
npm run dev
```

**Terminal 2** - Frontend:
```powershell
cd C:\Users\dell\Desktop\Guess_the_song\app\frontend
npm run dev
```

### 8. Play!

Open your browser to: **http://localhost:3000** 🎉

## 🐧 Deployment on Ubuntu 24.04 VM

When you're ready to deploy to your Hostinger VM:

### 1. Transfer Files

```bash
# On your local machine, compress the app folder
# Then SCP to your VM

# On VM:
mkdir -p ~/guess-song
cd ~/guess-song
# Extract files
```

### 2. Run Setup Script

```bash
cd ~/guess-song/app/scripts
chmod +x *.sh
./setup.sh
```

This installs Node.js, MongoDB, FFmpeg, and PM2.

### 3. Install Dependencies

```bash
cd ~/guess-song/app/backend && npm install
cd ~/guess-song/app/frontend && npm install
cd ~/guess-song/app/scripts && npm install
```

### 4. Configure Environment

Edit `~/guess-song/app/backend/.env`:
```bash
PORT=4000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/guess-the-song
AUDIO_PATH=/home/yourusername/guess-song/preprocessed
MATCH_THRESHOLD=0.72
CORS_ORIGIN=http://your-domain.com
```

### 5. Transfer and Preprocess Audio

```bash
# Transfer separated stems to VM
# Then preprocess
cd ~/guess-song/app/scripts
npm run preprocess
```

### 6. Seed Database

```bash
cd ~/guess-song/app/backend
npm run seed
```

### 7. Deploy with PM2

```bash
cd ~/guess-song/app/scripts
./deploy-prod.sh
```

### 8. Configure Nginx (Optional)

See `README.md` for full Nginx configuration and Let's Encrypt setup.

## 🧪 Testing

### Backend Tests
```bash
cd app/backend
npm test
```

### Frontend Tests
```bash
cd app/frontend
npm run test
```

## 📚 Documentation Files

- **README.md** - Complete documentation
- **SETUP.md** - Quick setup checklist
- **PROJECT_SUMMARY.md** - Technical overview
- **GETTING_STARTED.md** - This file

## 🆘 Troubleshooting

### MongoDB Won't Start (Windows)
- Install MongoDB Community Server from mongodb.com
- Add to Windows Services
- Start "MongoDB Server" service

### FFmpeg Not Found
- Download from ffmpeg.org
- Extract and add to PATH
- Restart terminal

### Port Already in Use
```powershell
# Windows - Kill process on port
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

### Audio Won't Play
- Click on page first (browser autoplay policy)
- Check browser console for errors
- Verify `AUDIO_PATH` in `.env`

## 🎮 How to Play

1. **Choose Mode:** Random or Decade
2. **Listen:** Start with Level 1 (drums only)
3. **Guess:** Type song name/artist
4. **Skip:** Move to next level if stuck
5. **Win:** Guess correctly in 3 attempts or less!

## 📊 Game Modes

- **Random:** Any song from the database
- **Decade:** Filter by 1950s, 1960s, ..., 2020s

## 🎯 Scoring

- **Level 1 guess:** You're a music genius! 🏆
- **Level 2 guess:** Great job! 🎵
- **Level 3 guess:** You got it! ✅
- **No guess:** Better luck next time! 😅

## 🔥 Pro Tips

1. **Listen carefully** to drum patterns - they're unique!
2. **Use autocomplete** - it helps narrow down options
3. **Think about the decade** and view count as hints
4. **Artist names** count in guesses (e.g., "Africa Toto")

## 📈 What's Next?

After setup, you can:
- Add more songs to the database
- Customize the matching threshold
- Add new game modes
- Implement user accounts
- Create leaderboards

## 🎨 Customization

### Change Match Threshold
In `backend/.env`, adjust `MATCH_THRESHOLD` (0.0 - 1.0):
- Lower = more lenient matching
- Higher = stricter matching
- Default: 0.72

### Update Songs
1. Edit CSV
2. Add stems to `separated/`
3. Run `npm run preprocess` in scripts
4. Run `npm run seed` in backend

## 🌟 Features at a Glance

✅ Progressive audio reveals (3 levels)
✅ Fuzzy matching (handles typos)
✅ Autocomplete search
✅ Statistics dashboard
✅ Decade filtering
✅ Mobile-friendly
✅ Dark mode support
✅ YouTube integration
✅ Real-time stats

## 💡 Need Help?

Check these files:
1. **README.md** - Full documentation
2. **SETUP.md** - Setup checklist
3. **PROJECT_SUMMARY.md** - Architecture details

---

**Ready to play? Let's go! 🎵🎉**

