# Quick Start Guide - Watch Party

## Starting the App (2 Terminals Needed)

### Terminal 1: Start Backend Server
```bash
cd /Users/sajivvaila/watch-party/server
npm start
```
**You should see:**
```
Server running on http://localhost:3001
```

### Terminal 2: Start Frontend (React)
```bash
cd /Users/sajivvaila/watch-party/client
npm run dev
```
**You should see:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Open in Browser
1. Go to: **http://localhost:5173**
2. That's it! App is running!

---

## Testing Sync (Most Important!)

### Open 2 Tabs Side-by-Side:

**Tab 1 (Host):**
1. Enter name: "Alice"
2. Click "Create New Room"
3. Copy the room code (e.g., "ABC123")

**Tab 2 (Guest):**
1. Enter name: "Bob"  
2. Paste the room code
3. Click "Join Room"

**Now both tabs are in the same room!**

### Test Video Sync:
1. In Tab 1, paste a YouTube URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
2. Click "Load Video"
3. ✅ Both tabs should show the video
4. In Tab 1, click **Play**
5. ✅ Both tabs should play
6. In Tab 2, click **Pause**  
7. ✅ Both tabs should pause

**If this works, your sync is perfect! 🎉**

---

## Troubleshooting

### Server won't start?
```bash
cd server
rm -rf node_modules package-lock.json
npm install
npm start
```

### Client won't start?
```bash
cd client
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Movies not loading?
Check your `.env` file:
```bash
cd client
cat .env
```
Should show:
```
VITE_TMDB_API_KEY=a291d823d6862e8a45d7280168bf4f9e
```

### Can't connect to server?
Make sure both are running:
```bash
# Check if server is running
curl http://localhost:3001/health

# Check if client is running
curl http://localhost:5173
```
