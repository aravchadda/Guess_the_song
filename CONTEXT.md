# Project Context: Guess The Song ("Replay")

> Authoritative developer reference for the stem-based music-guessing game in this repository.
> Generated from a full read of the source tree (excluding `node_modules`, `.next` build output,
> and the binary audio/video assets). Every claim below is grounded in code that exists in the repo.
>
> **Updated** to reflect the Google login / user system: backend-verified Google Identity
> (`@react-oauth/google` → `google-auth-library`) + a 30-day app JWT, with per-user play tracking and stats.

---

## Overview

**Replay** (product name shown in the UI; internal/package name "Guess The Song") is a browser-based
music-guessing game. A player is played a short (~25 second) audio clip of a hit song, but only *some*
of the song's instrument **stems** are audible. The player tries to name the song. Each wrong guess (or
manual "skip") reveals more stems, making the song progressively easier to recognize. Guessing correctly
with *fewer* stems revealed is a higher achievement.

The app is a **monorepo-style** layout with three cooperating Node/TypeScript packages plus a Python
data-collection toolkit:

- **`frontend/`** — Next.js 14 (App Router) + React 18 + TailwindCSS + Framer Motion. All game UX,
  animations, and audio playback (Web Audio API) live here.
- **`backend/`** — Express 4 + Mongoose 8 (MongoDB) REST API. Owns songs, play sessions, guess
  validation (fuzzy matching), stats, and audio-file serving.
- **`scripts/`** — TypeScript preprocessing pipeline that mixes raw stems into the three per-level MP3s
  using **FFmpeg**, plus seed helpers.
- **`getting_the_data/`** — Python scripts that build the song dataset from Spotify playlists + the
  YouTube Data API, download audio with `yt-dlp`, and trim silence.

The core data flow: Spotify/YouTube → CSV dataset → yt-dlp downloads clips → (external stem separation)
→ FFmpeg mixes stems into `level1/2/3.mp3` → MongoDB seeded from CSV → Express serves audio by song ID →
Next.js decodes and plays stems in the browser → user guesses → backend fuzzy-matches and records the play.

**Authentication:** Players must **sign in with Google before playing**. The frontend obtains a Google ID
token via `@react-oauth/google`; the backend verifies it with `google-auth-library`, upserts a `User`, and
issues a 30-day app JWT (signed with `JWT_SECRET`). The client stores the JWT in `localStorage` and sends it
as `Authorization: Bearer` on all play/stats calls. Every `Play` is tagged with the user's id, enabling
per-user statistics (`/api/stats/me`) alongside the global aggregate (`/api/stats`).

---

## Game Mechanics

### Stem Levels (the heart of the game)

Songs are separated into **6 raw stems**: `drums`, `bass`, `guitar`, `piano`, `vocals`, `other`. The
preprocessing pipeline (`scripts/preprocess.ts`) mixes these into **three cumulative levels** with FFmpeg's
`amix` filter:

| Level | UI label      | Stems actually mixed into the MP3                              | Source (`preprocess.ts`)     |
|-------|---------------|---------------------------------------------------------------|------------------------------|
| **1** | "drums"       | `drums` + `bass`                                              | `amix=inputs=2`  (lines 157-167) |
| **2** | "Instruments" | `drums` + `bass` + `guitar` + `piano`                        | `amix=inputs=4`  (lines 169-181) |
| **3** | "vocals"      | `drums` + `bass` + `guitar` + `piano` + `vocals` + `other`   | `amix=inputs=6`  (lines 183-197) |

> **IMPORTANT nuance / correction to naive assumptions:** The UI labels the levels "drums",
> "Instruments", "vocals", but the *audio* is cumulative and Level 1 already includes **bass**, not
> drums alone. Level 3 is the full mix (adds vocals **and** the `other` stem). Do not assume
> "Level 1 = drums only." The label is a simplification.

The player always starts at **Level 1**. There is no separate "reveal" of individual stems in the UI —
each level is a **pre-rendered, pre-mixed MP3** streamed from the backend. Switching level = loading and
playing a different MP3 file.

### Progression & End Conditions

Progression logic is split between `backend/src/routes/plays.ts` (authoritative) and
`frontend/src/app/game/page.tsx` (drives UX):

- **Correct guess at any level** → play is won. Backend sets `wasCorrect=true`, `guessedLevel=<level>`,
  `finishedAt=now`, and returns the reveal (`name`, `artists`, `youtube_link`). Frontend shows a green
  reveal + "Congrats" popup.
- **Wrong guess at Level 1 or 2** → *not* finished. Backend records the attempt and returns
  `{ correct: false }` (no reveal). Frontend advances `currentLevel` to the next level and shows a
  "Better luck next time" popup.
- **Wrong guess at Level 3** → game over. Backend sets `finishedAt=now`, returns the reveal. Frontend
  shows a red reveal.
- **Skip** (`POST /:playId/skip`) → advances `currentLevel` by 1 (records a `[SKIPPED]` attempt). Only
  allowed on levels 1 and 2; rejected at level 3. Skipping auto-plays the newly revealed level.

The frontend guards against double-submitting on the same level via `lastGuessedLevel` state.

### Scoring & Progression Tracking

Players sign in with Google, so **every `Play` is tied to a `User`** (`Play.userId`). "Score" is surfaced
two ways — **global** aggregates (`GET /api/stats`) and **per-user** aggregates (`GET /api/stats/me`). The
**Stats page** (`/stats`) shows the signed-in user's personal stats:

- **Total plays**, **correct plays**, **success rate**.
- **Average guessed level** (`averageLevel`) — lower is better (guessing at Level 1 = expert).
- **Distribution**: count of wins at level 1 / 2 / 3, and `failed`.

