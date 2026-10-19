import { useEffect, useState } from 'react';
import { EVENTS } from '../utils/constants';

/**
 * Custom hook to manage room Socket.io connection and state
 * Handles all socket events for room updates, video sync, chat, etc.
 */
export function useRoomSocket(socket, roomCode) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!socket || !roomCode) return;

    // Listen for initial room state and updates
    const handleRoomState = (roomData) => {
      setRoom(roomData);
      setError('');
    };

    // Listen for video state updates (play/pause/seek)
    const handleVideoUpdate = (update) => {
      setRoom((prev) => ({
        ...prev,
        videoId: update.videoId !== undefined ? update.videoId : prev.videoId,
        status: update.status,
        position: update.position,
        updatedAt: update.updatedAt,
        version: update.version
      }));
    };

    // Listen for users joining
    const handleUserJoined = ({ user }) => {
      setRoom((prev) => {
        // Check if user already exists (shouldn't happen, but defensive programming)
        const userExists = prev.users.some(u => u.id === user.id);
        if (userExists) {
          return prev; // Don't add duplicate
        }
        return {
          ...prev,
          users: [...prev.users, user]
        };
      });
    };

    // Listen for users leaving
    const handleUserLeft = ({ userId }) => {
      setRoom((prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.id !== userId)
      }));
    };

    // Listen for host changes
    const handleHostChanged = ({ hostId }) => {
      setRoom((prev) => ({
        ...prev,
        hostId
      }));
    };

    // Listen for new chat messages
    const handleNewMessage = (message) => {
      setRoom((prev) => ({
        ...prev,
        chat: [...(prev.chat || []), message]
      }));
    };

    // Listen for playlist updates
    const handlePlaylistUpdated = (playlist) => {
      setRoom((prev) => ({
        ...prev,
        playlist
      }));
    };

    // Listen for poll updates
    const handlePollUpdated = (poll) => {
      setRoom((prev) => {
        const existingIndex = prev.polls?.findIndex(p => p.id === poll.id);
        let newPolls;

        if (existingIndex >= 0) {
          // Update existing poll
          newPolls = [...prev.polls];
          newPolls[existingIndex] = poll;
        } else {
          // Add new poll
          newPolls = [...(prev.polls || []), poll];
        }

        return {
          ...prev,
          polls: newPolls
        };
      });
    };

    // Listen for errors
    const handleError = (err) => {
      setError(err.message || 'An error occurred');
    };

    // Attach event listeners
    socket.on(EVENTS.ROOM_STATE, handleRoomState);
    socket.on(EVENTS.VIDEO_UPDATE, handleVideoUpdate);
    socket.on(EVENTS.USER_JOINED, handleUserJoined);
    socket.on(EVENTS.USER_LEFT, handleUserLeft);
    socket.on(EVENTS.HOST_CHANGED, handleHostChanged);
    socket.on(EVENTS.NEW_MESSAGE, handleNewMessage);
    socket.on(EVENTS.PLAYLIST_UPDATED, handlePlaylistUpdated);
    socket.on(EVENTS.POLL_UPDATED, handlePollUpdated);
    socket.on(EVENTS.ERROR, handleError);

    // Cleanup on unmount
    return () => {
      socket.off(EVENTS.ROOM_STATE, handleRoomState);
      socket.off(EVENTS.VIDEO_UPDATE, handleVideoUpdate);
      socket.off(EVENTS.USER_JOINED, handleUserJoined);
      socket.off(EVENTS.USER_LEFT, handleUserLeft);
      socket.off(EVENTS.HOST_CHANGED, handleHostChanged);
      socket.off(EVENTS.NEW_MESSAGE, handleNewMessage);
      socket.off(EVENTS.PLAYLIST_UPDATED, handlePlaylistUpdated);
      socket.off(EVENTS.POLL_UPDATED, handlePollUpdated);
      socket.off(EVENTS.ERROR, handleError);
    };
  }, [socket, roomCode]);

  /**
   * Send play command to server with current position
   * This allows pause-drag-play seeking to work
   */
  const sendPlay = (position, version) => {
    socket.emit(EVENTS.PLAY, {
      code: roomCode,
      userId: localStorage.getItem('clientId'),
      position,
      version
    });
  };

  /**
   * Send pause command with current position
   */
  const sendPause = (position, version) => {
    socket.emit(EVENTS.PAUSE, {
      code: roomCode,
      userId: localStorage.getItem('clientId'),
      position,
      version
    });
  };

  /**
   * Send seek command to jump to a position
   */
  const sendSeek = (position, version) => {
    socket.emit(EVENTS.SEEK, {
      code: roomCode,
      userId: localStorage.getItem('clientId'),
      position,
      version
    });
  };

  return {
    room,
    error,
    sendPlay,
    sendPause,
    sendSeek
  };
}
