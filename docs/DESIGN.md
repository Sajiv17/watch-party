# Watch Party - Technical Design Document

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Lobby.jsx  │  │   Room.jsx   │  │VideoPlayer   │          │
│  │              │  │              │  │    .jsx      │          │
│  │ - Create room│  │ - Host UI    │  │              │          │
│  │ - Join room  │  │ - Layout     │  │ - YouTube    │          │
│  └──────────────┘  └──────────────┘  │   IFrame API │          │
│                                       │ - Sync logic │          │
│  ┌──────────────┐  ┌──────────────┐  └──────────────┘          │
│  │    Chat      │  │  Reactions   │                             │
│  │   Playlist   │  │    Polls     │  ┌──────────────┐          │
│  │MovieBrowser  │  │ConnectionSts │  │Custom Hooks  │          │
│  └──────────────┘  └──────────────┘  │              │          │
│                                       │ - useRoomSocket          │
│                                       │ - useSyncedPlayer        │
│                                       │ - useClockOffset         │
│                                       │ - useConnectionStatus    │
│                                       └──────────────┘          │
│                                                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ WebSocket (Socket.io)
                         │ Bidirectional, Real-time
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    BACKEND (Node.js)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Socket.io Event Handlers                     │  │
│  │                                                            │  │
│  │  CREATE_ROOM  │  PLAY    │  SEND_MESSAGE  │  CREATE_POLL │  │
│  │  JOIN_ROOM    │  PAUSE   │  SEND_REACTION │  VOTE_POLL   │  │
│  │  LEAVE_ROOM   │  SEEK    │  ADD_PLAYLIST  │  TRANSFER_HOST  │
│  │                                                            │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Room State Manager (rooms.js)                │  │
│  │                                                            │  │
│  │  In-Memory Map:                                           │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Room {                                             │  │  │
│  │  │   code, hostId, videoId,                           │  │  │
│  │  │   status, position, updatedAt, version,            │  │  │
│  │  │   users (Map), playlist, polls, chat               │  │  │
│  │  │ }                                                   │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  Functions:                                               │  │
│  │  - createRoom(), getRoom(), deleteRoom()                  │  │
│  │  - addUserToRoom(), removeUserFromRoom()                  │  │
│  │  - updateVideoState(), transferHost(), autoAssignHost()   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ HTTPS
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  External APIs                                   │
├─────────────────────────────────────────────────────────────────┤
│  - TMDB API (movie metadata, posters, trailers)                 │
│  - YouTube IFrame API (video playback)                          │
└─────────────────────────────────────────────────────────────────┘
```

## Synchronization Algorithm

### Problem Statement
**Challenge:** Keep video playback synchronized across 10+ users with different:
- Network latencies (10-200ms)
- Clock drift (client/server time mismatch)
- Concurrent actions (multiple users clicking simultaneously)

**Goal:** 
- Propagation latency ≤250ms (P95)
- Drift after correction ≤500ms
- No echo loops or stale updates

### Solution: Server-Authoritative State + Clock Sync

#### Step 1: Server as Single Source of Truth

The server maintains the canonical state:

```javascript
{
  code: "ABC123",
  hostId: "user_abc",
  videoId: "dQw4w9WgXcQ",     // Current video
  status: "playing",          // "playing" or "paused"
  position: 45.2,             // Position when last updated (seconds)
  updatedAt: 1634567890123,   // Server timestamp (ms)
  version: 7,                 // Increments on every state change
  users: Map(),               // Connected users
  playlist: [],
  polls: [],
  chat: []
}
```

**Why `updatedAt` + `position`?**
- For paused videos: `position` is the exact position
- For playing videos: actual position = `position + elapsed time`
- Elapsed time = `(currentServerTime - updatedAt) / 1000`

#### Step 2: Clock Offset Estimation

Client and server clocks can differ by seconds. We need synchronized time for drift detection.

**Ping/Pong Protocol:**
```javascript
// Client sends ping
clientSendTime = Date.now()
socket.emit('ping')

