# Watch Party - Interview Preparation Guide

This document contains likely interview questions and detailed answers based on the actual code you wrote. Study this to confidently explain your project.

---

## 1. How does video synchronization work across multiple users?

**Answer:**

The synchronization uses a **server-authoritative** approach where the server is the single source of truth.

**Step-by-step:**

1. **Server stores state:** The server maintains the video position and timestamp when it was last updated. For example:
   ```javascript
   {
     position: 45.2,        // Position in seconds
     updatedAt: 1634567890, // Server timestamp
     status: "playing"      // or "paused"
   }
   ```

2. **Expected position calculation:** Clients calculate where the video *should* be:
   - If paused: `expectedPosition = position`
   - If playing: `expectedPosition = position + (currentTime - updatedAt) / 1000`

3. **Clock synchronization:** Since client and server clocks can differ, we use a ping/pong protocol to measure the clock offset. The client pings the server 5 times, uses the sample with the lowest round-trip time (least network jitter), and calculates: `offset = serverTime - (clientTime + RTT/2)`

4. **Drift detection:** Every 3 seconds, clients compare their actual position vs expected position:
   - If drift > 500ms → hard seek (immediate correction)
   - If drift 200-500ms → playback rate nudge (1.05x or 0.95x for 2 seconds)
   - If drift < 200ms → no correction needed

5. **User actions:** When a user clicks play/pause, the client sends the command to the server along with the current version number. The server validates it, updates the state, increments the version, and broadcasts to all users.

**Key insight:** This ensures everyone sees the same video at the same time, even with different network latencies.

---

## 2. What happens if two users click play at the exact same time?

**Answer:**

This is handled with **version control** to prevent conflicts.

**How it works:**

1. Each room state has a `version` number that increments on every change
2. When a user sends a command (play, pause, seek), they include the current version:
   ```javascript
   socket.emit('play', { code, userId, version: room.version })
   ```

3. The server processes commands sequentially (Socket.io guarantees order)
4. First command arrives:
   - Version matches → accepted
   - State updated, version incremented
   - Broadcast to all users