Both endpoints share a `computeStats(filter)` helper in `backend/src/routes/stats.ts` (the `/me` variant
passes `{ userId }`), implemented with `countDocuments` queries. Pre-auth `Play` documents have no `userId`
and therefore only appear in the global `/api/stats`, never in any user's `/me` stats.

### Song & Stem Storage Layout

Each song owns a folder named after its (sanitized) song name:

```
backend/preprocessed/<Song_Name>/level1.mp3   # drums+bass
backend/preprocessed/<Song_Name>/level2.mp3   # +guitar+piano
backend/preprocessed/<Song_Name>/level3.mp3   # +vocals+other  (full mix)

backend/separated/<Folder_Name>/{drums,bass,guitar,piano,vocals,other}.mp3   # raw stems (input to pipeline)
```

The `Song.preprocessed.{level1,level2,level3}` fields in MongoDB store **URL paths** like
`/preprocessed/<Song_Name>/level1.mp3` (not filesystem paths). The audio route translates these to disk
paths at request time.

---

## Repository Structure

```
Guess_the_song/
├── .cache                       # ⚠️ Spotify OAuth token cache — a LEAKED SECRET, should be gitignored/rotated
├── .gitignore                   # Consolidated ignores for all sub-packages
├── package.json                 # Root: only dependency is html2canvas (appears unused in current source)
├── package-lock.json            # Root lockfile (project name "Guess_the_song")
├── songs.csv                    # Reference dataset: Song_Name, Artists, "Definitive Genre" (308 songs) — genre labels
├── spotify_playlist_tracks.csv  # ★ Seed dataset: Song_Name, Artists, YouTube_Link, ViewCount, Release (308 songs)
├── __pycache__/                 # Python bytecode cache (spotifyplaylist)
├── preprocessed/                # 305 song folders of level{1,2,3}.mp3 at repo root (duplicate/legacy of backend/preprocessed)
│
├── backend/
│   ├── package.json             # Express/Mongoose API; scripts: dev, build, start, seed, test
│   ├── .env.example             # Documented env vars (PORT, MONGODB_URI, CORS, GOOGLE_CLIENT_ID, JWT_SECRET, ...)
│   ├── tsconfig.json            # CommonJS, ES2020, strict
│   ├── jest.config.js           # ts-jest, tests under src/__tests__
│   ├── add-test-song.js         # One-off: inserts a single "Test Song" if DB empty
│   ├── seed-from-csv.js         # JS seeder reading backend/spotify_playlist_tracks.csv (alt to seed.ts)
│   ├── spotify_playlist_tracks.csv  # Backend's own copy of the seed CSV (309 data rows)
│   ├── preprocessed/<song>/level{1,2,3}.mp3   # ★ Served audio (305 songs)
│   ├── separated/<song>/{6 stems}.mp3         # Raw stems (308 songs) — pipeline input, gitignored variants exist
│   └── src/
│       ├── index.ts             # App entry: middleware, routes, static audio, Mongo connect, listen(4000)
│       ├── models/
│       │   ├── Song.ts          # ISong schema (name, artists, youtube_link, viewcount, release_year, decade, preprocessed)
│       │   ├── Play.ts          # IPlay schema (session, userId, attempts[], currentLevel, guessedLevel, wasCorrect)
│       │   └── User.ts          # IUser schema (googleId, email, name, picture) — Google-authenticated users
│       ├── middleware/
│       │   └── auth.ts          # requireAuth/optionalAuth + JWT sign/verify (app session tokens)
│       ├── routes/
│       │   ├── auth.ts          # POST /google (verify Google ID token → upsert User → app JWT), GET /me
│       │   ├── plays.ts         # POST /start, /:playId/guess, /:playId/skip  (ALL require auth; tag play with userId)
│       │   ├── songs.ts         # GET /search?q=  (autocomplete hints)
│       │   ├── audio.ts         # GET /:songId/:level  (ID-based audio serving, hides song name)
│       │   └── stats.ts         # GET /  (global), GET /me (per-user, requires auth)
│       ├── utils/
│       │   ├── fuzzyMatch.ts    # ★ 5-strategy guess matcher + normalizeString + getMatchScore
│       │   └── viewCountFormatter.ts  # formatViewCount → "1.5B" / "12M" / "5K"
│       ├── scripts/
│       │   └── seed.ts          # ★ `npm run seed` — reads root spotify_playlist_tracks.csv → Mongo
│       └── __tests__/
│           ├── fuzzyMatch.test.ts
│           └── viewCountFormatter.test.ts
│
├── frontend/
│   ├── package.json             # Next 14, React 18, framer-motion, recharts, react-use-measure, @react-oauth/google; test=playwright
│   ├── .env.example             # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID
│   ├── next.config.js           # reactStrictMode; injects NEXT_PUBLIC_API_URL + NEXT_PUBLIC_GOOGLE_CLIENT_ID
│   ├── tailwind.config.ts       # Custom colors; content globs over src/
│   ├── postcss.config.js, tsconfig.json, next-env.d.ts, playwright.config.ts
│   ├── scripts/resize-images.js # sharp: resize album covers to 300x300 jpeg (quality 85)
│   ├── tests/game.spec.ts       # Playwright E2E (⚠️ STALE — asserts old UI text that no longer exists)
│   ├── public/                  # album-covers/, compressed/*.mp4, TV.png, on/off/running/overlay*.mp4, ding.m4a, static.gif
│   └── src/
│       ├── app/
│       │   ├── layout.tsx       # Root layout: fonts, Providers (Google OAuth + Auth), Header/Footer/OrientationLock
│       │   ├── providers.tsx    # ★ Client: GoogleOAuthProvider + AuthProvider wrapper
│       │   ├── page.tsx         # ★ Landing: Google sign-in GATE, TV video, hold-SPACE-to-enter, menu (PLAY ALL / POST 00s / USER STATS→/stats)
│       │   ├── globals.css      # Tailwind + global no-select styles (#0E0E10 bg)
│       │   ├── game/page.tsx    # ★★ THE GAME — carousel intro, stem playback, guessing, video sequencing (redirects if not signed in)
│       │   ├── stats/page.tsx   # Recharts bar chart of the signed-in user's level distribution (requires auth)
│       │   └── api/album-cover/[filename]/route.ts  # Next route handler serving public/album-covers/*
│       ├── components/
│       │   ├── Carousel.tsx     # rAF-driven infinite album-cover marquee (speed multiplier via ref)
│       │   ├── Card.tsx         # Single album cover tile (blur-load)
│       │   ├── TVWithVideo.tsx  # Landing TV frame + clipped video, zoom-on-hold
│       │   ├── VideoPlayer.tsx  # (Legacy) on/running/off video + play button (game page inlines its own version)
│       │   ├── Header.tsx       # "Replay" logo + fullscreen toggle; hidden on active game screen
│       │   ├── Footer.tsx       # Copyright + LinkedIn/GitHub links (authors: Arav, Supro)
│       │   └── OrientationLock.tsx  # Forces landscape on phones
│       └── lib/
│           ├── api.ts           # ★ Auth-aware fetch client (startPlay/guess/skip, getStats, getMyStats, loginWithGoogle, getMe, searchSongs)
│           ├── auth.tsx         # ★ AuthProvider + useAuth (token/user in localStorage)
│           └── audioManager.ts  # ★ Web Audio API singleton: load/decode/play/stop stem buffers, 1.5× gain
│
├── scripts/                     # Cross-package build/ops
│   ├── preprocess.ts            # ★ FFmpeg stem-mixing pipeline → level{1,2,3}.mp3 + preprocessed_songs.json
│   ├── preprocessed_songs.json  # Generated metadata (name/artists/links/paths) from a pipeline run
│   ├── package.json, tsconfig.json
│   ├── setup.sh                 # Ubuntu provisioning (Node 20, pnpm, MongoDB, FFmpeg, PM2)
│   ├── start-dev.sh             # Runs backend + frontend dev servers together
│   ├── deploy-prod.sh           # Builds both, runs under PM2 (guess-backend / guess-frontend)
│   ├── extract-audio.sh         # ffmpeg: pull mp3 audio out of compressed carousel videos
│   └── compress-videos.sh       # ffmpeg: H.264/CRF23 compress + .MOV→.mp4
│
└── getting_the_data/            # Python dataset builder
    ├── spotifyplaylist.py       # ⚠️ Spotipy: pull tracks from 4 hardcoded playlists → CSV (hardcoded credentials)
    ├── adding_yt_links.py       # ⚠️ YouTube Data API: find best video + viewcount per song (hardcoded API key)
    ├── step2_only.py            # Re-run of just the "prune bottom-100 by views" step
    ├── remove_low_view_songs.py # Drop songs < 1M views (and their downloaded files)
    ├── check_data.py            # Quick pandas stats on the CSV
    ├── audio_downloader.py      # ★ yt-dlp: download 40s–65s clip of each song → music_collection/
    ├── trim_silence.py          # pydub: trim leading silence from preprocessed level MP3s (deletes silent files)
    ├── spotify_playlist_tracks.csv  # This folder's copy of the dataset
    └── trim_output.log
```