// Server immediately responds
socket.on('ping', () => {
  socket.emit('pong', { serverTime: Date.now() })
})

// Client measures round-trip and calculates offset
socket.on('pong', ({ serverTime }) => {
  clientReceiveTime = Date.now()
  roundTripTime = clientReceiveTime - clientSendTime
  oneWayLatency = roundTripTime / 2
  
  // Server time when pong was sent, adjusted for travel time
  estimatedServerTime = serverTime + oneWayLatency
  clockOffset = estimatedServerTime - clientReceiveTime
})
```

**Sampling Strategy:**
- Take 5 samples on initial connect
- Use the sample with **lowest RTT** (least network jitter)
- Store offset: `serverTime = Date.now() + clockOffset`

#### Step 3: Client-Side Sync Loop

Every 3 seconds while playing, the client:

```javascript
function syncLoop() {
  // 1. Get player's actual position
  const actualPosition = player.getCurrentTime()
  
  // 2. Calculate expected position using server state
  const serverTime = Date.now() + clockOffset
  const elapsed = (serverTime - room.updatedAt) / 1000
  const expectedPosition = room.status === 'paused' 
    ? room.position 
    : room.position + elapsed
  
  // 3. Calculate drift
  const drift = Math.abs(actualPosition - expectedPosition)
  const isBehind = actualPosition < expectedPosition
  
  // 4. Apply correction
  if (drift > 0.5) {
    // Large drift: hard seek
    player.seekTo(expectedPosition, true)
  } else if (drift > 0.2) {
    // Small drift: playback rate nudge
    player.setPlaybackRate(isBehind ? 1.05 : 0.95)
    setTimeout(() => player.setPlaybackRate(1.0), 2000)
  }
  // else: drift < 200ms, no correction needed
}

setInterval(syncLoop, 3000)
```

**Why two correction methods?**
- Hard seek (>500ms): Immediate but causes a visible jump
- Rate nudge (200-500ms): Smooth but takes 2 seconds to converge
- No correction (<200ms): Imperceptible to users

#### Step 4: Version Control for Concurrent Updates

**Problem:** Two users click play at nearly the same time.

**Solution:** Each state has a version number.

```javascript
// Client sends current version with command
socket.emit('play', { 
  code: roomCode, 
  userId: clientId, 
  version: room.version 
})

// Server checks version
if (command.version !== room.version) {
  // Stale update - reject
  socket.emit('error', { message: 'Stale version' })
  socket.emit('room_state', room) // Send latest state
  return
}

// Valid - apply update
room.status = 'playing'
room.position = calculateCurrentPosition(room)
room.updatedAt = Date.now()
room.version++ // Increment

// Broadcast to all
io.to(roomCode).emit('video_update', room)
```

**Result:** Only one command wins, others get re-synced.

#### Step 5: Echo-Loop Prevention

**Problem:** 
1. Server sends "play" update to Client A
2. Client A applies update → YouTube player state changes
3. YouTube fires `onStateChange` event
4. Client A thinks user pressed play → broadcasts to server again
5. **Infinite loop!**

**Solution:** Remote update flag

```javascript
const isRemoteUpdateRef = useRef(false)

// When applying server update
function applyServerUpdate(newState) {
  isRemoteUpdateRef.current = true
  player.playVideo()
  setTimeout(() => {
    isRemoteUpdateRef.current = false
  }, 500) // Clear flag after echo window
}

