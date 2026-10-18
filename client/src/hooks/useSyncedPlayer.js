import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook to synchronize YouTube player with server state
 * Handles the critical sync logic: applying remote updates without echo loops
 */
export function useSyncedPlayer(player, room, sendPlay, sendPause, sendSeek) {
  // Flag to prevent echo loops: when we apply a remote update, don't re-broadcast it
  const isRemoteUpdateRef = useRef(false);

  // Store the last known version to send with commands
  const [currentVersion, setCurrentVersion] = useState(0);

  useEffect(() => {
    if (!room) return;
    setCurrentVersion(room.version);
  }, [room?.version]);

  /**
   * Apply server state to the YouTube player
   * This runs whenever the server sends us an update (play/pause/seek)
   */
  useEffect(() => {
    if (!player || !room || !room.videoId) return;

    // Check if player has a video loaded
    try {
      const duration = player.getDuration();
      if (!duration || duration === 0) return; // Video not loaded yet
    } catch (e) {
      return; // Player not ready
    }

    // Calculate the expected position based on server state
    // If playing: position + (time elapsed since last update)
    // If paused: just use the position
    const getExpectedPosition = () => {
      if (room.status === 'paused') {
        return room.position;
      }
      // Playing: calculate based on time elapsed
      const elapsed = (Date.now() - room.updatedAt) / 1000;
      return room.position + elapsed;
    };

    const expectedPosition = getExpectedPosition();

    // Set the flag to prevent echo loop
    isRemoteUpdateRef.current = true;

    // Apply the state to the player
    if (room.status === 'playing') {
      // Seek to expected position and play
      player.seekTo(expectedPosition, true);
      player.playVideo();
    } else {
      // Paused: seek and pause
      player.seekTo(expectedPosition, true);
      player.pauseVideo();
    }

    // Reset the flag after a short delay
    setTimeout(() => {
      isRemoteUpdateRef.current = false;
    }, 100);

  }, [player, room?.status, room?.position, room?.updatedAt, room?.version]);

  /**
   * Handle local play/pause/seek actions from THIS user
   * These get sent to the server, which broadcasts to everyone
   */
  const handleLocalPlay = () => {
    if (isRemoteUpdateRef.current) return;
    sendPlay(currentVersion);
  };

  const handleLocalPause = () => {
    if (isRemoteUpdateRef.current || !player) return;
    try {
      const currentTime = player.getCurrentTime();
      sendPause(currentTime, currentVersion);
    } catch (e) {
      console.error('Error getting current time:', e);
    }
  };

  const handleLocalSeek = () => {
    if (isRemoteUpdateRef.current || !player) return;
    try {
      const currentTime = player.getCurrentTime();
      sendSeek(currentTime, currentVersion);
    } catch (e) {
      console.error('Error getting current time:', e);
    }
  };

  return {
    handleLocalPlay,
    handleLocalPause,
    handleLocalSeek,
    isRemoteUpdate: () => isRemoteUpdateRef.current
  };
}