**Note on the three copies of `spotify_playlist_tracks.csv`** (repo root, `backend/`, `getting_the_data/`):
they are working copies at different pipeline stages. The **root** copy is what `backend/src/scripts/seed.ts`
reads. The **backend** copy is what `backend/seed-from-csv.js` and `scripts/preprocess.ts` read. Keep them
in sync or standardize before relying on either seeder.

---

## Tech Stack

**Frontend**
- Next.js `^14.0.4` (App Router, React Server/Client Components)
- React `^18.2.0` / react-dom `^18.2.0`
- Framer Motion `^12.23.24` (all animations, page transitions, popups)
- `react-use-measure` `^2.1.7` (carousel width measurement)
- Recharts `^2.10.3` (stats bar chart)
- `@react-oauth/google` `^0.12.1` (Google Identity sign-in button + provider)
- TailwindCSS `^3.4.0`, PostCSS, Autoprefixer
- `sharp` `^0.34.5` (dev-time image resizing)
- Google Fonts: **Inter** (body), **Press Start 2P** (retro menu buttons, `--font-press-start-2p`)
- **Web Audio API** (native) for stem decoding/playback — no audio library dependency
- Playwright `^1.40.1` for E2E
- Language: TypeScript `^5`

**Backend**
- Express `^4.18.2`
- Mongoose `^8.0.3` (MongoDB)
- `string-similarity` `^4.0.4` (Dice-coefficient fuzzy matching)
- `google-auth-library` `^9.15.0` (verify Google ID tokens), `jsonwebtoken` `^9.0.2` (app session JWTs)
- `csv-parser` `^3.2.0` (seeding)
- `helmet`, `cors`, `morgan`, `express-rate-limit`, `dotenv`
- ts-node-dev (dev), tsc (build), Jest + ts-jest + supertest (test)
- Language: TypeScript `^5.3.3`, target ES2020, CommonJS

**Scripts / pipeline**
- Node + ts-node, `csv-parser`, `mongoose`
- **FFmpeg** (external binary; `amix`, `libmp3lame`) — required on PATH

**Data collection (Python)**
- `spotipy` (Spotify Web API), `google-api-python-client` (YouTube Data API v3)
- `yt-dlp` (audio download), `pydub` (silence trimming), `pandas`

**Infra / ops**
- MongoDB (default URI `mongodb://localhost:27017/guess-the-song`)
- PM2 for production process management (see `deploy-prod.sh`)
- Target host: Ubuntu 24.04 (see `setup.sh`)