// When player fires state change
function onPlayerStateChange(event) {
  if (isRemoteUpdateRef.current) {
    // This is an echo from our own remote update - ignore
    return
  }
  
  // This is a real user action - broadcast
  if (event.data === YT.PlayerState.PLAYING) {
    socket.emit('play', { ... })
  }
}
```

**Additional safeguard:** Debounce duplicate commands within 1 second.

## Socket.io Event Reference

### Room Management

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `CREATE_ROOM` | Client → Server | `{userId, userName}` | Create new room |
| `JOIN_ROOM` | Client → Server | `{code, userId, userName}` | Join existing room |
| `LEAVE_ROOM` | Client → Server | `{code, userId}` | Leave room |
| `ROOM_STATE` | Server → Client | `{Room}` | Full room state |
| `USER_JOINED` | Server → Client | `{userId, userName}` | New user joined |
| `USER_LEFT` | Server → Client | `{userId}` | User disconnected |

### Video Control

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `PLAY` | Client → Server | `{code, userId, version}` | Play video |
| `PAUSE` | Client → Server | `{code, userId, version}` | Pause video |
| `SEEK` | Client → Server | `{code, userId, position, version}` | Seek to position |
| `VIDEO_UPDATE` | Server → Client | `{Room}` | Video state changed |

### Clock Sync

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `PING` | Client → Server | - | Request server time |
| `PONG` | Server → Client | `{serverTime}` | Server timestamp |

### Features

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `SEND_MESSAGE` | Client → Server | `{code, userId, userName, text}` | Send chat message |
| `NEW_MESSAGE` | Server → Client | `{userId, userName, text, timestamp}` | New chat message |
| `SEND_REACTION` | Client → Server | `{code, userId, emoji}` | Send emoji reaction |
| `NEW_REACTION` | Server → Client | `{userId, emoji, id}` | New reaction |
| `ADD_TO_PLAYLIST` | Client → Server | `{code, videoId, title, thumbnail}` | Add video to playlist |
| `REMOVE_FROM_PLAYLIST` | Client → Server | `{code, index}` | Remove from playlist |
| `PLAYLIST_UPDATED` | Server → Client | `{playlist}` | Playlist changed |
| `CREATE_POLL` | Client → Server | `{code, question, options}` | Create poll |
| `VOTE_POLL` | Client → Server | `{code, pollId, optionIndex, userId}` | Vote on poll |
| `POLL_UPDATED` | Server → Client | `{polls}` | Poll state changed |
| `TRANSFER_HOST` | Client → Server | `{code, userId, newHostId}` | Transfer host role |
| `HOST_CHANGED` | Server → Client | `{newHostId}` | New host assigned |

### Error Handling

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `ERROR` | Server → Client | `{message}` | Error occurred |

## Failure Handling

### 1. Client Disconnect

**Detection:** Socket.io `disconnect` event

**Server Action:**
```javascript
socket.on('disconnect', () => {
  // Remove user from room
  removeUserFromRoom(roomCode, userId)
  
  // If user was host, auto-assign new host
  if (room.hostId === userId) {
    autoAssignHost(room)
  }
  
  // Notify others
  io.to(roomCode).emit('user_left', { userId })
})
```

**Client Action:**
- Show "Disconnected" banner
- Socket.io auto-reconnects (up to 5 attempts)
- On reconnect, rejoin room automatically

### 2. Client Reconnect

**Client Side:**
```javascript
socket.on('connect', () => {
  // Reconnected - rejoin room
  if (currentRoomCode) {
    socket.emit('join_room', {
      code: currentRoomCode,
      userId: clientId,
      userName: clientName
    })
  }
})
```

**Server Side:**
```javascript
// Check if user already exists in room
const isReconnecting = room.users.has(userId)

if (isReconnecting) {
  // Don't emit USER_JOINED (prevents duplicates)
  socket.emit('room_state', room)
} else {
  // New user - broadcast to all
  io.to(code).emit('user_joined', { userId, userName })
}
```

### 3. Late Join (Mid-Video)

**Scenario:** User joins while video is already playing at 2:30.

**Handling:**
```javascript
// Server sends current state
socket.emit('room_state', room)

// Client calculates current position
const serverTime = Date.now() + clockOffset
const elapsed = (serverTime - room.updatedAt) / 1000
const currentPosition = room.position + elapsed

