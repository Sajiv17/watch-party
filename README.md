# Watch Party

A real-time watch-party web app where multiple users watch videos together with synchronized playback and shared movie discovery.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Video**: YouTube IFrame Player API
- **Movie Data**: TMDB API
- **Fuzzy Search**: Fuse.js

## Setup

### 1. Clone the repository
```bash
git clone <repo-url>
cd watch-party
```

### 2. Install dependencies

**Server:**
```bash
cd server
npm install
cp .env.example .env
# Edit .env if needed (defaults work for local dev)
```

**Client:**
```bash
cd client
npm install
cp .env.example .env
# Add your TMDB API key to .env (get from https://www.themoviedb.org/settings/api)
```

### 3. Get TMDB API Key

1. Sign up at https://www.themoviedb.org/
2. Go to Settings → API
3. Request an API key (choose "Developer" option)
4. Copy the API key to `client/.env` as `VITE_TMDB_API_KEY`

### 4. Run the app

**Terminal 1 - Server:**
```bash
cd server
npm start
```

**Terminal 2 - Client:**
```bash
cd client
npm run dev
```

Open http://localhost:5173 in your browser.

## Features (In Progress)

- ✅ Create and join rooms via 6-character code or invite link
- ✅ User list with host badge
- 🚧 Synchronized video playback (play/pause/seek)
- 🚧 Movie discovery with TMDB
- 🚧 Live chat and emoji reactions
- 🚧 Shared playlist
- 🚧 Group polls
- 🚧 Host transfer

## Documentation

(Will be completed in Phase 8)

## License

MIT