---

## Architecture

### Data Flow (end to end)

**Offline / build-time pipeline:**
1. `getting_the_data/spotifyplaylist.py` pulls tracks from 4 Spotify playlists → `spotify_playlist_tracks.csv`
   (columns `Song_Name, Artists, Release`).
2. `getting_the_data/adding_yt_links.py` searches YouTube for each song, picks the highest-view video,
   and adds `YouTube_Link` + `ViewCount`. Songs under 1M views are pruned (`step2_only.py` /
   `remove_low_view_songs.py`).
3. `getting_the_data/audio_downloader.py` downloads a fixed **40s–65s** segment of each song via `yt-dlp`
   into `music_collection/`.
4. **Stem separation (external, not in repo):** each downloaded clip is split into 6 stems
   (`drums,bass,guitar,piano,vocals,other`) — the naming matches Demucs' `htdemucs_6s` model — and placed
   in `backend/separated/<Folder_Name>/`.
5. `scripts/preprocess.ts` reads the CSV, and for each song runs FFmpeg `amix` three times to produce
   `level1/2/3.mp3` in `backend/preprocessed/<Song_Name>/`, and writes `scripts/preprocessed_songs.json`.
6. `getting_the_data/trim_silence.py` (pydub) trims leading silence from the generated level MP3s.
7. `backend/src/scripts/seed.ts` (`npm run seed`) reads the CSV, computes `decade = floor(year/10)*10`,
   and inserts `Song` documents (with `preprocessed` URL paths) into MongoDB.

**Runtime request flow:**
0. **Sign-in gate:** Landing shows a "Sign in with Google" gate until authenticated. On success the frontend
   receives a Google ID token → `POST /api/auth/google` → backend verifies + upserts `User` → returns an app
   JWT stored in `localStorage` (`lib/auth.tsx`). `/game` and `/stats` redirect to `/` if no token is present.
1. Landing (`/`) → hold SPACE 2s → menu → `/game?mode=all` or `/game?mode=post00s`.
2. Game page mounts, shows a 3-row album-cover **carousel** intro. Hold SPACE 2s again → `cutToGameScreen()`.
3. `initializeGame()` calls `POST /api/plays/start` (with the `Authorization: Bearer <jwt>` header) with
   `{ mode: 'random', minYear: (post00s ? 2000 : undefined) }`. The created `Play` is tagged with the user's id.
4. Backend picks a random matching `Song`, creates a `Play` (currentLevel 1), and returns a **sanitized**
   payload: `playId`, `song.id`, `release_year`, `viewcount_formatted`, and `audio_urls` pointing to
   `/api/audio/<songId>/level{1,2,3}` (song **name/artist are never sent** to the client).
5. `AudioManager.loadLevel()` fetches `level1` as an ArrayBuffer, `decodeAudioData` into an `AudioBuffer`,
   caches it keyed `${songId}-level${n}`.
6. `GET /api/audio/:songId/:level` looks up the song, reads `song.preprocessed[level]`, strips the
   `/preprocessed/` prefix, `decodeURIComponent`s it, resolves to disk, and `sendFile`s the MP3.
7. Player presses play → `AudioManager.play()` routes buffer → GainNode(1.5×) → destination, and the
   "on → running" TV video sequence starts.
8. Player guesses → `POST /api/plays/:playId/guess { guess, level }` → `fuzzyMatch()` → response drives the
   correct/advance/game-over branches described in **Game Mechanics**.
9. Autocomplete: as the user types (≥2 chars, 300ms debounce) → `GET /api/songs/search?q=` returns up to 10
   `{ id, hint: "<name> - <artists>" }` suggestions.

### Key Components / Modules

| Module | Responsibility |
|--------|----------------|
| `backend/src/index.ts` | Express bootstrap: helmet, CORS (multi-origin via `CORS_ORIGIN`), JSON, morgan, route mounting, static `/preprocessed`, Mongo connect, `:4000` listen |
| `backend/src/routes/auth.ts` + `middleware/auth.ts` | Google ID-token verification, `User` upsert, app-JWT issue/verify, `requireAuth` guard |
| `backend/src/routes/plays.ts` | Session lifecycle + guess/skip logic (authoritative game rules; auth-gated, tags `userId`) |
| `backend/src/routes/audio.ts` | ID-based audio serving that hides song identity from the client |
| `backend/src/utils/fuzzyMatch.ts` | Tolerant guess matching (5 strategies, see Audio/Matching section) |
| `frontend/src/app/game/page.tsx` | Entire in-game experience + carousel intro + TV video state machine |
| `frontend/src/lib/audioManager.ts` | Web Audio buffer cache + playback engine (singleton) |
| `frontend/src/lib/api.ts` | All backend calls, typed |
| `frontend/src/components/Carousel.tsx` | Performance-tuned rAF marquee driven by a shared `speedMultiplierRef` |
| `scripts/preprocess.ts` | FFmpeg stem-mixing pipeline |

### State Management

No global state library (no Redux/Zustand). State is **local React state** in each page component. The
`game/page.tsx` holds ~30 `useState`/`useRef` values covering: play/session (`playId`, `song`,
`currentLevel`, `isFinished`, `reveal`, `lastGuessedLevel`), audio (`isPlaying`, `playbackProgress`),
carousel/intro animation (`showGameScreen`, `showBlackScreen`, `showYear`, `showViews`,
`showFullGameScreen`, `speedMultiplierRef`), and background-audio Web Audio nodes
(`audioCtxRef`, `lowpassFilterRef`, `highpassFilterRef`, `highShelfFilterRef`, `gainNodeRef`). Server
state is fetched on demand (no SWR/React Query). Cross-component signal: the game screen sets
`document.documentElement[data-game-screen]`, which `Header.tsx` observes via `MutationObserver` to hide
itself.

