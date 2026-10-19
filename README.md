# Watch Party 🎬

A real-time synchronized video streaming application built with React and Node.js. Watch YouTube videos together with friends, perfectly synced across all devices.

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://github.com/Sajiv17/watch-party)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-green)](https://socket.io/)

## Features

### 🎥 Real-Time Video Synchronization
- Sub-250ms play/pause propagation (P95)
- Automatic drift correction every 3 seconds
- Clock offset calibration for accurate sync
- Server-authoritative state management

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

### Synchronization Algorithm

**Clock Offset Estimation:**
```javascript
// NTP-like ping/pong for time sync
1. Client pings server 5 times
2. Measures RTT for each ping
3. Uses lowest RTT (least network jitter)
4. Calculates: offset = serverTime - (clientTime + RTT/2)
```

**Drift Correction:**
```javascript
// Runs every 3 seconds
drift = |actualPosition - expectedPosition|

if (drift > 500ms) → Hard seek
else if (drift > 200ms) → Playback rate nudge (1.05x/0.95x)
else → No correction needed
```

**Version Control:**
- Every state change increments version number
- Clients send version with commands
- Server rejects stale updates
- Prevents conflicts from concurrent actions

### State Management

```javascript
{
  videoId: string,
  status: 'playing' | 'paused',
  position: number,          // Position at last update
  updatedAt: timestamp,      // When position was recorded
  version: number,           // Increments on every change
  users: Map,
  playlist: [],
  chat: []
}
```

**Server-authoritative:** Single source of truth prevents conflicts.

## Performance

Tested with 10 concurrent users:

| Metric | Target | Achieved |
|--------|--------|----------|
| P95 Latency | ≤250ms | 25-45ms ✅ |
| Drift After Correction | ≤500ms | <200ms ✅ |
| Concurrent Users | 10+ | 10+ ✅ |

Run load test:
```bash
cd scripts && npm run loadtest
```

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

## Scaling

**Current:** In-memory state, single server

**Production path:**
1. **Redis** - Shared state across multiple servers
2. **Socket.io Redis Adapter** - Cross-server broadcasts
3. **Load Balancer** - Distribute connections
4. **PostgreSQL** - User accounts, history
5. **CDN** - Static assets

Estimated capacity: **100,000+ concurrent users**

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
