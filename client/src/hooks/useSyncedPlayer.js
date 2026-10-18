import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook to synchronize YouTube player with server state
 * Handles the critical sync logic: applying remote updates without echo loops
 */
export function useSyncedPlayer(player, room, sendPlay, sendPause, sendSeek) {
  // Flag to prevent echo loops: when we apply a remote update, don't re-broadcast it
  const isRemoteUpdateRef = useRef(false);

  // Track the last version we applied to prevent re-applying the same state
  const lastAppliedVersionRef = useRef(-1);

  // Store the last known version to send with commands
  const [currentVersion, setCurrentVersion] = useState(0);

  useEffect(() => {
    if (!room) return;
    setCurrentVersion(room.version);
  }, [room?.version]);

  /**
   * Apply server state to the YouTube player
   * This runs ONLY when the version changes (new update from server)
   */
  useEffect(() => {
    if (!player || !room || !room.videoId) return;

    // CRITICAL: Only apply if this is a NEW version we haven't seen
    if (room.version === lastAppliedVersionRef.current) {
      console.log('Skipping sync - already applied version', room.version);
      return;
    }

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

    // Mark this version as applied
    lastAppliedVersionRef.current = room.version;

    // Set the flag to prevent echo loop
    isRemoteUpdateRef.current = true;
    console.log('Applying NEW remote update version', room.version, ':', room.status, 'at', expectedPosition.toFixed(2));

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
      console.log('Remote update flag cleared');
    }, 200);

  }, [player, room?.version]); // Only depend on version changes!

  /**
   * Handle local play/pause/seek actions from THIS user
   * These get sent to the server, which broadcasts to everyone
   */
  const handleLocalPlay = () => {
    if (isRemoteUpdateRef.current) {
      console.log('Ignoring local play (remote update in progress)');
      return;
    }
    console.log('Sending PLAY to server, version:', currentVersion);
    sendPlay(currentVersion);
  };

  const handleLocalPause = () => {
    if (isRemoteUpdateRef.current) {
      console.log('Ignoring local pause (remote update in progress)');
      return;
    }
    if (!player) return;
    try {
      const currentTime = player.getCurrentTime();
      console.log('Sending PAUSE to server at', currentTime.toFixed(2), 'version:', currentVersion);
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
