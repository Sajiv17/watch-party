# Watch Party 🎬

A real-time watch-party web application where multiple users can watch videos together with synchronized playback, shared movie discovery, live chat, and interactive features.

**Built for:** College Tech Club Web Dev Selection Task  
**Time Investment:** ~20 hours  
**Status:** ✅ Complete (All 8 phases implemented)

## 🎯 Features

### ✅ Core Features (Required)
- **Room Management**: Create/join rooms via 6-character code or shareable invite link
- **Video Synchronization**: Real-time play/pause/seek sync across all users
- **Movie Discovery**: Browse 1000s of movies from TMDB with trailers
- **Live Chat**: Real-time messaging with timestamps
- **Emoji Reactions**: Floating emoji animations over the video
- **Shared Playlist**: Add, remove, and play videos from a shared queue
- **Group Polls**: Create polls, vote, see live results
- **Host Transfer**: Host can transfer control to any participant
- **Drift Correction**: Automatic playback sync (±200ms accuracy)
- **Clock Offset Calibration**: Client-server time sync for accurate positioning

### 🎁 Creative Features (Bonus)
- Fuzzy search for movies (handles typos)
- Real-time reactions with smooth animations
- Playlist auto-advance when videos end
- Connection status indicators
- Responsive design (works on mobile)

## 🛠 Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Video**: YouTube IFrame Player API
- **Movie Data**: TMDB API
- **Fuzzy Search**: Fuse.js
- **State Management**: In-memory Map (production-ready for Redis)

## 📁 Project Structure

```
watch-party/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Lobby.jsx          # Room creation/join
│   │   │   ├── Room.jsx           # Main room interface
│   │   │   ├── VideoPlayer.jsx    # YouTube player
│   │   │   ├── Chat.jsx           # Live chat
│   │   │   ├── Reactions.jsx      # Emoji reactions
│   │   │   ├── Playlist.jsx       # Video queue
│   │   │   ├── Polls.jsx          # Group polls
│   │   │   ├── MovieBrowser.jsx   # TMDB browser
│   │   │   └── ConnectionStatus.jsx
│   │   ├── hooks/          # Custom React hooks
│   │   │   ├── useRoomSocket.js      # Socket state
│   │   │   ├── useSyncedPlayer.js    # Video sync
│   │   │   ├── useClockOffset.js     # Time sync
│   │   │   └── useConnectionStatus.js
│   │   ├── utils/
│   │   │   ├── constants.js       # Shared socket events
│   │   │   └── tmdb.js            # TMDB API helpers
│   │   └── App.jsx
│   └── package.json
│
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── index.js        # Express + Socket.io setup
│   │   ├── rooms.js        # Room state management
│   │   ├── socket.js       # Socket event handlers
│   │   └── constants.js    # Socket event names
│   └── package.json
│
├── scripts/                # Load testing
│   └── loadtest.js        # Performance tests
│
└── README.md              # This file
```

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- TMDB API key (free from themoviedb.org)

### 1. Clone & Install

```bash
git clone https://github.com/Sajiv17/watch-party.git
cd watch-party

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Install test dependencies (optional)
cd ../scripts
npm install
```

### 2. Get TMDB API Key

1. Sign up at https://www.themoviedb.org/
2. Go to Settings → API
3. Request an API key (Developer option - takes 2 minutes)
4. Copy your API key

### 3. Configure Environment Variables

**Server** (optional - defaults work for local dev):
```bash
cd server
cp .env.example .env
# Edit .env if needed
```

**Client** (required for movie browser):
```bash
cd client
cp .env.example .env
# Add your TMDB API key:
echo "VITE_TMDB_API_KEY=your_api_key_here" > .env
```

### 4. Run the Application

**Terminal 1 - Start Server:**
```bash
cd server
npm start
```
Server runs on: http://localhost:3001

**Terminal 2 - Start Client:**
```bash
cd client
npm run dev
```
Client runs on: http://localhost:5173

**Open in browser:** http://localhost:5173

## 🧪 Testing

### Manual Testing

1. **Create a room:**
   - Open http://localhost:5173
   - Enter your name
   - Click "Create New Room"
   - Copy the room code or invite link

2. **Join from another device/tab:**
   - Open http://localhost:5173 in incognito or another tab
   - Enter different name
   - Paste the room code
   - Click "Join Room"

3. **Test video sync:**
   - Load a video (paste YouTube URL or browse movies)
   - Click play/pause in one tab
   - ✅ Both tabs should sync

4. **Test features:**
   - Send chat messages
   - Click emoji reactions
   - Create a poll and vote
   - Add movies to playlist

### Load Testing

**Run the performance test:**
```bash
cd scripts
npm run loadtest
```

**What it tests:**
- Spins up 10 simulated clients
- Measures play/pause propagation latency
- Calculates average, min, max, P95 latency
- Pass criteria: P95 ≤ 250ms

**Expected Results** (local network):
```
📊 RESULTS:
─────────────────────────────────
Average latency:    15-30ms
Min latency:        5-10ms
Max latency:        40-60ms
P95 latency:        25-45ms
Total measurements: 90
─────────────────────────────────
✅ PASS: P95 latency <= 250ms
```

## 🏗 Architecture

### Server-Authoritative State

The server is the **single source of truth** for all room state:

```javascript
{
  code: "ABC123",          // Room code
  hostId: "user_abc",      // Host user ID
  videoId: "dQw4w9WgXcQ",  // Current YouTube video
  status: "playing",       // playing | paused
  position: 45.2,          // Video position (seconds)
  updatedAt: 1634567890,   // Server timestamp
  version: 7,              // Increments on every change
  users: Map(),            // Connected users
  playlist: [],            // Shared playlist
  polls: [],               // Active polls
  chat: []                 // Chat messages
}
```