The one piece of **global** state is auth: `AuthProvider` (`lib/auth.tsx`) holds `{ user, token, isLoading }`,
hydrated from `localStorage` on mount, exposed via `useAuth()`, and provided app-wide from `app/providers.tsx`
(which also supplies the `GoogleOAuthProvider`). `lib/api.ts` reads the token from `localStorage` to attach
the `Bearer` header.

---

## Audio System

There are **two independent audio subsystems**:

### 1. Game stem playback — `frontend/src/lib/audioManager.ts` (Web Audio API)
- Singleton `AudioManager` (`getAudioManager()`).
- `initialize()` creates/resumes an `AudioContext` (must be triggered by a user gesture per autoplay policy).
- `loadLevel(songId, level, urls, apiUrl)` fetches the level MP3, `decodeAudioData`, and caches the
  `AudioBuffer` in a `Map` keyed `${songId}-level${n}`. Levels are loaded **lazily**: level 1 at init,
  higher levels when the player reaches them.
- `play(songId, level)` builds `BufferSource → GainNode(gain=1.5) → destination`. The 1.5× gain is a
  deliberate "+50% loudness" boost (`volumeGain = 1.5`).
- `getProgress()` powers the bottom progress bar; `setOnEnded()` lets the page auto-pause + play the "off"
  TV video when a clip finishes.
- `clear()` stops playback and drops all buffers (called on "next"/return-to-carousel).

### 2. Ambient/UX audio (landing + carousel) — inline in `page.tsx` / `game/page.tsx`
- The landing TV video and the carousel background music use **HTML `<audio>`/`<video>` elements piped
  through Web Audio `BiquadFilterNode`s**.
- Holding SPACE sweeps filters to build tension:
  - Carousel background (`game/page.tsx`): a random track from `/audio/*.mp3` plays at volume 0.3 through
    **lowpass (500Hz→20kHz)**, **highpass (20Hz)**, **highshelf (0→+12dB)**, and **gain (1×→1.5×)** nodes;
    volume ramps 0.3→0.8 over a 2-second hold. Speed multiplier ramps **1→15** to accelerate the carousel.
  - Landing (`page.tsx`): a single **highpass** filter sweeps 2000Hz→0 over the 2s hold, "opening up" the
    TV audio, then triggers the zoom + menu.
- A `ding.m4a` cue plays during the game-entry animation sequence.

> The `/audio/*.mp3` files referenced by the carousel are **generated** by `scripts/extract-audio.sh` from
> the `public/compressed/*.mp4` videos (they are not committed as `.mp3` under `public/` in the current tree —
> run the script to produce them).

### Guess matching — `backend/src/utils/fuzzyMatch.ts`
`normalizeString()` lowercases, maps `&`→`and`, strips punctuation, collapses whitespace. `fuzzyMatch()`
returns true if **any** of 5 strategies pass (threshold default **0.72**, overridable via
`MATCH_THRESHOLD`):
1. Substring containment either direction (guess ⊆ song name or vice versa).
2. Artist mentioned **and** ≥0.3 token overlap with the song name.
3. Dice similarity vs. song name ≥ threshold.
4. Dice similarity vs. `"<name> <artists>"` ≥ (threshold − 0.1).
5. Token-overlap (Jaccard on >2-char tokens) vs. `"<name> <artists>"` ≥ 0.6.

This tolerates typos, missing punctuation, and "song by artist" phrasing (validated by
`fuzzyMatch.test.ts`).

---

## Data Models (MongoDB / Mongoose)

### `Song` — `backend/src/models/Song.ts`
```ts
{
  name: string;            // required, indexed
  artists: string;         // required, indexed
  youtube_link: string;    // required
  viewcount: number;       // required, indexed
  release_year: number;    // required, indexed  (e.g. 1965, may be float in CSV like 1965.0)
  decade: number;          // required, indexed  (= floor(release_year/10)*10)
  preprocessed: {
    level1: string;        // "/preprocessed/<Song_Name>/level1.mp3"
    level2: string;
    level3: string;
  };
  createdAt, updatedAt;    // timestamps
}
// Compound indexes: {decade, viewcount desc}, {release_year, viewcount desc}
```

### `Play` — `backend/src/models/Play.ts`
```ts
{
  songId: ObjectId(ref Song);            // required, indexed
  userId?: ObjectId(ref User);           // the signed-in player; indexed {userId, createdAt desc}
  mode: 'random' | 'decade';             // required
  modeValue?: string;                    // e.g. the decade value when mode='decade'
  startedAt: Date;
  finishedAt?: Date;                     // set on win or level-3 loss
  currentLevel: number;                  // 1..3, default 1
  guessedLevel?: number;                 // 1..3, level at which the correct guess happened
  wasCorrect: boolean;                   // default false
  attempts: [{ attemptNumber, guessText, timestamp, correct }];  // includes '[SKIPPED]' markers
  createdAt, updatedAt;
}
// Indexes: {wasCorrect, guessedLevel}, {createdAt desc}, {userId, createdAt desc}
```

### `User` — `backend/src/models/User.ts`
```ts
{
  googleId: string;   // Google 'sub' claim — required, unique, indexed
  email: string;      // required, indexed
  name: string;       // required
  picture?: string;   // Google avatar URL
  createdAt, updatedAt;
}
```
Upserted on Google sign-in (`findOneAndUpdate({ googleId }, ..., { upsert: true })`). **Sessions are
stateless:** the app mints a 30-day JWT `{ userId, email }` signed with `JWT_SECRET`; the client stores it in
`localStorage` and sends it as `Authorization: Bearer`. There is no server-side session store.

---

## API Reference

Base URL: `http://localhost:4000` (configurable via `NEXT_PUBLIC_API_URL` on the frontend). All JSON.