// Client seeks to current position
player.seekTo(currentPosition, true)
if (room.status === 'playing') {
  player.playVideo()
}
```

**Result:** New user joins in-sync.

### 4. Host Leaves

**Server Logic:**
```javascript
function autoAssignHost(room) {
  if (room.users.size === 0) {
    // No users left - delete room
    deleteRoom(room.code)
    return
  }
  
  // Assign first user as new host
  const [firstUserId] = room.users.keys()
  room.hostId = firstUserId
  
  // Notify all users
  io.to(room.code).emit('host_changed', { 
    newHostId: firstUserId 
  })
}
```

**Client UI:** Shows banner "You are now the host"

### 5. Stale Actions

**Scenario:** User's client falls behind (slow network), sends command with old version.

**Server Response:**
```javascript
if (command.version !== room.version) {
  socket.emit('error', { message: 'State updated by another user' })
  socket.emit('room_state', room) // Send latest
  return
}
```

**Client Handling:**
```javascript
socket.on('error', ({ message }) => {
  console.warn(message)
  // Room state update will arrive next, auto-sync
})
```

### 6. YouTube API Load Failure

**Detection:**
```javascript
function onYouTubeIframeAPIReady() {
  window.YT_READY = true
}

// Timeout fallback
setTimeout(() => {
  if (!window.YT_READY) {
    alert('Failed to load YouTube player. Please refresh.')
  }
}, 10000)
```

### 7. TMDB API Failure

**Handling:**
```javascript
try {
  const response = await fetch(tmdbUrl)
  if (!response.ok) throw new Error('TMDB API error')
  return await response.json()
} catch (error) {
  console.error('TMDB fetch failed:', error)
  return { results: [] } // Return empty results
}
```

**UI:** Shows "Failed to load movies" message.

## Scaling Considerations

### Current Architecture (Development)
- **In-memory state** - Single Node.js process
- **Limits:** One server, ~1000 concurrent connections
- **Room persistence:** Lost on server restart

### Production Scaling Path

#### 1. Redis for Shared State

Replace in-memory Map with Redis:

```javascript
// Before (in-memory)
const rooms = new Map()

// After (Redis)
import Redis from 'ioredis'
const redis = new Redis()

async function getRoom(code) {
  const room = await redis.get(`room:${code}`)
  return JSON.parse(room)
}

async function updateRoom(code, room) {
  await redis.set(`room:${code}`, JSON.stringify(room))
}
```

**Benefits:**
- State persists across restarts
- Multiple servers can share state
- TTL for auto-cleanup of abandoned rooms

#### 2. Socket.io Redis Adapter

Enable cross-server broadcasts:

```javascript
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

const io = new Server(server)

const pubClient = createClient({ host: 'localhost', port: 6379 })
const subClient = pubClient.duplicate()

io.adapter(createAdapter(pubClient, subClient))
```

**How it works:**
- User A on Server 1 sends "play"
- Server 1 publishes to Redis
- Server 2 receives from Redis → broadcasts to its clients
- **Result:** Cross-server synchronization

#### 3. Load Balancer

```
              ┌──────────────┐
              │Load Balancer │
              └───────┬──────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │Server 1 │   │Server 2 │   │Server 3 │
   └────┬────┘   └────┬────┘   └────┬────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
                ┌─────▼─────┐
                │   Redis   │
                └───────────┘
```

**Load balancer config:**
- Sticky sessions (same user → same server)
- WebSocket support (upgrade from HTTP)
- Health checks

#### 4. PostgreSQL for Persistence

For user accounts, room history, analytics:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE,
  created_at TIMESTAMP
);

CREATE TABLE rooms (
  code VARCHAR(6) PRIMARY KEY,
  host_id UUID REFERENCES users(id),
  created_at TIMESTAMP,
  last_active TIMESTAMP
);

CREATE TABLE room_history (
  id UUID PRIMARY KEY,
  room_code VARCHAR(6),
  video_id VARCHAR(20),
  played_at TIMESTAMP
);
```

**Separation:**
- Redis: Real-time state (ephemeral)
- PostgreSQL: Historical data (durable)

