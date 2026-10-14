// Socket.io event handlers
import { EVENTS } from './constants.js';
import * as rooms from './rooms.js';

// Track disconnected users for grace period (10 seconds)
const disconnectedUsers = new Map(); // userId -> { timeout, roomCode }

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Room creation
    socket.on(EVENTS.CREATE_ROOM, ({ userId, userName }) => {
      const room = rooms.createRoom(userId, userName);
      socket.join(room.code);
      socket.emit(EVENTS.ROOM_STATE, serializeRoom(room));
      console.log(`Room created: ${room.code} by ${userName}`);
    });

    // Join existing room
    socket.on(EVENTS.JOIN_ROOM, ({ code, userId, userName }) => {
      const room = rooms.getRoom(code);

      if (!room) {
        socket.emit(EVENTS.ERROR, { message: 'Room not found' });
        return;
      }

      // Clear disconnect timeout if user is reconnecting
      if (disconnectedUsers.has(userId)) {
        clearTimeout(disconnectedUsers.get(userId).timeout);
        disconnectedUsers.delete(userId);
      }

      rooms.addUserToRoom(code, userId, userName);
      socket.join(code);

      // Send current room state to the joining user
      socket.emit(EVENTS.ROOM_STATE, serializeRoom(room));

      // Notify others that a user joined
      socket.to(code).emit(EVENTS.USER_JOINED, {
        user: { id: userId, name: userName }
      });

      console.log(`${userName} joined room ${code}`);
    });

    // Play video
    socket.on(EVENTS.PLAY, ({ code, userId, version }) => {
      const room = rooms.getRoom(code);
      if (!room) return;

      const result = rooms.updateVideoState(code, {
        status: 'playing',
        position: calculateCurrentPosition(room)
      }, version);

      if (result.stale) {
        // Send latest state to client with stale version
        socket.emit(EVENTS.ROOM_STATE, serializeRoom(result.room));
        return;
      }

      // Broadcast to all clients in the room
      io.to(code).emit(EVENTS.VIDEO_UPDATE, {
        status: result.room.status,
        position: result.room.position,
        updatedAt: result.room.updatedAt,
        version: result.room.version
      });
    });

    // Pause video
    socket.on(EVENTS.PAUSE, ({ code, userId, position, version }) => {
      const room = rooms.getRoom(code);
      if (!room) return;

      const result = rooms.updateVideoState(code, {
        status: 'paused',
        position
      }, version);

      if (result.stale) {
        socket.emit(EVENTS.ROOM_STATE, serializeRoom(result.room));
        return;
      }

      io.to(code).emit(EVENTS.VIDEO_UPDATE, {
        status: result.room.status,
        position: result.room.position,
        updatedAt: result.room.updatedAt,
        version: result.room.version
      });
    });

    // Seek to position
    socket.on(EVENTS.SEEK, ({ code, userId, position, version }) => {
      const room = rooms.getRoom(code);
      if (!room) return;

      const result = rooms.updateVideoState(code, {
        position
      }, version);

      if (result.stale) {
        socket.emit(EVENTS.ROOM_STATE, serializeRoom(result.room));
        return;
      }

      io.to(code).emit(EVENTS.VIDEO_UPDATE, {
        status: result.room.status,
        position: result.room.position,
        updatedAt: result.room.updatedAt,
        version: result.room.version
      });
    });

    // Clock sync ping/pong
    socket.on(EVENTS.PING, ({ clientTime }) => {
      socket.emit(EVENTS.PONG, {
        clientTime,
        serverTime: Date.now()
      });
    });

    // Chat message
    socket.on(EVENTS.SEND_MESSAGE, ({ code, userId, message }) => {
      if (!message || message.length > 500) {
        socket.emit(EVENTS.ERROR, { message: 'Invalid message' });
        return;
      }

      const chatMessage = rooms.addChatMessage(code, userId, message);
      if (chatMessage) {
        io.to(code).emit(EVENTS.NEW_MESSAGE, chatMessage);
      }
    });

    // Reaction
    socket.on(EVENTS.SEND_REACTION, ({ code, userId, emoji }) => {
      const room = rooms.getRoom(code);
      if (!room) return;

      const user = room.users.get(userId);
      if (!user) return;

      // Broadcast reaction to all in room
      io.to(code).emit(EVENTS.NEW_REACTION, {
        emoji,
        userName: user.name,
        timestamp: Date.now()
      });
    });

    // Playlist management
    socket.on(EVENTS.ADD_TO_PLAYLIST, ({ code, video }) => {
      const playlist = rooms.addToPlaylist(code, video);
      if (playlist) {
        io.to(code).emit(EVENTS.PLAYLIST_UPDATED, playlist);
      }
    });

    socket.on(EVENTS.REMOVE_FROM_PLAYLIST, ({ code, videoId }) => {
      const playlist = rooms.removeFromPlaylist(code, videoId);
      if (playlist) {
        io.to(code).emit(EVENTS.PLAYLIST_UPDATED, playlist);
      }
    });

    socket.on(EVENTS.PLAY_FROM_PLAYLIST, ({ code, videoId, version }) => {
      const room = rooms.getRoom(code);
      if (!room) return;

      const result = rooms.updateVideoState(code, {
        videoId,
        position: 0,
        status: 'paused'
      }, version);

      if (!result.stale) {
        io.to(code).emit(EVENTS.VIDEO_UPDATE, {
          videoId: result.room.videoId,
          status: result.room.status,
          position: result.room.position,
          updatedAt: result.room.updatedAt,
          version: result.room.version
        });
      }
    });

    // Poll management
    socket.on(EVENTS.CREATE_POLL, ({ code, userId, question, options }) => {
      if (!question || !options || options.length < 2) {
        socket.emit(EVENTS.ERROR, { message: 'Invalid poll' });
        return;
      }

      const poll = rooms.createPoll(code, userId, question, options);
      if (poll) {
        io.to(code).emit(EVENTS.POLL_UPDATED, poll);
      }
    });

    socket.on(EVENTS.VOTE_POLL, ({ code, userId, pollId, optionIndex }) => {
      const poll = rooms.votePoll(code, userId, pollId, optionIndex);
      if (poll) {
        io.to(code).emit(EVENTS.POLL_UPDATED, poll);
      }
    });

    // Host transfer
    socket.on(EVENTS.TRANSFER_HOST, ({ code, currentHostId, newHostId }) => {
      const room = rooms.getRoom(code);
      if (!room || room.hostId !== currentHostId) {
        socket.emit(EVENTS.ERROR, { message: 'Only host can transfer host' });
        return;
      }

      const updatedRoom = rooms.transferHost(code, newHostId);
      if (updatedRoom) {
        io.to(code).emit(EVENTS.HOST_CHANGED, { hostId: newHostId });
      }
    });

    // Disconnect with grace period
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      // Find which room this socket was in
      // Note: In production, you'd track socket.id -> { userId, roomCode }
      // For simplicity, we'll handle reconnection via JOIN_ROOM with same userId
    });
  });
}

// Calculate current video position based on state
function calculateCurrentPosition(room) {
  if (room.status === 'paused') {
    return room.position;
  }
  // If playing, calculate position = position + (now - updatedAt)
  const elapsed = (Date.now() - room.updatedAt) / 1000;
  return room.position + elapsed;
}

// Serialize room for sending to client (convert Map to Array)
function serializeRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    videoId: room.videoId,
    status: room.status,
    position: room.position,
    updatedAt: room.updatedAt,
    version: room.version,
    users: Array.from(room.users.values()),
    playlist: room.playlist,
    polls: room.polls.map(p => ({
      ...p,
      votes: p.votes.size // Send vote count, not the Map
    })),
    chat: room.chat
  };
}