| Method | Path | Body / Query | Purpose | Response |
|--------|------|--------------|---------|----------|
| POST | `/api/auth/google` | `{ credential: <Google ID token> }` | Verify Google token, upsert `User`, issue app JWT | `{ token, user{ id, email, name, picture } }` |
| GET | `/api/auth/me` | — (Bearer) | Current user's profile | `{ user{ id, email, name, picture } }` |
| POST | `/api/plays/start` | `{ mode?: 'random'\|'decade', value?, minYear? }` (Bearer) | Start a session; picks a random matching song | `{ playId, song: { id, release_year, viewcount_formatted, audio_urls{level1,2,3} } }` |
| POST | `/api/plays/:playId/guess` | `{ guess: string, level?: 1\|2\|3 }` | Submit a guess (fuzzy-matched) | correct→`{correct:true, reveal{name,artists,youtube_link}}`; wrong L1/L2→`{correct:false}`; wrong L3→`{correct:false, reveal{...}}` |
| POST | `/api/plays/:playId/skip` | — | Advance to next level (L1/L2 only) | `{ currentLevel }` |
| GET | `/api/songs/search` | `?q=<string>` | Autocomplete hints (≤10) | `[{ id, hint: "<name> - <artists>" }]` |
| GET | `/api/stats` | — | Global aggregate stats | `{ totalPlays, correctPlays, averageLevel, distribution{level1,level2,level3,failed} }` |
| GET | `/api/stats/me` | — (Bearer) | Per-user aggregate stats (same shape as `/api/stats`) | `{ ...same shape }` |
| GET | `/api/audio/:songId/:level` | level ∈ {level1,level2,level3} | Stream a level MP3 by song ID (name hidden) | `audio/mpeg` file |
| GET | `/preprocessed/*` | — | Static passthrough to the audio dir (name-revealing; game uses the ID route instead) | file |
| GET | `/health` | — | Liveness | `{ status:'ok', timestamp }` |

**Auth:** all `/api/plays/*` routes and `/api/stats/me` require a valid `Authorization: Bearer <jwt>` header
(401 otherwise). Tokens come from `POST /api/auth/google`. Guess/skip also verify the play's `userId` matches
the caller (403 otherwise). `/api/stats` (global), `/api/songs/search`, `/api/audio/*`, `/preprocessed/*`, and
`/health` remain public.

**Modes:** the backend supports `random` and `decade`. The **frontend only uses `random`** (with optional
`minYear=2000` for "PLAY POST 00s"). `decade` mode and the `value` param are implemented server-side but
not wired into the current UI.

**Security-by-obscurity:** `/api/plays/start` and `/api/audio/:songId/:level` deliberately avoid exposing
the song name until the reveal, so a player cannot cheat by reading network paths.

---

## Frontend Structure

**Routes (App Router):**
- `/` (`app/page.tsx`) — Landing "REPLAY". A full-screen **Google sign-in gate** overlays everything until
  the user authenticates (with a "Sign out" control shown once signed in). A `TVWithVideo` plays a random
  muted clip; holding SPACE (or tap-hold on mobile) for 2s sweeps a highpass filter open, zooms the TV, and
  reveals the menu: **PLAY ALL** → `/game?mode=all`, **PLAY POST 00s** → `/game?mode=post00s`,
  **USER STATS** → `/stats`.
- `/game` (`app/game/page.tsx`) — The game. Two phases: (a) **carousel intro** (3 rows of album covers +
  filtered background music; hold SPACE to charge in), (b) **game screen** (TV video state machine
  on/running/off, play button, guess input with autocomplete, level indicators, skip button, year & views
  HUD, success/failure popups). `mode` query param selects `all` vs `post00s`.
- `/stats` (`app/stats/page.tsx`) — the **signed-in user's** personal stats (Recharts bar chart + cards) from
  `GET /api/stats/me`; redirects to `/` if not authenticated.
- `/api/album-cover/[filename]` — Next route handler serving `public/album-covers/*` with long cache headers.

**Global chrome:** `layout.tsx` wraps every page with `Providers` (Google OAuth + Auth context), then
`OrientationLock` (forces landscape on phones),
`Header` (Replay logo + fullscreen toggle, auto-hidden during active gameplay), and `Footer` (credits +
links). Global CSS disables text selection everywhere except inputs; background is `#0E0E10`.

**UX patterns worth knowing:**
- **Hold-to-charge SPACE** is the primary interaction verb on both landing and carousel (2-second hold,
  visual fill via `clipPath` inset animation).
- **Mobile:** detected via touch + `<768px`; buttons switch to "HOLD"/tap-hold, portrait shows a rotate lock.
- **Keyboard:** SPACE (charge/return), `P` (play/pause), Enter (submit guess).
- The TV "screen" is a real `<video>` clipped behind a `TV.png` frame; the game's on/running/off videos
  simulate a TV powering on, playing, and powering off in sync with audio.

---

## Backend Structure

- **Entry (`index.ts`):** security (`helmet`), configurable multi-origin CORS, JSON body parsing, `morgan`
  logging. Mounts the 5 routers under `/api/*`. Serves `/preprocessed` statically with 1-year immutable
  cache. Connects to Mongo then listens on `PORT` (default 4000). Generic 404 + error handlers.
- **Routers:** `auth`, `plays`, `songs`, `stats`, `audio` (thin Express routers returning JSON, except audio
  which streams files).
- **Auth:** `middleware/auth.ts` provides `requireAuth` (verifies the app JWT, sets `req.userId`) and
  `optionalAuth`. The `plays` router applies `requireAuth` globally (`router.use(requireAuth)`); `stats`
  applies it to `/me`. `routes/auth.ts` verifies Google ID tokens via `google-auth-library` and upserts the
  `User`. `GOOGLE_CLIENT_ID` and `JWT_SECRET` are env-driven, each with an insecure local default; a startup
  warning is logged when `JWT_SECRET` is unset.