#### 5. CDN for Static Assets

- Host React build on Vercel/Netlify
- TMDB images already on CDN
- Reduces server load, improves latency

### Estimated Capacity After Scaling

| Resource | Development | Production (Scaled) |
|----------|-------------|---------------------|
| Concurrent Users | ~100 | ~100,000 |
| Rooms | ~10 | ~10,000 |
| Servers | 1 | 10+ (auto-scaled) |
| Database | None | PostgreSQL cluster |
| Caching | In-memory | Redis cluster |
| Geography | Single region | Multi-region |

## Trade-offs Made

### 1. YouTube vs Custom Player
**Decision:** YouTube IFrame API  
**Why:** 
- ✅ 1 billion+ videos available
- ✅ Built-in DRM, buffering, quality switching
- ✅ Free (no transcoding costs)
- ❌ Ads can desync users
- ❌ Some videos region-blocked

**Alternative:** Custom video.js player with HLS
- ✅ Full control (no ads)
- ❌ Need video hosting ($$$)
- ❌ Need transcoding pipeline
- ❌ 20 hours → not enough time

### 2. In-Memory vs Database
**Decision:** In-memory Map  
**Why:**
- ✅ Simpler code (no schema, migrations)
- ✅ Faster (no network roundtrip)
- ✅ Sufficient for demo (rooms are ephemeral)
- ❌ Lost on restart
- ❌ Can't scale horizontally

**When to switch:** When you need persistence or >1 server.

### 3. TMDB vs YouTube Search
**Decision:** TMDB for browsing, YouTube URL for playback  
**Why:**
- ✅ TMDB has rich metadata (posters, ratings, genres)
- ✅ TMDB → YouTube ID mapping via trailers
- ❌ Not all movies have trailers
- ❌ Extra API call

**Alternative:** Direct YouTube search
- ✅ More videos available
- ❌ No metadata (just titles)
- ❌ Quality varies widely

### 4. Server-Authoritative vs P2P
**Decision:** Server-authoritative state  
**Why:**
- ✅ Simpler than WebRTC signaling
- ✅ Single source of truth (no conflicts)
- ✅ Works behind NATs/firewalls
- ❌ Server becomes bottleneck
- ❌ Server costs

**Alternative:** P2P with WebRTC
- ✅ No server state
- ✅ Lower latency
- ❌ Complex (STUN/TURN servers)
- ❌ NAT traversal issues
- ❌ 20 hours → not realistic

### 5. Polling vs WebSockets
**Decision:** WebSockets (Socket.io)  
**Why:**
- ✅ Real-time (no polling delay)
- ✅ Bidirectional (server can push)
- ✅ Lower bandwidth
- ❌ Requires persistent connection
- ❌ More complex than HTTP

**Alternative:** HTTP polling every 1s
- ✅ Simpler
- ❌ 1s latency (fails P95 requirement)
- ❌ High bandwidth

### 6. Drift Correction: Hard Seek vs Rate Nudge
**Decision:** Hybrid (both, based on drift size)  
**Why:**
- Hard seek (>500ms): Fast correction, visible jump
- Rate nudge (200-500ms): Smooth, gradual correction
- Neither (<200ms): Imperceptible, no action

**Alternative:** Always hard seek
- ✅ Simpler logic
- ❌ Jumpy playback (bad UX)

**Alternative:** Always rate nudge
- ✅ Smooth
- ❌ Too slow for large drifts

### 7. Fuzzy Search vs Exact Match
**Decision:** Fuse.js with threshold 0.3  
**Why:**
- ✅ Handles typos ("intersteller" → "Interstellar")
- ✅ Small library (18KB)
- ❌ Slower than exact match

**When it matters:** User can't remember exact movie title.

