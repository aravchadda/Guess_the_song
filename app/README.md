# 🎵 Guess The Song

A full-stack web game where players listen to progressive audio reveals and guess the song. Built with Next.js (TypeScript) frontend and Node.js + Express + MongoDB backend.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)

## ✨ Features

- **Progressive Audio Reveals**: 3 levels of difficulty
  - Level 1: Drums only
  - Level 2: Drums + Instruments (guitar, bass, piano)
  - Level 3: Full song with vocals
- **Game Modes**: Random songs or filter by decade
- **Fuzzy Matching**: Smart algorithm matches guesses with typos and variations
- **Statistics**: Track global performance and distribution
- **Web Audio API**: Preloaded and decoded audio for seamless playback
- **Modern UI**: Beautiful, responsive design with Tailwind CSS

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14 (TypeScript)
- Tailwind CSS
- Web Audio API
- Recharts (for statistics visualization)

**Backend:**
- Node.js + Express (TypeScript)
- MongoDB + Mongoose
- String similarity (fuzzy matching)

**Tools:**
- FFmpeg (audio preprocessing)
- Playwright (E2E testing)
- Jest (unit testing)

## 📦 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ and npm/pnpm
- **MongoDB** installed and running locally
- **FFmpeg** installed (for preprocessing)
- **Git**

### Install Prerequisites (Ubuntu 24.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm (optional but recommended)
npm install -g pnpm

# Install MongoDB
sudo apt install -y mongodb
sudo systemctl enable --now mongodb

# Install FFmpeg
sudo apt install -y ffmpeg

# Verify installations
node --version
npm --version
ffmpeg -version
mongosh --version  # or mongo --version
```

## 🚀 Installation

### 1. Clone the Repository

```bash
cd ~/
git clone <your-repo-url> guess-song
cd guess-song
```

### 2. Set Up Directory Structure

Your directory should look like this:

```
guess-song/
├── app/                    # This repository
│   ├── backend/
│   │   ├── spotify_playlist_tracks.csv  # Your CSV is here
│   │   ├── separated/                   # Place stems here
│   │   │   └── <Song_Name>/
│   │   │       ├── drums.mp3
│   │   │       ├── guitar.mp3
│   │   │       ├── bass.mp3
│   │   │       ├── piano.mp3
│   │   │       └── vocals.mp3
│   │   └── preprocessed/                # Generated audio
│   │       └── <Song_Name>/
│   │           ├── level1.mp3
│   │           ├── level2.mp3
│   │           └── level3.mp3
│   ├── frontend/
│   └── scripts/
└── getting_the_data/       # Your original data folder
```

### 3. Install Dependencies

```bash
# Backend
cd ~/guess-song/app/backend
pnpm install  # or npm install

# Frontend
cd ~/guess-song/app/frontend
pnpm install  # or npm install

# Scripts
cd ~/guess-song/app/scripts
pnpm install  # or npm install
```

### 4. Configure Environment Variables

**Backend** (`app/backend/.env`):

```bash
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/guess-the-song
AUDIO_PATH=/home/yourusername/guess-song/preprocessed
MATCH_THRESHOLD=0.72
CORS_ORIGIN=http://localhost:3000
```

**Frontend** (`app/frontend/.env.local`):

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 5. Prepare Audio Data

Place your separated stems in the `separated/` folder following this structure:

```
separated/
  Africa/
    drums.mp3
    guitar.mp3
    bass.mp3
    piano.mp3
    vocals.mp3
  Bohemian Rhapsody/
    drums.mp3
    ...
```

**Important**: Folder names must match the `Song_Name` column in your CSV exactly.

## 🎬 Usage

### Step 1: Preprocess Audio

Generate level mp3 files from stems:

```bash
cd ~/guess-song/app/scripts
npm run preprocess
```

This will:
- Read `getting_the_data/spotify_playlist_tracks.csv`
- Process each song's stems from `separated/`
- Generate 3 level mp3 files in `preprocessed/`
- Create `preprocessed_songs.json` for seeding

Expected output:
```
🎵 Starting preprocessing pipeline...
📊 Found 318 songs in CSV

[1/318] Processing: Africa
  - Creating level1 (drums only)...
  - Creating level2 (drums+guitar+bass+piano)...
  - Creating level3 (full mix)...
  ✅ Completed: Africa

...

✅ Preprocessing complete!
   Success: 318 songs
   Failed: 0 songs
```

### Step 2: Seed Database

Load songs into MongoDB:

```bash
cd ~/guess-song/app/backend
npm run seed
```

Expected output:
```
🌱 Starting database seed...
📡 Connecting to MongoDB: mongodb://localhost:27017/guess-the-song
✅ Connected to MongoDB

📊 Found 318 songs to seed
📥 Inserting songs...
   Inserted 10/318...
   ...

✅ Database seeding complete!
   Inserted: 318 songs
   Failed: 0 songs
```

### Step 3: Start Backend

```bash
cd ~/guess-song/app/backend
npm run dev
```

Backend will run on `http://localhost:4000`

### Step 4: Start Frontend

In a new terminal:

```bash
cd ~/guess-song/app/frontend
npm run dev
```

Frontend will run on `http://localhost:3000`

### Step 5: Play!

Open your browser and navigate to:
- **Home**: http://localhost:3000
- **Random Game**: http://localhost:3000/game?mode=random
- **Decade Game**: http://localhost:3000/game?mode=decade
- **Stats**: http://localhost:3000/stats