- **Rate limiting:** a `guessLimiter` (30 req/min) is defined and *intended* for the guess endpoint. **Note:**
  it is registered with `app.post('/api/plays/:playId/guess', guessLimiter)` **after** the `playsRouter`
  is already mounted at `/api/plays`, so in practice the router handles the request first and the limiter
  likely never runs. Treat guess rate-limiting as effectively **not active** until this ordering is fixed.
- **Data layer:** Mongoose models with indexes tuned for random selection by `decade`/`release_year` and
  for stats aggregation.
- **Seeding:** `npm run seed` → `src/scripts/seed.ts` (clears the collection, then inserts from the root
  CSV). `seed-from-csv.js` is a standalone JS equivalent reading the backend CSV; `add-test-song.js`
  inserts a single placeholder.

---

## Configuration

### Environment Variables

`.env.example` files are now committed for both `backend/` and `frontend/` (copy to `.env` / `.env.local`).
Variables actually read by the code:

| Variable | Used in | Default | Purpose |
|----------|---------|---------|---------|
| `PORT` | `backend/src/index.ts` | `4000` | Backend HTTP port |
| `MONGODB_URI` | `index.ts`, `seed.ts` | `mongodb://localhost:27017/guess-the-song` | Mongo connection |
| `CORS_ORIGIN` | `index.ts` | `http://localhost:3000` | Comma-separated allowed origins (add `https://replays.in` in prod) |
| `AUDIO_PATH` | `index.ts`, `audio.ts` | `<backend>/preprocessed` | Root dir of level MP3s on disk |
| `MATCH_THRESHOLD` | `plays.ts` | `0.72` | Fuzzy-match strictness (0–1) |
| `GOOGLE_CLIENT_ID` | `backend` (`routes/auth.ts`) | project dev client id | Google OAuth Client ID used to **verify** ID tokens |
| `JWT_SECRET` | `backend` (`middleware/auth.ts`) | insecure dev default (logs a warning) | Secret for signing app session JWTs — **set a strong value in prod** |
| `NEXT_PUBLIC_API_URL` | `frontend` (`api.ts`, `next.config.js`) | `http://localhost:4000` | Backend base URL for the client |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `frontend` (`providers.tsx`, `next.config.js`) | project dev client id | Google OAuth Client ID for the sign-in button |

**Deployment note (`https://replays.in`):** the OAuth client's **Authorized JavaScript origins** must list
both `http://localhost:3000` (dev) and `https://replays.in` (prod). The chosen setup uses **two separate
OAuth clients** (dev + prod), selected purely via the `*_GOOGLE_CLIENT_ID` env vars — no code changes between
environments. Google sign-in requires **HTTPS in production** (localhost is exempt). The Client ID is public
(safe in the bundle); no client secret is needed for this ID-token verification flow.

**Hardcoded credentials in the Python scripts (must be externalized/rotated):**
- `getting_the_data/spotifyplaylist.py`: Spotify `CLIENT_ID` / `CLIENT_SECRET`.
- `getting_the_data/adding_yt_links.py` and `step2_only.py`: `YOUTUBE_API_KEY`.
- Root `.cache`: a committed Spotify OAuth access token.

### Build & Deploy

- **Backend:** `npm run build` (tsc → `dist/`), `npm start` (`node dist/index.js`).
- **Frontend:** `npm run build` (`next build`), `npm start` (`next start`).
- **Production (`scripts/deploy-prod.sh`):** builds both, then runs under PM2 as `guess-backend`
  (`dist/index.js`) and `guess-frontend` (`npm start`), `pm2 save` + `pm2 startup`.
- **Provisioning (`scripts/setup.sh`):** Ubuntu 24.04 — installs Node 20, pnpm, MongoDB, FFmpeg, PM2.

---

## Development Setup

Prerequisites: **Node 20+**, **MongoDB** running locally, **FFmpeg** on PATH (for preprocessing),
and (for the data pipeline) **Python 3** with `spotipy`, `google-api-python-client`, `yt-dlp`, `pydub`, `pandas`.

```bash
# 1. Install dependencies (each package separately)
cd backend  && npm install
cd ../frontend && npm install
cd ../scripts  && npm install

# 2. Ensure MongoDB is running (default localhost:27017)

# 3. (If you have raw stems) generate the level MP3s:
#    Place 6 stems per song in  backend/separated/<Folder>/{drums,bass,guitar,piano,vocals,other}.mp3
cd scripts && npx ts-node preprocess.ts        # or: npm run preprocess

# 4. Seed MongoDB from the CSV
cd ../backend && npm run seed                   # reads ../spotify_playlist_tracks.csv

# 5. Configure env (auth)
cp backend/.env.example backend/.env            # set a real JWT_SECRET; GOOGLE_CLIENT_ID default works locally
cp frontend/.env.example frontend/.env.local    # dev Google Client ID default works on http://localhost:3000

# 6. Run the servers (two terminals)
cd backend  && npm run dev                      # http://localhost:4000
cd frontend && npm run dev                      # http://localhost:3000

# Or run both at once (Linux/macOS):
bash scripts/start-dev.sh
```

**Auth prerequisite:** confirm `http://localhost:3000` is listed under the OAuth client's *Authorized
JavaScript origins* in Google Cloud Console (the committed dev Client ID already targets it). The `User`
collection is created automatically by Mongoose on first sign-in — no migration needed.

Visit **http://localhost:3000** → sign in with Google → play. If audio 404s, confirm
`backend/preprocessed/<Song_Name>/level*.mp3` exists and that the folder name matches the DB `preprocessed`
path exactly (see the naming gotcha below).