### 8. Client-Side Routing vs Server-Side
**Decision:** React Router (client-side)  
**Why:**
- ✅ Instant navigation (no page reload)
- ✅ Works with Vite dev server
- ❌ No SEO (doesn't matter for this app)

## Performance Optimizations

### 1. Clock Sync: Lowest RTT Sample
**Why not average?** Network jitter can inflate RTT. Lowest RTT = least interference, most accurate.

### 2. Sync Loop: 3-Second Interval
**Why not 1s?** Drift accumulates slowly. 3s balances responsiveness vs CPU usage.

### 3. Debounce Duplicate Commands
**Why?** User might spam pause button. Server ignores duplicates within 1s window.

### 4. YouTube Player: Create Once
**Bug fix:** Originally recreated player on every video change → white screen.  
**Fix:** Create once, use `cueVideoById()` to change videos.

### 5. React Refs for Event Handlers
**Bug fix:** Event handlers had stale closures (couldn't see updated state).  
**Fix:** Store handlers in refs, update on every render.

### 6. Version Tracking to Skip Re-Renders
**Bug fix:** Sync loop ran on every render, constantly re-applying state.  
**Fix:** Track `lastAppliedVersionRef`, only apply when version changes.

## Security Considerations

**⚠️ This is a proof-of-concept. Production requires:**

1. **Authentication**
   - Current: localStorage clientId (spoofable)
   - Needed: JWT tokens, OAuth, proper sessions

2. **Input Validation**
   - Current: Minimal validation
   - Needed: Sanitize all user inputs, length limits, SQL injection prevention

3. **Rate Limiting**
   - Current: None
   - Needed: Limit messages/second, poll creation, room creation

4. **HTTPS**
   - Current: HTTP in development
   - Needed: HTTPS in production (required for WebSockets in modern browsers)

5. **CORS**
   - Current: Open to all origins
   - Needed: Whitelist frontend domain

6. **Content Moderation**
   - Current: None
   - Needed: Profanity filter, spam detection, report system

## Tech Stack Choices

| Category | Choice | Why |
|----------|--------|-----|
| Frontend Framework | React 18 | Component-based, large ecosystem, easy to learn |
| Build Tool | Vite | Fast HMR, simple config, modern |
| Styling | Tailwind CSS | Utility-first, no CSS files, responsive helpers |
| Backend | Node.js + Express | JavaScript everywhere, async I/O, mature |
| Real-time | Socket.io | Auto-reconnect, rooms, fallback transports |
| Video | YouTube IFrame API | Billions of videos, free, robust |
| Movie Data | TMDB API | Free tier, rich metadata, official API |
| Search | Fuse.js | Fuzzy matching, small size, zero config |
| State | In-memory Map | Simplest for demo, fast, no dependencies |

## Deployment Guide

### Frontend (Vercel)

**File:** `vercel.json`
```json
{
  "buildCommand": "cd client && npm run build",
  "outputDirectory": "client/dist",
  "env": {
    "VITE_TMDB_API_KEY": "@tmdb-api-key"
  }
}
```

**Steps:**
1. Push to GitHub
2. Import project in Vercel
3. Add environment variable `VITE_TMDB_API_KEY`
4. Deploy

### Backend (Render / Railway)

**File:** `render.yaml`
```yaml
services:
  - type: web
    name: watch-party-server
    env: node
    buildCommand: cd server && npm install
    startCommand: cd server && npm start
    envVars:
      - key: PORT
        value: 3001
      - key: NODE_ENV
        value: production
```

**Steps:**
1. Push to GitHub
2. Create new Web Service in Render
3. Connect GitHub repo
4. Deploy

**Environment Variables:**
- `PORT`: 3001 (or dynamic from platform)
- `CORS_ORIGIN`: Your Vercel frontend URL

### Database (Future)

When you add PostgreSQL:
1. Provision database on Render/Railway
2. Add `DATABASE_URL` to environment
3. Run migrations: `npm run migrate`

When you add Redis:
1. Provision Redis on Upstash/Redis Cloud
2. Add `REDIS_URL` to environment
3. Update `rooms.js` to use Redis

---

**Document Version:** 1.0  
**Last Updated:** October 2026  
**Author:** Sajiv Vaila
