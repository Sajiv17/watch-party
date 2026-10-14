// Room state management
// The server is the single source of truth for all room state

// In-memory storage: Map of roomCode -> room object
// In production, you'd use Redis for multi-server deployments
const rooms = new Map();

// Generate a random 6-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new room
export function createRoom(hostId, hostName) {
  const code = generateRoomCode();

  const room = {
    code,
    hostId,
    // Video state (server is the source of truth)
    videoId: null,
    status: 'paused', // 'playing' or 'paused'
    position: 0, // seconds at the moment of updatedAt
    updatedAt: Date.now(), // server timestamp
    version: 0, // increments on every control action
    // Users in the room
    users: new Map([[hostId, { id: hostId, name: hostName, joinedAt: Date.now() }]]),
    // Shared playlist
    playlist: [],
    // Active polls
    polls: [],
    // Chat messages
    chat: []
  };

  rooms.set(code, room);
  return room;
}

// Get a room by code
export function getRoom(code) {
  return rooms.get(code);
}

// Add a user to a room
export function addUserToRoom(code, userId, userName) {
  const room = rooms.get(code);
  if (!room) return null;

  room.users.set(userId, {
    id: userId,
    name: userName,
    joinedAt: Date.now()
  });

  return room;
}

// Remove a user from a room
export function removeUserFromRoom(code, userId) {
  const room = rooms.get(code);
  if (!room) return null;

  room.users.delete(userId);

  // Delete empty rooms
  if (room.users.size === 0) {
    rooms.delete(code);
    return null;
  }

  return room;
}

// Update video state (play/pause/seek)
// Returns the updated room or null if the version is stale
export function updateVideoState(code, { status, position, videoId }, requestVersion) {
  const room = rooms.get(code);
  if (!room) return null;

  // Reject stale updates (concurrent action protection)
  if (requestVersion !== undefined && requestVersion !== room.version) {
    return { stale: true, room };
  }

  // Update state
  if (status !== undefined) room.status = status;
  if (position !== undefined) room.position = position;
  if (videoId !== undefined) room.videoId = videoId;

  room.updatedAt = Date.now();
  room.version += 1;

  return { stale: false, room };
}

// Transfer host to another user
export function transferHost(code, newHostId) {
  const room = rooms.get(code);
  if (!room) return null;

  // Verify the new host is in the room
  if (!room.users.has(newHostId)) return null;

  room.hostId = newHostId;
  return room;
}

// Auto-assign host to the longest-present user
export function autoAssignHost(code) {
  const room = rooms.get(code);
  if (!room) return null;

  if (room.users.size === 0) return null;

  // Find the user who joined earliest
  let earliestUser = null;
  let earliestTime = Infinity;

  for (const user of room.users.values()) {
    if (user.joinedAt < earliestTime) {
      earliestTime = user.joinedAt;
      earliestUser = user;
    }
  }

  if (earliestUser) {
    room.hostId = earliestUser.id;
  }

  return room;
}

// Add a message to chat
export function addChatMessage(code, userId, message) {
  const room = rooms.get(code);
  if (!room) return null;

  const user = room.users.get(userId);
  if (!user) return null;

  const chatMessage = {
    id: Date.now() + Math.random(), // Simple unique ID
    userId,
    userName: user.name,
    message,
    timestamp: Date.now()
  };

  room.chat.push(chatMessage);

  // Keep only last 100 messages to avoid memory bloat
  if (room.chat.length > 100) {
    room.chat.shift();
  }

  return chatMessage;
}

// Add video to playlist
export function addToPlaylist(code, video) {
  const room = rooms.get(code);
  if (!room) return null;

  room.playlist.push({
    id: Date.now() + Math.random(),
    ...video
  });

  return room.playlist;
}

// Remove video from playlist
export function removeFromPlaylist(code, videoId) {
  const room = rooms.get(code);
  if (!room) return null;

  room.playlist = room.playlist.filter(v => v.id !== videoId);
  return room.playlist;
}

// Create a poll
export function createPoll(code, userId, question, options) {
  const room = rooms.get(code);
  if (!room) return null;

  const user = room.users.get(userId);
  if (!user) return null;

  const poll = {
    id: Date.now() + Math.random(),
    question,
    options: options.map(opt => ({ text: opt, votes: 0 })),
    votes: new Map(), // userId -> optionIndex
    createdBy: user.name,
    createdAt: Date.now()
  };

  room.polls.push(poll);
  return poll;
}

// Vote on a poll
export function votePoll(code, userId, pollId, optionIndex) {
  const room = rooms.get(code);
  if (!room) return null;

  const poll = room.polls.find(p => p.id === pollId);
  if (!poll) return null;

  // Remove previous vote if exists
  const previousVote = poll.votes.get(userId);
  if (previousVote !== undefined) {
    poll.options[previousVote].votes -= 1;
  }

  // Add new vote
  poll.votes.set(userId, optionIndex);
  poll.options[optionIndex].votes += 1;

  return poll;
}

export function getAllRooms() {
  return rooms;
}
