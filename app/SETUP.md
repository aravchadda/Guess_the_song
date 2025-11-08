# Quick Setup Guide

## Prerequisites Checklist

- [ ] Ubuntu 24.04 (or similar)
- [ ] Node.js 18+ installed
- [ ] MongoDB installed and running
- [ ] FFmpeg installed
- [ ] Project cloned to `~/guess-song/`
- [ ] Separated stems ready in `~/guess-song/separated/`

## Quick Start (5 Steps)

### 1. Run Setup Script

```bash
cd ~/guess-song/app/scripts
chmod +x setup.sh
./setup.sh
```

### 2. Install Project Dependencies

```bash
# Backend
cd ~/guess-song/app/backend
pnpm install

# Frontend
cd ~/guess-song/app/frontend
pnpm install

# Scripts
cd ~/guess-song/app/scripts
pnpm install
```

### 3. Configure Environment

```bash
# Backend
cd ~/guess-song/app/backend
cp .env.example .env
nano .env  # Edit with your paths

# Frontend
cd ~/guess-song/app/frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
```

**Backend `.env` example:**
```
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/guess-the-song
AUDIO_PATH=C:/Users/dell/Desktop/Guess_the_song/app/backend/preprocessed
MATCH_THRESHOLD=0.72
CORS_ORIGIN=http://localhost:3000
```

### 4. Preprocess & Seed

```bash
# Preprocess audio (this may take a while)
cd ~/guess-song/app/scripts
npm run preprocess

# Seed database
cd ~/guess-song/app/backend
npm run seed
```

### 5. Start Development Servers

**Option A: Using convenience script**
```bash
cd ~/guess-song/app/scripts
chmod +x start-dev.sh
./start-dev.sh
```

**Option B: Manual (two terminals)**

Terminal 1 - Backend:
```bash
cd ~/guess-song/app/backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd ~/guess-song/app/frontend
npm run dev
```

### 6. Play! 🎉

Open http://localhost:3000 in your browser

## Troubleshooting

### MongoDB Not Starting

```bash
sudo systemctl status mongodb
sudo systemctl start mongodb
sudo journalctl -u mongodb -f
```

### "FFmpeg not found" Error

```bash
sudo apt install ffmpeg
ffmpeg -version
```

### "Cannot find module" Errors

```bash
# Make sure you've installed dependencies in all folders
cd ~/guess-song/app/backend && pnpm install
cd ~/guess-song/app/frontend && pnpm install
cd ~/guess-song/app/scripts && pnpm install
```

### Audio Files Not Found

Check paths:
1. `separated/` folder exists with proper structure
2. `preprocessed/` folder was created by preprocess script
3. `AUDIO_PATH` in backend `.env` points to correct location

### Port Already in Use

```bash
# Kill process on port 4000 (backend)
lsof -i :4000
kill -9 <PID>

# Kill process on port 3000 (frontend)
lsof -i :3000
kill -9 <PID>
```

## Production Deployment

See [README.md](README.md#deployment) for full deployment guide.

Quick production deployment:

```bash
cd ~/guess-song/app/scripts
chmod +x deploy-prod.sh
./deploy-prod.sh
```

This will:
- Build backend and frontend
- Start with PM2
- Setup auto-restart on reboot

## Testing

```bash
# Backend tests
cd ~/guess-song/app/backend
npm test

# Frontend E2E tests (requires servers running)
cd ~/guess-song/app/frontend
npm run test
```

## Next Steps

- [ ] Add more songs to the database
- [ ] Configure Nginx reverse proxy (see README)
- [ ] Setup HTTPS with Let's Encrypt
- [ ] Configure backups for MongoDB
- [ ] Monitor with PM2 logs

---

**Need Help?** Check the full [README.md](README.md) for detailed documentation.