**Tests:**
- Backend unit: `cd backend && npm test` (Jest — fuzzyMatch + viewCountFormatter).
- Frontend E2E: `cd frontend && npm test` (Playwright — but the spec is stale, see Open Questions).

---

## Key Files Reference

| File | What it does |
|------|--------------|
| `scripts/preprocess.ts` | FFmpeg mixes 6 stems → `level1/2/3.mp3`; defines the level→stems mapping |
| `backend/src/routes/plays.ts` | Start/guess/skip; authoritative level-progression & win/lose rules (auth-gated) |
| `backend/src/routes/auth.ts` | Google ID-token verification, `User` upsert, app-JWT issuance |
| `backend/src/middleware/auth.ts` | `requireAuth`/`optionalAuth`; JWT sign/verify |
| `frontend/src/lib/auth.tsx` | `AuthProvider` + `useAuth` (client session state) |
| `backend/src/routes/audio.ts` | Serves level MP3s by song ID (hides song name) |
| `backend/src/utils/fuzzyMatch.ts` | 5-strategy tolerant guess matcher |
| `backend/src/models/Song.ts` / `Play.ts` | Mongoose schemas |
| `backend/src/scripts/seed.ts` | CSV → MongoDB seeder (`npm run seed`) |
| `frontend/src/app/game/page.tsx` | The entire game UX (~1800 lines) |
| `frontend/src/lib/audioManager.ts` | Web Audio stem load/decode/play engine |
| `frontend/src/lib/api.ts` | Typed backend client |
| `getting_the_data/audio_downloader.py` | yt-dlp clip downloader (40–65s window) |
| `getting_the_data/trim_silence.py` | pydub leading-silence trimmer for level MP3s |
| `spotify_playlist_tracks.csv` | The seed dataset (name, artists, YouTube link, views, release year) |
| `songs.csv` | Parallel reference dataset with a "Definitive Genre" column (not used at runtime) |

---

## Open Questions / TODOs / Gotchas

1. **⚠️ Committed secrets.** The root `.cache` file contains a live Spotify OAuth token; Python scripts
   embed Spotify client id/secret and a YouTube API key. These should be rotated and moved to env vars;
   `.cache` should be gitignored (it is only partially covered — `.gitignore` lists `.cache`, but the file
   is already tracked/present).

2. **Filesystem naming mismatch between `separated/` and `preprocessed/`.** `scripts/preprocess.ts` uses
   `convertToFolderName()` for the **input** stem folder (apostrophe→`_`, and `?`/`:`/`"`→`#`) but
   `sanitizeSongName()` for the **output** folder (only `<>:"|?*`→`_`). Confirmed on disk:
   input `backend/separated/(I Can_t Get No) Satisfaction - Mono/` vs output
   `backend/preprocessed/(I Can't Get No) Satisfaction - Mono/`. Meanwhile `seed-from-csv.js` uses yet a
   third sanitizer (also replaces `/` and `\`). Songs with `? : " / \` in their names are the most likely
   to break the DB-path ↔ disk-path linkage. Standardizing on one canonical name function is advisable.

3. **Rate limiter almost certainly inactive.** `guessLimiter` is attached after the router mount (see
   Backend Structure). Guess spamming is currently unthrottled in practice.

4. **Auth is required to play** (added). Google sign-in gates the whole app; `/api/plays/*` and
   `/api/stats/me` return 401 without a valid JWT. `JWT_SECRET` has an **insecure dev default** (logs a
   warning) — set a strong secret in production. Pre-auth `Play` documents have no `userId`, so they only
   count in the global `/api/stats`, not any user's `/me` stats. *(The former "USER STATS → /game" mislink
   was fixed as part of this — it now points to `/stats`.)*

5. **`decade` mode is server-only.** The backend fully supports `mode: 'decade'` + `value`, but no UI path
   sends it (frontend only ever calls `startPlay('random', ...)`). Dead-but-ready feature.

6. **Stale Playwright test.** `frontend/tests/game.spec.ts` asserts UI text ("Random Song", "Pick a
   Decade", "View Statistics", "Choose a Decade", h1 "Guess The Song") that the current landing/game pages
   no longer render (the real UI is "PLAY ALL / PLAY POST 00s / USER STATS" and title "REPLAY"). The E2E
   suite will fail until rewritten.

7. **Possible failing unit expectation.** `viewCountFormatter.test.ts` expects `formatViewCount(999_999)`
   to be `'1M'`, but the implementation takes the `>=1000` branch → `Math.round(999999/1000)` = `1000` →
   returns `'1000K'`. Verify whether this test currently passes; the code and test appear to disagree at
   this boundary.

8. **Three copies of the seed CSV** (root, `backend/`, `getting_the_data/`) can drift. Row counts differ
   slightly (root data ≈308, backend ≈309). Decide on a single source of truth. Different seeders read
   different copies (`seed.ts`→root, `seed-from-csv.js`/`preprocess.ts`→backend).

9. **Two `preprocessed/` trees** exist: repo-root `preprocessed/` (305 songs) and
   `backend/preprocessed/` (305 songs). The backend serves from `backend/preprocessed` (or `AUDIO_PATH`).
   The root copy appears to be a duplicate/legacy; confirm which is canonical before pruning.

10. **No README / CLAUDE.md.** This `CONTEXT.md` is the most complete documentation in the repo.

11. **Stem separation step is external.** Nothing in-repo performs the 6-stem split; the pipeline assumes
    `backend/separated/<song>/{drums,bass,guitar,piano,vocals,other}.mp3` already exist (stem names match
    Demucs `htdemucs_6s`). Document/automate this step for reproducibility.

12. **Root `html2canvas` dependency** (root `package.json`) is not referenced by any source read here —
    likely vestigial (perhaps intended for a "share your result as an image" feature).
