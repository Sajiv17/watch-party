# Watch Party 🎬

A real-time watch-party web application where multiple users can watch videos together with synchronized playback, shared movie discovery, live chat, and interactive features.

> **Status**: 🚧 In Development - Phase 1 Complete (Foundation & Room Management)

## 🎯 Project Goal

Build a production-ready watch party app that supports:
- 10+ concurrent users per room
- Sub-250ms playback control propagation (p95)
- Automatic drift correction (≤500ms)
- Reliable handling of reconnections and concurrent actions

## 🛠 Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Video**: YouTube IFrame Player API
- **Movie Data**: TMDB API
- **Fuzzy Search**: Fuse.js
- **State**: In-memory (production-ready for Redis scaling)

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

## ✨ Features

### ✅ Implemented (Phase 1)
- **Room Management**: Create and join rooms via 6-character code or shareable invite link
- **User Management**: Real-time user list with host badge
- **Socket.io Integration**: WebSocket-based real-time communication
- **Responsive UI**: Clean, modern interface with Tailwind CSS

### 🚧 Planned (Phases 2-8)

**Phase 2: Video Synchronization**
- YouTube IFrame Player integration
- Server-authoritative state with version control
- Play/pause/seek synchronization
- Late join support with auto-seek
- Echo-loop prevention

**Phase 3: Drift Correction**
- Clock offset estimation via ping/pong
- Automatic drift detection (every ~3s)
- Hard seek for drift >500ms
- Playback rate nudging for 200-500ms drift

**Phase 4: Movie Discovery**
- TMDB API integration (categories, search, filters)
- Fuzzy search with Fuse.js
- Trailer playback in room
- Add movies to shared playlist

**Phase 5: Interactive Features**
- Live chat with timestamps
- Emoji reactions
- Shared playlist with auto-advance
- Group polls with live results
- Host transfer (manual + automatic)

**Phase 6: Reliability**
- Reconnection handling with grace period
- Concurrent action resolution
- Edge case handling (refresh, host disconnect, invalid codes)
- Error UI with recovery options

**Phase 7: Performance & Creative Features**
- Load test script (10+ simulated clients)
- Latency measurement and reporting
- 3-2-1 synchronized countdown
- Poll-to-playlist automation
- Reaction timeline (stretch goal)

**Phase 8: Production Ready**
- Complete documentation (README + DESIGN.md)
- Deployment configs (Vercel + Render/Railway)
- Performance benchmarks
- Interview preparation guide

## 📁 Project Structure

```
watch-party/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Lobby.jsx          # Room creation/join
│   │   │   └── Room.jsx           # Main room interface
│   │   ├── hooks/          # Custom React hooks (Phase 2+)
│   │   ├── utils/
│   │   │   └── constants.js       # Shared socket events
│   │   ├── App.jsx         # Main app with routing
│   │   └── main.jsx
│   └── package.json
│
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── constants.js    # Socket event names
│   │   ├── rooms.js        # Room state management
│   │   ├── socket.js       # Socket.io event handlers
│   │   └── index.js        # Express + Socket.io setup
│   └── package.json
│
├── scripts/                # Load testing (Phase 7)
│   └── loadtest.js        # (Coming soon)
│
├── README.md              # This file
└── DESIGN.md              # Architecture docs (Phase 8)
```

## 🏗 Architecture Highlights

### Server-Authoritative State
The server is the single source of truth for all room state:
- Video position, status (playing/paused), current video ID
- Timestamp-based position calculation for accuracy
- Version numbers prevent stale/concurrent update conflicts

### Real-Time Communication
- Socket.io for bidirectional WebSocket communication
- Event-based architecture with shared constants
- Automatic reconnection with state restoration

### Scalability Considerations
- In-memory state (Map) for development
- Ready for Redis adapter for multi-server deployments
- Efficient message batching and state serialization

## 🧪 Testing Locally

1. Start the server and client (see Setup section above)
2. Open http://localhost:5173 in two browser windows/tabs
3. Create a room in one window
4. Copy the invite link or room code
5. Join from the second window
6. Both users should appear in the participants list!

## 📚 Documentation

Detailed architecture and sync algorithm documentation will be available in `DESIGN.md` (Phase 8).

## 🎓 Learning Resources

This project demonstrates:
- Real-time WebSocket communication with Socket.io
- Server-authoritative game/app state management
- Concurrent action handling and conflict resolution
- Clock synchronization techniques
- React hooks and modern React patterns
- RESTful vs real-time architecture tradeoffs

## 📝 License

MIT
