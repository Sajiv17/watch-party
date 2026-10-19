# Watch Party 🎬

A real-time synchronized video streaming application built with React and Node.js. Watch YouTube videos together with friends, perfectly synced across all devices.

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://github.com/Sajiv17/watch-party)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-green)](https://socket.io/)

## Features

### 🎥 Real-Time Video Synchronization
- Automatic drift correction every 3 seconds
- Server-authoritative state management
- Version control for conflict resolution
- Handles network delays and buffering

### 🎬 Movie Discovery
- Browse 1000s of movies via TMDB API
- Search entire TMDB database
- Watch trailers instantly
- Add to shared playlist

### 💬 Interactive Features
- Live chat with timestamps
- Emoji reactions with floating animations
- Shared playlist with queue management
- Host transfer capabilities

### 🔄 Robust Connection Handling
- Automatic reconnection on network drop
- Graceful degradation
- Late-join support (users can join mid-video)
- Connection status indicators

## Tech Stack

**Frontend:**
- React 18 + Vite
- Socket.io Client
- Tailwind CSS
- YouTube IFrame Player API

**Backend:**
- Node.js + Express
- Socket.io
- In-memory state (scalable to Redis)

**APIs:**
- TMDB (The Movie Database)
- YouTube Player API

## Quick Start

### Prerequisites
- Node.js 16+
- TMDB API key ([Get one free](https://www.themoviedb.org/settings/api))

### Installation

```bash
# Clone repository
git clone https://github.com/Sajiv17/watch-party.git
cd watch-party

# Install dependencies
npm install --prefix server
npm install --prefix client
```

### Configuration

**Client** (`client/.env`):
```env
VITE_TMDB_API_KEY=your_api_key_here
```

**Server** (`server/.env`):
```env
PORT=3001
NODE_ENV=development
```

### Run

```bash
# Terminal 1 - Start server
cd server && npm start

# Terminal 2 - Start client
cd client && npm run dev
```

Open http://localhost:5173

## Architecture

### How Synchronization Works

**Server-Authoritative State:**
- Server maintains the single source of truth
- All clients receive updates from the server
- Prevents conflicts when multiple users act simultaneously

**Version Control:**
- Each state change increments a version number
- Server rejects outdated commands
- Ensures only one action wins when conflicts occur

**Drift Correction:**
- Every 3 seconds, clients check their position against the server
- If off by more than 2 seconds, video jumps back to correct position
- Handles network delays and buffering issues automatically

**Room State:**
- Current video and playback status (playing/paused)
- Position and timestamp of last update
- List of participants
- Playlist and chat messages

## Project Structure

```
watch-party/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks (sync, socket, clock)
│   │   └── utils/       # TMDB API, constants
│   └── package.json
├── server/              # Node.js backend
│   ├── src/
│   │   ├── index.js     # Express + Socket.io setup
│   │   ├── rooms.js     # Room state management
│   │   └── socket.js    # Socket event handlers
│   └── package.json
├── scripts/             # Load testing
└── docs/                # Additional documentation
```

## Scaling to Production

**Current Setup:**
- In-memory state on single server
- Works great for demos and small groups

**To Scale for Production:**
1. Add Redis for shared state across multiple servers
2. Use Socket.io Redis adapter for cross-server communication
3. Add load balancer to distribute user connections
4. Add database (PostgreSQL) for user accounts and history
5. Use CDN for faster asset loading

## Known Limitations

- YouTube ads can cause desync between users
- In-memory state lost on server restart (use Redis for production)
- No authentication (uses localStorage only)
- Some movies don't have trailers on TMDB

## License

MIT

## Author

**Sajiv Vaila**  
[GitHub](https://github.com/Sajiv17) • [Project Link](https://github.com/Sajiv17/watch-party)
