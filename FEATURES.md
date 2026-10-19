# Complete Feature Guide - Watch Party

## 📍 Where Every Feature Is Located

---

## 1️⃣ ROOM CREATION & JOINING

### Where to find it:
- **UI Component:** `client/src/components/Lobby.jsx`
- **Backend Logic:** `server/src/rooms.js` (createRoom, addUserToRoom)
- **Socket Events:** `server/src/socket.js` (CREATE_ROOM, JOIN_ROOM handlers)

### How to use:
1. Open http://localhost:5173
2. Enter your name (e.g., "Alice")
3. Click **"Create New Room"** → generates 6-character code (e.g., "XYZ789")
4. Share code with friends OR copy invite link
5. Friends paste code and click **"Join Room"**

### Code highlights:
```javascript
// Lobby.jsx - Creating a room
const handleCreateRoom = () => {
  const code = generateRoomCode() // 6 random characters
  socket.emit('create_room', { userId: clientId, userName: clientName })
}
```

---

## 2️⃣ VIDEO PLAYBACK & SYNC

### Where to find it:
- **UI Component:** `client/src/components/VideoPlayer.jsx`
- **Sync Logic:** `client/src/hooks/useSyncedPlayer.js`
- **Backend State:** `server/src/rooms.js` (updateVideoState)
- **Socket Events:** `server/src/socket.js` (PLAY, PAUSE, SEEK handlers)

### How to use:

**Option A: Paste YouTube URL**
1. In the room, find "YouTube URL" input box
2. Paste: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
3. Click **"Load Video"**
4. Video appears for everyone