## 📁 Project Structure

```
app/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── models/            # Mongoose models
│   │   │   ├── Song.ts
│   │   │   └── Play.ts
│   │   ├── routes/            # API endpoints
│   │   │   ├── plays.ts       # Start play, guess, skip
│   │   │   ├── stats.ts       # Global statistics
│   │   │   └── songs.ts       # Search/autocomplete
│   │   ├── utils/             # Helper functions
│   │   │   ├── fuzzyMatch.ts  # Fuzzy matching algorithm
│   │   │   └── viewCountFormatter.ts
│   │   ├── scripts/           # Database scripts
│   │   │   └── seed.ts
│   │   ├── __tests__/         # Unit tests
│   │   └── index.ts           # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/                   # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx       # Home page
│   │   │   ├── game/          # Game page
│   │   │   ├── stats/         # Statistics page
│   │   │   └── layout.tsx
│   │   └── lib/
│   │       ├── audioManager.ts # Web Audio API wrapper
│   │       └── api.ts         # API client
│   ├── tests/                 # Playwright E2E tests
│   ├── package.json
│   ├── tailwind.config.ts
│   └── next.config.js
└── scripts/                    # Preprocessing scripts
    ├── preprocess.ts          # FFmpeg pipeline
    ├── package.json
    └── preprocessed_songs.json # Generated metadata
```

## 📚 API Documentation

### Base URL
```
http://localhost:4000/api
```

### Endpoints

#### **POST /api/plays/start**
Start a new game session.

**Request:**
```json
{
  "mode": "random" | "decade",
  "value": "1990" // Required for decade mode
}
```

**Response:**
```json
{
  "playId": "507f1f77bcf86cd799439011",
  "song": {
    "id": "507f191e810c19729de860ea",
    "release_year": 1982,
    "viewcount_formatted": "1190M",
    "audio_urls": {
      "level1": "/audio/preprocessed/Africa/level1.mp3",
      "level2": "/audio/preprocessed/Africa/level2.mp3",
      "level3": "/audio/preprocessed/Africa/level3.mp3"
    }
  }
}
```

#### **POST /api/plays/:playId/guess**
Submit a guess.

**Request:**
```json
{
  "guess": "Africa by Toto"
}
```

**Response (Correct):**
```json
{
  "correct": true,
  "reveal": {
    "name": "Africa",
    "artists": "TOTO",
    "youtube_link": "https://www.youtube.com/watch?v=..."
  }
}
```

**Response (Incorrect):**
```json
{
  "correct": false,
  "remainingAttempts": 2
}
```

#### **POST /api/plays/:playId/skip**
Skip to next level.

**Response:**
```json
{
  "newAttemptNumber": 2,
  "remainingAttempts": 2
}
```

#### **GET /api/stats**
Get global statistics.

**Response:**
```json
{
  "totalPlays": 150,
  "correctPlays": 120,
  "averageLevel": 1.85,
  "distribution": {
    "level1": 45,
    "level2": 50,
    "level3": 25,
    "failed": 30
  }
}
```

#### **GET /api/songs/search?q=query**
Search songs (autocomplete).

**Response:**
```json
[
  {
    "id": "507f191e810c19729de860ea",
    "hint": "Africa - TOTO"
  }
]
```

## 🧪 Testing

### Backend Unit Tests

```bash
cd ~/guess-song/app/backend
npm test
```

Tests include:
- Fuzzy matching algorithm
- View count formatter
- API endpoint logic

### Frontend E2E Tests

```bash
cd ~/guess-song/app/frontend
npm run test
```

Playwright tests verify:
- Home page navigation
- Game mode selection
- Statistics page

## 🚀 Deployment

### Production Build

**Backend:**
```bash
cd ~/guess-song/app/backend
npm run build
npm start
```

**Frontend:**
```bash
cd ~/guess-song/app/frontend
npm run build
npm start
```

### Process Management (PM2)

```bash
# Install PM2
npm install -g pm2

# Start backend
cd ~/guess-song/app/backend
pm2 start dist/index.js --name guess-backend

# Start frontend
cd ~/guess-song/app/frontend
pm2 start npm --name guess-frontend -- start

# Save PM2 config
pm2 save
pm2 startup
```

### Nginx Reverse Proxy

Example Nginx configuration (`/etc/nginx/sites-available/guess-song`):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Audio files
    location /audio/ {
        alias /home/yourusername/guess-song/preprocessed/;
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header Access-Control-Allow-Origin "*";
    }

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/guess-song /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### HTTPS with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 🔧 Troubleshooting

### MongoDB Connection Issues

```bash
# Check if MongoDB is running
sudo systemctl status mongodb

# Start MongoDB
sudo systemctl start mongodb

# View logs
sudo journalctl -u mongodb
```

### FFmpeg Not Found

```bash
# Install FFmpeg
sudo apt install ffmpeg

# Verify
ffmpeg -version
```

### Audio Not Playing

- Ensure browser allows autoplay (click on the page first)
- Check browser console for errors
- Verify audio files exist in `preprocessed/` folder
- Check `AUDIO_PATH` in backend `.env`

### Port Already in Use

```bash
# Find process using port 4000
lsof -i :4000

# Kill process
kill -9 <PID>
```

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

## 📧 Support

For issues or questions, please open a GitHub issue.

---

**Enjoy playing Guess The Song! 🎵🎉**