5. Second command arrives (milliseconds later):
   - Version is now stale (doesn't match)
   - Server rejects it with an error
   - Sends the latest state back to that client
   - Client re-syncs automatically

**Result:** Only one command wins, the other user's client gets updated to the new state. No conflicts, no desyncs.

**Code location:** `server/src/socket.js` lines where version checking happens

---

## 3. How do you handle network lag and ensure low latency?

**Answer:**

We target P95 latency ≤ 250ms through several strategies:

1. **WebSockets (Socket.io):** Bidirectional, persistent connection. No HTTP overhead on every message. Messages are pushed instantly from server to clients.

2. **Server-side broadcasting:** When the host sends a play command, the server immediately broadcasts to all users in that room without any database lookup or complex logic.

3. **Efficient state updates:** We don't send the entire room state on every change, just the video update fields that changed.

4. **Clock offset measurement:** By measuring the clock difference between client and server, we eliminate time-sync errors that would otherwise cause drift.

5. **Optimistic UI:** The client that initiates an action (e.g., pressing pause) applies it immediately to their own player, doesn't wait for server confirmation. This makes it feel instant.

**Testing:** Our load test with 10 concurrent clients measured:
- Average latency: 15-30ms
- P95 latency: 25-45ms
- Well below the 250ms requirement

**Trade-off:** We prioritized WebSocket efficiency over HTTP simplicity. WebSockets require persistent connections, but give us the low latency we need.

---

## 4. What's the hardest bug you fixed in this project?

**Answer:**

The **echo-loop bug** in video synchronization.

**The problem:**
1. Server sends a "play" update to a client
2. Client applies it by calling `player.playVideo()`
3. YouTube IFrame API fires an `onStateChange` event
4. My code thought "the user pressed play" and sent it back to the server
5. Server broadcasts again to all clients
6. **Infinite loop** - video kept restarting

**Why it happened:**
React closures captured stale state. When I set up the event handler, it couldn't see the `isRemoteUpdate` flag that I was setting later.

**The fix:**
1. Use a **ref** instead of state for the `isRemoteUpdate` flag - refs maintain the latest value across renders
2. When applying a remote update, set the flag to `true`
3. Set a timeout to clear it after 500ms (the "echo window")
4. In the `onStateChange` handler, check the ref - if it's true, it's an echo from our own remote update, so ignore it
5. Store the event handlers themselves in refs and update them on every render so they always see the latest flag

**Code:**
```javascript
const isRemoteUpdateRef = useRef(false)

function applyRemoteUpdate(newState) {
  isRemoteUpdateRef.current = true
  if (newState.status === 'playing') player.playVideo()
  setTimeout(() => { isRemoteUpdateRef.current = false }, 500)
}

function onPlayerStateChange(event) {
  if (isRemoteUpdateRef.current) return // Echo - ignore
  // Real user action - broadcast
}
```

**Location:** `client/src/hooks/useSyncedPlayer.js`

**What I learned:** React refs vs state, closure issues in event handlers, and the importance of distinguishing between "user actions" and "programmatic updates."

---

## 5. Why did you choose Socket.io instead of plain WebSockets?

**Answer:**

Socket.io provides several features that plain WebSockets don't have out of the box:

1. **Automatic reconnection:** If the user's WiFi drops for 2 seconds, Socket.io automatically reconnects and resumes. With plain WebSockets, I'd have to implement retry logic myself.

2. **Fallback transports:** If WebSockets are blocked (corporate firewalls, old browsers), Socket.io falls back to HTTP long-polling. Plain WebSockets just fail.

3. **Room management:** Socket.io has built-in "rooms" - I can do `io.to(roomCode).emit('play')` to broadcast to everyone in that room. With plain WebSockets, I'd need to track which sockets belong to which rooms manually.

4. **Event-based API:** Socket.io lets me define named events (`play`, `pause`, `seek`) instead of manually parsing message types from WebSocket data frames.

5. **Cross-browser compatibility:** Socket.io handles browser quirks and older browsers. Plain WebSockets require polyfills.

**Trade-off:** Socket.io is slightly heavier (adds ~30KB to bundle) but the development speed and reliability are worth it for a 20-hour project.

**When to use plain WebSockets:** When you need absolute minimal overhead (e.g., high-frequency game state at 60Hz) or you're building a very simple system where you control both ends.

---

## 6. How would you scale this to 10,000+ concurrent users?

**Answer:**

The current architecture uses in-memory state on a single Node.js server. Here's the scaling path:

**Step 1: Redis for shared state**
- Replace the in-memory `Map` with Redis
- Multiple Node.js servers can read/write the same room state
- Rooms persist across server restarts
- Example: `await redis.set('room:ABC123', JSON.stringify(room))`

**Step 2: Socket.io Redis Adapter**
- When Server 1 receives a "play" command, it publishes to a Redis pub/sub channel
- Server 2, 3, 4... subscribe to that channel and broadcast to their connected clients
- This enables cross-server synchronization

**Step 3: Load balancer**
- Distribute incoming WebSocket connections across multiple servers
- Use sticky sessions (same user always goes to same server)
- Health checks to remove failed servers

**Step 4: Horizontal scaling**
- Deploy to Kubernetes or AWS ECS with auto-scaling
- Spin up more server instances based on CPU/memory usage
- Each server handles ~1000 connections

**Step 5: PostgreSQL for persistence**
- Store user accounts, room history, analytics
- Redis handles real-time state, PostgreSQL handles durable data
- Separate concerns: ephemeral vs permanent

**Step 6: CDN for frontend**
- Host React build on Vercel/Cloudflare
- Reduces server load, improves global latency
- TMDB images already on CDN

**Architecture:**
```
Load Balancer
    ↓
[Server1] [Server2] [Server3] ... ← Socket.io Redis Adapter
    ↓
Redis Cluster (shared state)
    ↓
PostgreSQL (historical data)
```

**Estimated capacity:** 10,000 users = ~10 servers with 1,000 connections each

**Cost estimate:** ~$200-300/month (Redis + PostgreSQL + hosting)

---

## 7. What's the purpose of the version number in the room state?

**Answer:**

The version number prevents **stale updates** and **concurrent modification conflicts**.

**Example scenario:**
1. Room is at version 5, video is paused at 1:30
2. User A's client is on a slow network
3. User B clicks play → server updates to version 6, video playing
4. 2 seconds later, User A's delayed "pause" command arrives with version 5
5. Without version checking, the server would pause the video even though it's stale

**With version checking:**
- User A's command has version 5
- Server is at version 6
- Server rejects: "Sorry, state has been updated by someone else"
- Server sends latest state (version 6) back to User A
- User A's client re-syncs to the playing state

**Code pattern:**
```javascript
if (command.version !== room.version) {
  socket.emit('error', { message: 'Stale version' })
  socket.emit('room_state', room)
  return
}
// Valid - apply update
room.version++
```

**Why increment on every change:** Even small changes (chat message, reaction) bump the version. This ensures version numbers strictly increase and stale detection works.

**Location:** `server/src/rooms.js` (version field) and `server/src/socket.js` (version checking)

---

## 8. How does the clock offset calculation work?

**Answer:**

Client and server clocks can be off by seconds (bad system time, timezone issues). We need synchronized time for accurate drift detection.

**Ping/Pong Protocol:**

1. **Client records time and sends ping:**
   ```javascript
   const t1 = Date.now()
   socket.emit('ping')
   ```

2. **Server immediately responds with its current time:**
   ```javascript
   socket.on('ping', () => {
     socket.emit('pong', { serverTime: Date.now() })
   })
   ```

3. **Client receives pong and calculates offset:**
   ```javascript
   socket.on('pong', ({ serverTime }) => {
     const t2 = Date.now()
     const rtt = t2 - t1  // Round-trip time
     const oneWayLatency = rtt / 2
     
     // Server's time when it sent pong + travel time to reach us
     const estimatedServerTime = serverTime + oneWayLatency
     const offset = estimatedServerTime - t2
     
     samples.push({ offset, rtt })
   })
   ```

4. **Take 5 samples, use the one with lowest RTT:**
   - Network jitter causes variable latency
   - The sample with minimum RTT has least interference
   - That's the most accurate measurement

5. **Apply offset to all time calculations:**
   ```javascript
   const serverTime = Date.now() + clockOffset
   ```

**Example:**
- Client time: 3:00:00 PM
- Server time: 3:00:05 PM
- Offset: +5000ms
- When client calculates drift, it uses server time (3:00:05), not its own clock

**Location:** `client/src/hooks/useClockOffset.js`

**Similar to:** NTP (Network Time Protocol) but much simpler

---

## 9. Why no database? What are the limitations?

**Answer:**

**Decision:** In-memory Map for all room state

**Reasons:**
1. **Time constraint:** 20 hours total for the entire project
2. **Simplicity:** No schema design, migrations, ORM setup
3. **Speed:** No network round-trip to database on every action
4. **Scope:** Rooms are ephemeral (watch parties are temporary)

**Limitations:**

1. **Lost on restart:** If the server crashes or restarts, all active rooms are gone. Users have to create new rooms.

2. **Single server only:** Can't scale horizontally because each server has its own memory. Room ABC123 on Server 1 is invisible to Server 2.

3. **Memory leak risk:** If rooms aren't cleaned up (user forgets to leave), they stay in memory forever. Should implement TTL cleanup.

4. **No persistence:** Can't show "Recently watched" or "Watch history" features.

5. **No user accounts:** Can't save playlists, favorite movies, or preferences.

**When to add a database:**
- **Redis:** When you need >1 server or want rooms to survive restarts
- **PostgreSQL:** When you need user accounts, watch history, analytics

**Migration path:**
```javascript
// Before (in-memory)
const room = rooms.get(code)

// After (Redis)
const room = JSON.parse(await redis.get(`room:${code}`))
```

**Why this was okay:** For a demo/selection task, in-memory is fine. Interviewers care more about understanding the trade-offs than having a production-ready database layer.

---

## 10. Walk me through what happens when a user clicks the pause button

**Answer:**

Here's the complete flow from button click to all users pausing:

**1. User clicks pause button** (`Room.jsx`)
```javascript
<button onClick={() => sendPause()}>Pause</button>
```

**2. Client sends pause command** (`useRoomSocket.js`)
```javascript
function sendPause() {
  socket.emit('pause', {
    code: roomCode,
    userId: clientId,
    version: room.version
  })
}
```

**3. Server receives pause event** (`server/src/socket.js`)
```javascript
socket.on('pause', ({ code, userId, version }) => {
  const room = getRoom(code)
  
  // Validate version
  if (version !== room.version) {
    socket.emit('error', { message: 'Stale version' })
    return
  }
  
  // Update state
  room.status = 'paused'
  room.position = calculateCurrentPosition(room) // Freeze position
  room.updatedAt = Date.now()
  room.version++
  
  // Broadcast to all users in room
  io.to(code).emit('video_update', room)
})
```

**4. All clients receive video_update** (`useRoomSocket.js`)
```javascript
socket.on('video_update', (updatedRoom) => {
  setRoom(updatedRoom)
})
```

**5. React re-renders with new room state** (`useSyncedPlayer.js`)
```javascript
useEffect(() => {
  if (room.version === lastAppliedVersionRef.current) return // Already applied
  
  lastAppliedVersionRef.current = room.version
  isRemoteUpdateRef.current = true
  
  if (room.status === 'paused') {
    player.pauseVideo()
    player.seekTo(room.position, true)
  }
  
  setTimeout(() => {
    isRemoteUpdateRef.current = false
  }, 500)
}, [room.version])
```

**6. YouTube player pauses**

**7. YouTube fires onStateChange event**
```javascript
function onPlayerStateChange(event) {
  if (isRemoteUpdateRef.current) return // This is our own update - ignore
  
  // This would be a user action - but we just paused, so nothing to do
}
```

**Total time:** Typically 15-30ms from click to all users seeing pause

**Key elements:**
- Version validation prevents stale updates
- Server calculates and freezes position
- Echo-loop prevention via isRemoteUpdateRef
- Broadcast pattern ensures everyone gets update

---

## 11. What would you add if you had more time?

**Answer:**

**High priority (next 10 hours):**

1. **User authentication** (3 hours)
   - Firebase Auth or JWT tokens
   - Persistent user profiles
   - Avatar uploads

2. **Room persistence** (2 hours)
   - Redis for room state
   - Resume rooms after server restart
   - TTL cleanup for abandoned rooms

3. **YouTube search integration** (2 hours)
   - Search YouTube directly from the app
   - Not just TMDB trailers
   - More content variety

4. **Enhanced chat** (2 hours)
   - User mentions (@username)
   - Timestamps shown in chat
   - Typing indicators
   - Message history (last 50 messages)

5. **Watch history** (1 hour)
   - PostgreSQL for storage
   - "Continue watching" feature
   - Analytics dashboard

**Medium priority (nice to have):**

1. **Screen sharing mode** - Share your screen instead of YouTube
2. **Private rooms** - Password-protected rooms
3. **Invite system** - Email invites with room links
4. **Mobile app** - React Native version
5. **Themes** - Dark/light mode toggle
6. **Subtitle sync** - Turn on captions for everyone
7. **Volume sync** - Control volume for the group
8. **Reactions overlay** - Reactions appear as overlay on video

**Low priority (if this were a startup):**

1. **Monetization** - Premium rooms, ad-free
2. **Social features** - Friends list, follow users
3. **Content partnerships** - Licensed content, not just YouTube
4. **Analytics** - Watch time, popular movies, engagement metrics
5. **Moderation** - Report users, block, admin controls

**The 80/20 rule:** The current feature set covers 80% of the core value. The remaining 20% of features would take 80% more time.

---

## 12. How did you test this application?

**Answer:**

I used **three types of testing**:

**1. Manual Testing (during development)**
- Opened two browser tabs side-by-side
- Created a room in tab 1, joined from tab 2
- Tested play/pause sync, seeking, drift correction
- Tested all features: chat, reactions, polls, playlist
- Used DevTools network tab to inspect WebSocket messages
- Simulated network issues with DevTools throttling

**2. Load Testing (automated)**
- Created `scripts/loadtest.js` with Socket.io client library
- Spawned 10 simulated clients
- Measured play/pause propagation latency
- Calculated average, min, max, P95 latency
- **Results:** P95 = 25-45ms (well below 250ms requirement)
- **Command:** `cd scripts && npm run loadtest`

**3. Edge Case Testing**
- User joins mid-video (late join)
- Host leaves room (auto-assign new host)
- Network disconnect/reconnect
- Two users click play simultaneously (version conflict)
- Invalid room codes
- Empty playlist edge cases
- Extremely long chat messages

**What I didn't test (due to time):**
- Unit tests (Jest/Vitest)
- Integration tests (Testing Library)
- E2E tests (Playwright/Cypress)
- Cross-browser testing (only tested in Chrome)
- Mobile responsiveness (only tested on desktop)

**If I had more time:** Write unit tests for sync algorithm, integration tests for Socket.io handlers, and E2E tests for critical user flows.

**Testing location:** `scripts/loadtest.js` for automated tests

---

## 13. Explain the difference between `position` and `expectedPosition`

**Answer:**

**`position`** (stored on server):
- The video position **at the moment of last update**
- Frozen in time
- Example: Video was at 45.2 seconds when user pressed pause

**`updatedAt`** (stored on server):
- Server timestamp when `position` was recorded
- Example: 1634567890123 (milliseconds)

**`expectedPosition`** (calculated on client):
- Where the video **should be right now**
- Depends on whether video is playing or paused

**Calculation:**
```javascript
if (room.status === 'paused') {
  // Video isn't moving - position stays the same
  expectedPosition = room.position
} else if (room.status === 'playing') {
  // Video is moving - calculate how far it should have progressed
  const serverTime = Date.now() + clockOffset
  const elapsedSeconds = (serverTime - room.updatedAt) / 1000
  expectedPosition = room.position + elapsedSeconds
}
```

**Example scenario:**
- Server state: `{ position: 100, updatedAt: 12:00:00, status: 'playing' }`
- Current time: 12:00:05 (5 seconds later)
- Elapsed: 5 seconds
- Expected position: 100 + 5 = 105 seconds

**Why we need both:**
- Server can't broadcast position every millisecond (too much bandwidth)
- Instead, server broadcasts position + timestamp once
- Clients extrapolate where video should be based on elapsed time
- Every 3 seconds, client checks: "Am I at expected position?"
- If not → drift correction

**This pattern is common in multiplayer games** - server sends position + velocity, client predicts where object should be.

---

## 14. What security vulnerabilities exist in this code?

**Answer:**

**⚠️ This is a proof-of-concept. Multiple security issues exist:**

**1. No Authentication**
- **Issue:** Users can impersonate others by changing `localStorage` clientId
- **Attack:** User joins as "host" ID, takes over room controls
- **Fix:** JWT tokens, verify identity on server

**2. No Input Validation**
- **Issue:** Chat messages, poll questions, usernames not sanitized
- **Attack:** XSS via `<script>alert('xss')</script>` in chat
- **Fix:** Sanitize HTML, use `textContent` instead of `innerHTML`, length limits

**3. No Rate Limiting**
- **Issue:** User can spam 1000 messages/second
- **Attack:** DoS the server, flood chat
- **Fix:** Rate limit per user (e.g., 10 messages/minute)

**4. Open CORS**
- **Issue:** `cors({ origin: '*' })` allows any website to connect
- **Attack:** Malicious site can connect and disrupt rooms
- **Fix:** Whitelist frontend domain only

**5. No HTTPS**
- **Issue:** WebSocket traffic sent in plaintext
- **Attack:** Man-in-the-middle can read messages
- **Fix:** Use HTTPS + WSS in production

**6. Room Code Guessing**
- **Issue:** 6-character codes = 36^6 = 2 billion combinations, but still brute-forceable
- **Attack:** Scan for active rooms, join without permission
- **Fix:** Longer codes, passwords, or invite-only links

**7. No Content Moderation**
- **Issue:** Users can send offensive content
- **Fix:** Profanity filter, report system, admin controls

**8. Memory Leak**
- **Issue:** Abandoned rooms never cleaned up
- **Attack:** Create 10,000 rooms, exhaust server memory
- **Fix:** TTL cleanup (delete rooms inactive >1 hour)

**9. No SQL Injection Protection**
- **Currently not vulnerable** (no database)
- **Future risk:** When adding PostgreSQL, must use parameterized queries

**10. Hardcoded Secrets**
- **Issue:** TMDB API key in client code (visible to users)
- **Acceptable for TMDB** (read-only, low-value)
- **NOT acceptable for** payment APIs, private data
- **Fix:** Proxy TMDB requests through backend

**Why these exist:** 20-hour time constraint, proof-of-concept scope. In an interview, acknowledging security issues shows awareness.

---

## 15. Why did you choose React over other frameworks?

**Answer:**

I considered React, Vue, and vanilla JavaScript:

**Why React:**

1. **Component model** - Natural fit for this app (VideoPlayer, Chat, Polls are discrete components)
2. **Hooks** - Perfect for socket state (`useRoomSocket`), player sync (`useSyncedPlayer`)
3. **Large ecosystem** - Easy to find help, libraries, examples
4. **My familiarity** - I can build faster in React than Vue (time constraint)
5. **Industry standard** - Most relevant for job applications

**Trade-offs:**

**React vs Vue:**
- Vue: Simpler for beginners, less boilerplate
- React: More jobs, larger community
- **Decision:** React for career relevance

**React vs Vanilla JS:**
- Vanilla: Lighter bundle, faster initial load
- React: Cleaner code, easier to maintain
- **Decision:** React for code organization

**React vs Next.js:**
- Next.js: SSR, routing, API routes
- **Why I didn't use it:** Vite is faster for dev server, no SEO needs, simpler setup

**React vs Svelte:**
- Svelte: Smaller bundle, faster runtime
- React: More mature, better for complex state
- **Decision:** React for stability

**Why not Angular:** Too heavy, steeper learning curve, overkill for 20-hour project

**Key insight:** Framework choice matters less than code quality. The interviewer cares more about how you structure components, handle state, and solve sync problems than which framework you picked.

---

## General Tips for the Interview

1. **Start with the big picture:** "It's a real-time watch party app where users can watch YouTube videos together..."

2. **Use the whiteboard:** Draw the architecture (client ↔ server ↔ YouTube API)

3. **Mention trade-offs:** "I chose X over Y because... but in production I'd use..."

4. **Show the code:** Open your laptop, run `npm start`, demonstrate features

5. **Know your numbers:** P95 latency 25-45ms, 10 concurrent users tested, 20 hours total

6. **Be honest about limitations:** "No authentication because of time, but here's how I'd add it..."

7. **Show passion:** "The hardest part was the echo-loop bug - here's how I debugged it..."

8. **Link to learning:** "This taught me about WebSockets, clock sync, and React refs"

9. **Have next steps ready:** "If I had 10 more hours, I'd add X, Y, Z"

10. **Practice explaining:** Say each answer out loud before the interview

---

**Good luck! 🚀**