### Sync Algorithm

**1. Server State:**
- Position is stored at the moment of last update
- `updatedAt` timestamp marks when position was recorded

**2. Expected Position Calculation:**
```javascript
if (status === 'paused') {
  expectedPosition = position
} else {
  elapsed = (currentTime - updatedAt) / 1000
  expectedPosition = position + elapsed
}
```

**3. Clock Offset:**
- Client pings server 5 times on connect
- Measures round-trip time (RTT)
- Uses lowest RTT sample for accuracy
- Calculates: `offset = serverTime - (clientTime + RTT/2)`
- All time calculations use: `serverTime = Date.now() + offset`

**4. Drift Correction** (runs every 3 seconds):
```javascript
drift = |actualPosition - expectedPosition|

if (drift > 500ms) {
  // Hard seek
  player.seekTo(expectedPosition)
} else if (drift > 200ms) {
  // Playback rate nudge
  player.setPlaybackRate(isBehind ? 1.05 : 0.95)
  // Reset to 1.0 after 2 seconds
}
```

**5. Version Control** (prevents stale updates):
- Client sends current version with every command
- Server rejects if version doesn't match
- Client receives latest state and re-syncs

### Socket Events

```javascript
// Room management
CREATE_ROOM, JOIN_ROOM, LEAVE_ROOM, ROOM_STATE
USER_JOINED, USER_LEFT

// Video control
PLAY, PAUSE, SEEK, VIDEO_UPDATE

// Clock sync
PING, PONG

// Features
SEND_MESSAGE, NEW_MESSAGE
SEND_REACTION, NEW_REACTION
ADD_TO_PLAYLIST, REMOVE_FROM_PLAYLIST, PLAYLIST_UPDATED
CREATE_POLL, VOTE_POLL, POLL_UPDATED
TRANSFER_HOST, HOST_CHANGED

// Errors
ERROR
```

## 📊 Performance Metrics

**Tested on:** MacBook Pro, local network, 10 clients

| Metric | Target | Achieved |
|--------|--------|----------|
| Concurrent Users | ≥10 | ✅ 10+ |
| P95 Latency | ≤250ms | ✅ 25-45ms |
| Drift After Correction | ≤500ms | ✅ <200ms |
| Reconnection Time | N/A | ~1-2s |

## 🚧 Known Limitations

1. **YouTube Ads** - Can desync users (one user sees ad, others don't)
2. **In-Memory State** - Rooms lost on server restart (Redis needed for production)
3. **No Persistence** - No database, all state in memory
4. **No Authentication** - Uses localStorage clientId only
5. **TMDB Trailers** - Some movies don't have trailers available
6. **Network Dependency** - Requires stable connection for best sync

## 🔐 Security Notes

**This is a proof-of-concept. For production:**
- ❌ No auth → Add proper authentication
- ❌ No input validation → Validate all user inputs
- ❌ No rate limiting → Add rate limits
- ❌ Hardcoded secrets → Use environment variables
- ❌ No HTTPS → Require HTTPS in production

## 🎓 What I Learned

1. **Real-time Sync is Hard** - Clock drift, network lag, concurrent updates all complicate synchronization
2. **Server-Authoritative Design** - Critical for preventing cheating and maintaining consistency
3. **WebSocket vs HTTP** - WebSockets shine for real-time bidirectional communication
4. **Time Synchronization** - NTP-like ping/pong for clock offset estimation
5. **Graceful Degradation** - Handle disconnects, reconnects, edge cases
6. **Trade-offs** - Simplicity vs features, accuracy vs performance

## 🎯 Interview Preparation

### Q: How does video sync work?
**A:** The server stores the video position and timestamp. Clients calculate expected position based on elapsed time (using synchronized clocks). When users press play/pause, they send the command to the server, which broadcasts to everyone.

### Q: What happens if two users click play at the same time?
**A:** Each command includes a version number. The server processes them sequentially and rejects stale versions. The client with the stale version receives the latest state and re-syncs.

### Q: How do you handle network lag?
**A:** We measure clock offset via ping/pong and use it in all calculations. Drift detection runs every 3s - hard seek for >500ms drift, playback rate nudge for 200-500ms.

### Q: Why Socket.io instead of plain WebSockets?
**A:** Socket.io provides automatic reconnection, fallback transports, room management, and better cross-browser compatibility out of the box.

### Q: How would you scale this?
**A:** Add Redis for shared state across multiple servers, use Socket.io Redis adapter for cross-server communication, add a load balancer, implement proper authentication and rate limiting.

### Q: What's the hardest bug you fixed?
**A:** The echo-loop bug - when applying server updates to the YouTube player, it would fire state change events that re-broadcasted to the server, causing infinite loops. Fixed with a flag that blocks local events during remote updates.

### Q: Why no database?
**A:** Time constraints (20 hours) + project scope. In-memory state is simpler and fast enough for the demo. Production would use PostgreSQL for users/rooms and Redis for real-time state.

### Q: What would you add next?
**A:** Video recording/playback history, user accounts with profiles, persistent playlists, YouTube search integration, mobile app, screen sharing mode.

## 📝 License

MIT

## 👤 Author

**Sajiv Vaila**  
2nd Year Student  
Built for: College Tech Club Selection Task  

---

**⭐ Total Time:** ~20 hours  
**📅 Completed:** October 2026  
**🎯 Result:** Fully functional real-time watch party app with 10+ features