**Option B: Browse Movies** (see Feature #4)

**Controls (Host & Participants can use):**
- ▶️ **Play** - Plays for everyone
- ⏸️ **Pause** - Pauses for everyone
- **Seek bar** - Drag to seek, syncs for everyone

### Code highlights:
```javascript
// useSyncedPlayer.js - Drift correction
if (drift > 0.5) {
  player.seekTo(expectedPosition, true) // Hard seek
} else if (drift > 0.2) {
  player.setPlaybackRate(isBehind ? 1.05 : 0.95) // Rate nudge
}
```

### What happens behind the scenes:
1. You click Play → sends to server with version number
2. Server validates, updates state, increments version
3. Server broadcasts to all users in room
4. Everyone's player receives update and plays
5. Drift correction runs every 3 seconds to keep in sync

---

## 3️⃣ CLOCK SYNCHRONIZATION

### Where to find it:
- **Hook:** `client/src/hooks/useClockOffset.js`
- **Backend:** `server/src/socket.js` (PING/PONG handlers)

### How it works (automatic):
1. When you join a room, client pings server 5 times
2. Measures round-trip time (RTT)
3. Uses lowest RTT sample (least network jitter)
4. Calculates clock offset between client and server
5. All time calculations use this offset

### You don't use this manually - it's automatic!

### Code highlights:
```javascript
// useClockOffset.js
const offset = serverTime - (clientReceiveTime + oneWayLatency)
// Now: const syncedServerTime = Date.now() + clockOffset
```

---

## 4️⃣ MOVIE DISCOVERY (TMDB)

### Where to find it:
- **UI Component:** `client/src/components/MovieBrowser.jsx`
- **API Helper:** `client/src/utils/tmdb.js`
- **Environment:** `client/.env` (VITE_TMDB_API_KEY)

### How to use:
1. In the room, look at **right sidebar**
2. See 4 tabs:
   - **Popular** - Currently popular movies
   - **Top Rated** - Highest rated all-time
   - **Now Playing** - In theaters now
   - **Search** - Search by name

3. Click any movie poster
4. If it has a trailer → loads and plays for everyone
5. If no trailer → shows "No trailer available"

### Search feature:
1. Click **"Search"** tab
2. Type movie name (e.g., "Interstellar")
3. **Fuzzy search** handles typos (e.g., "intersteller" still works)
4. Click movie to load trailer

### Code highlights:
```javascript
// tmdb.js - Fetching popular movies
export async function getPopularMovies() {
  const url = `${BASE_URL}/movie/popular?api_key=${API_KEY}`
  const response = await fetch(url)
  return response.json()
}
```

---

## 5️⃣ LIVE CHAT

### Where to find it:
- **UI Component:** `client/src/components/Chat.jsx`
- **Backend:** `server/src/socket.js` (SEND_MESSAGE handler)
- **State:** `server/src/rooms.js` (room.chat array)

### How to use:
1. Look at **left column**, below the video
2. Find the **"Chat"** section
3. Type message (max 500 characters)
4. Press Enter or click **"Send"**
5. Message appears for everyone with username and timestamp

### Features:
- Real-time (instant delivery)
- Shows username (e.g., "Alice: Hello!")
- Shows time (e.g., "14:30")
- Auto-scrolls to latest message
- Message history preserved while room active

### Code highlights:
```javascript
// Chat.jsx - Sending message
const handleSend = () => {
  socket.emit('send_message', {
    code: roomCode,
    userId: clientId,
    userName: clientName,
    text: message
  })
}
```

---

## 6️⃣ EMOJI REACTIONS

### Where to find it:
- **UI Component:** `client/src/components/Reactions.jsx`
- **Backend:** `server/src/socket.js` (SEND_REACTION handler)

### How to use:
1. Look **below the video player**
2. See 6 emoji buttons:
   - 👍 Thumbs up
   - ❤️ Heart
   - 😂 Laughing
   - 😮 Surprised
   - 🎉 Party
   - 🔥 Fire

3. Click any emoji
4. **Everyone sees it** float up over the video!
5. Emoji animates upward and fades out (3 seconds)

### Code highlights:
```javascript
// Reactions.jsx - Animation
@keyframes floatUp {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-200px); opacity: 0; }
}
```

---

## 7️⃣ SHARED PLAYLIST

### Where to find it:
- **UI Component:** `client/src/components/Playlist.jsx`
- **Backend:** `server/src/socket.js` (ADD_TO_PLAYLIST, REMOVE_FROM_PLAYLIST)
- **State:** `server/src/rooms.js` (room.playlist array)

### How to use:

**Adding to playlist:**
1. Browse movies in right sidebar
2. Click **"Add to Playlist"** button on any movie
3. Movie added to shared playlist

**Using playlist:**
1. Look at **left column**, below chat
2. See **"Playlist"** section
3. Current playing video is **highlighted in blue**
4. Click **Play** button on any video → loads and plays for everyone
5. Click **Remove** button → removes from playlist

**Auto-advance:**
- When current video ends, next video in playlist auto-plays!

### Code highlights:
```javascript
// Playlist.jsx - Playing from playlist
const handlePlay = (video) => {
  socket.emit('seek', {
    code: roomCode,
    userId: clientId,
    position: 0,
    version: room.version
  })
  // Change video...
}
```

---

## 8️⃣ GROUP POLLS

### Where to find it:
- **UI Component:** `client/src/components/Polls.jsx`
- **Backend:** `server/src/socket.js` (CREATE_POLL, VOTE_POLL handlers)
- **State:** `server/src/rooms.js` (room.polls array)

### How to use:

**Creating a poll (Host only):**
1. Look at **right sidebar**, bottom section
2. See **"Polls"** tab
3. Click **"Create Poll"** button
4. Enter question (e.g., "Which movie next?")
5. Enter 2-4 options (e.g., "Inception", "Interstellar", "The Matrix")
6. Click **"Create"**

**Voting (Everyone):**
1. See poll appear in Polls section
2. Click on your choice
3. **You can vote once per poll**
4. See live results with percentage bars
5. Results update in real-time as people vote

### Features:
- **Live results** - see votes as they come in
- **Percentage bars** - visual representation
- **One vote per user** - can't vote twice
- **Multiple polls** - create as many as needed

### Code highlights:
```javascript
// Polls.jsx - Voting
const handleVote = (pollId, optionIndex) => {
  socket.emit('vote_poll', {
    code: roomCode,
    pollId,
    optionIndex,
    userId: clientId
  })
}
```

---

## 9️⃣ HOST TRANSFER

### Where to find it:
- **UI Component:** `client/src/components/Room.jsx` (Participants section)
- **Backend:** `server/src/socket.js` (TRANSFER_HOST handler)
- **Logic:** `server/src/rooms.js` (transferHost, autoAssignHost)

### How to use:

**Host transferring control:**
1. Look at **right sidebar** → **"Participants"** section
2. As host, you see **"👑 You (Host)"**
3. Other users have **"Transfer Host"** button next to their name
4. Click **"Transfer Host"** next to someone
5. They become the new host immediately

**What host can do:**
- Create polls
- Transfer host role
- Same video controls as everyone else (play/pause/seek)

**Auto-assign:**
- If host leaves, first remaining user becomes host automatically

### Code highlights:
```javascript
// Room.jsx - Transfer host
const handleTransferHost = (newHostId) => {
  socket.emit('transfer_host', {
    code: roomCode,
    userId: clientId,
    newHostId
  })
}
```

---

## 🔟 CONNECTION STATUS

### Where to find it:
- **UI Component:** `client/src/components/ConnectionStatus.jsx`
- **Hook:** `client/src/hooks/useConnectionStatus.js`

### How it works (automatic):
1. **Connected** - No banner shown
2. **Disconnected** - Red banner: "✗ Disconnected from server"
3. **Reconnecting** - Yellow banner: "⚠️ Reconnecting to server..."

### You don't control this - it's automatic!

**What triggers it:**
- WiFi drops
- Server restarts
- Network issues

**Socket.io auto-reconnects:**
- Tries up to 5 times
- 1 second between attempts
- Rejoins room automatically

---

## 1️⃣1️⃣ PARTICIPANTS LIST

### Where to find it:
- **UI Component:** `client/src/components/Room.jsx` (right sidebar)
- **Backend:** `server/src/socket.js` (USER_JOINED, USER_LEFT events)

### How to use:
1. Look at **right sidebar** → **"Participants"** section
2. See everyone in the room:
   - **"👑 Alice (Host)"** - Host has crown
   - **"Bob"** - Regular participant
   - **"Charlie"** - Another participant

### Features:
- Real-time updates when people join/leave
- Shows who is host
- Shows total count (e.g., "3 users")
- Host can transfer host role from here

---

## File Structure Summary

```
client/src/components/
├── Lobby.jsx              → Room creation/join screen
├── Room.jsx               → Main room layout & participants
├── VideoPlayer.jsx        → YouTube player
├── Chat.jsx               → Live chat
├── Reactions.jsx          → Emoji reactions
├── Playlist.jsx           → Shared playlist
├── Polls.jsx              → Group polls
├── MovieBrowser.jsx       → TMDB movie discovery
└── ConnectionStatus.jsx   → Connection indicator

client/src/hooks/
├── useRoomSocket.js       → Socket event management
├── useSyncedPlayer.js     → Video sync & drift correction
├── useClockOffset.js      → Clock synchronization
└── useConnectionStatus.js → Connection tracking

client/src/utils/
├── constants.js           → Socket event names
└── tmdb.js               → TMDB API helpers

server/src/
├── index.js              → Express + Socket.io setup
├── rooms.js              → Room state management
├── socket.js             → All socket event handlers
└── constants.js          → Socket event names
```

---

## Testing Each Feature

### 1. Video Sync Test
- Open 2 tabs
- Load video in one
- Play in tab 1 → check tab 2 plays
- Pause in tab 2 → check tab 1 pauses
- Seek in tab 1 → check tab 2 follows

### 2. Chat Test
- Send message from tab 1
- Check it appears in tab 2 instantly
- Check timestamp is correct
- Check username is shown

### 3. Reactions Test
- Click 👍 in tab 1
- Check emoji floats up in both tabs
- Try all 6 emojis

### 4. Playlist Test
- Add 3 movies from browser
- Check they appear in both tabs
- Click play on second movie
- Check it loads in both tabs
- Let a video end → check next auto-plays

### 5. Polls Test
- Create poll in tab 1 (as host)
- Check it appears in tab 2
- Vote from tab 2
- Check results update in tab 1

### 6. Host Transfer Test
- Transfer host from tab 1 to tab 2
- Check tab 2 now shows "You (Host)"
- Check tab 2 can now create polls

### 7. Reconnect Test
- Kill server (Ctrl+C in server terminal)
- Check red "Disconnected" banner appears
- Restart server (`npm start`)
- Check yellow "Reconnecting" banner
- Check green connection restored

### 8. Movie Discovery Test
- Click "Popular" tab → check movies load
- Click "Search" tab → search "Avatar"
- Check fuzzy search: try "avtar" (typo)
- Click a movie → check trailer loads

---

## Load Test (Performance)

```bash
cd scripts
npm run loadtest
```

**What it tests:**
- 10 simulated clients
- Play/pause propagation latency
- P95 latency < 250ms

**Expected output:**
```
✓ All 10 clients connected
📡 Measuring play/pause latency...
📊 RESULTS:
Average latency:    25ms
P95 latency:        45ms
✅ PASS: P95 latency <= 250ms
```

---

## Common Issues & Solutions

### Issue: "Video won't load"
**Solution:** Check YouTube URL format
- ✅ Correct: `https://www.youtube.com/watch?v=VIDEO_ID`
- ❌ Wrong: `https://youtu.be/VIDEO_ID`
- ❌ Wrong: Just the video ID

### Issue: "Movies not showing"
**Solution:** Check TMDB API key
```bash
cd client
cat .env
# Should show: VITE_TMDB_API_KEY=a291d823d6862e8a45d7280168bf4f9e
```

### Issue: "Can't pause video"
**Solution:** This was the echo-loop bug (already fixed!)
- Make sure you're on latest code
- Refresh both tabs

### Issue: "Duplicate users in participants"
**Solution:** Already fixed! Server checks for reconnecting users

### Issue: "Out of sync after a while"
**Solution:** Drift correction runs every 3 seconds automatically
- Should fix itself within 3 seconds
- If not, try refreshing

---

## For Your Interview

**Demo this flow:**
1. Start server & client
2. Open 2 tabs side-by-side
3. Create room in tab 1, join in tab 2
4. Load a video
5. **Show sync:** Play in tab 1, pause in tab 2
6. **Show chat:** Send messages back and forth
7. **Show reactions:** Click different emojis
8. **Show polls:** Create poll, vote from both tabs
9. **Show playlist:** Add movies, play from queue
10. **Show discovery:** Search movie, load trailer

**Explain while demoing:**
- "Server is the single source of truth"
- "Version control prevents conflicts"
- "Clock sync ensures accurate drift detection"
- "Drift correction runs every 3 seconds"
- "Echo-loop prevention with refs"

---

**You're ready! 🚀**
