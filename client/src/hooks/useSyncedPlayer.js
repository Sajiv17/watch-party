import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook to synchronize YouTube player with server state
 * Handles the critical sync logic: applying remote updates without echo loops
 */
export function useSyncedPlayer(player, room, sendPlay, sendPause, sendSeek, getServerTime) {
  // Flag to prevent echo loops: when we apply a remote update, don't re-broadcast it
  const isRemoteUpdateRef = useRef(false);

  // Track the last version we applied to prevent re-applying the same state
  const lastAppliedVersionRef = useRef(-1);

  // Track last player state to detect actual user changes
  const lastPlayerStateRef = useRef(null);

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

    // Reset the flag after a longer delay to ensure YouTube event doesn't fire
    setTimeout(() => {
      isRemoteUpdateRef.current = false;
      console.log('Remote update flag cleared');
    }, 500); // Increased to 500ms to be safe

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

    // Prevent duplicate sends
    const now = Date.now();
    if (lastPlayerStateRef.current?.action === 'play' &&
        now - lastPlayerStateRef.current.timestamp < 1000) {
      console.log('Ignoring duplicate play');
      return;
    }

    lastPlayerStateRef.current = { action: 'play', timestamp: now };
    console.log('Sending PLAY to server, version:', currentVersion);
    sendPlay(currentVersion);
  };

  const handleLocalPause = () => {
    if (isRemoteUpdateRef.current) {
      console.log('Ignoring local pause (remote update in progress)');
      return;
    }
    if (!player) return;

    // Prevent duplicate sends
    const now = Date.now();
    if (lastPlayerStateRef.current?.action === 'pause' &&
        now - lastPlayerStateRef.current.timestamp < 1000) {
      console.log('Ignoring duplicate pause');
      return;
    }

    try {
      const currentTime = player.getCurrentTime();
      lastPlayerStateRef.current = { action: 'pause', timestamp: now };
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
      console.log('Sending SEEK to server to', currentTime.toFixed(2), 'version:', currentVersion);
      sendSeek(currentTime, currentVersion);
    } catch (e) {
      console.error('Error getting current time:', e);
    }
  };

  /**
   * Drift detection and correction
   * Runs every ~3 seconds to check if player is out of sync
   */
  useEffect(() => {
    if (!player || !room || !room.videoId || !getServerTime) return;
    if (room.status !== 'playing') return; // Only check drift when playing

    const interval = setInterval(() => {
      // Don't check drift during remote updates
      if (isRemoteUpdateRef.current) return;

      try {
        // Get actual player position
        const actualPosition = player.getCurrentTime();

        // Calculate expected position based on server state
        // Use server time (adjusted for clock offset) for accuracy
        const serverNow = getServerTime();
        const elapsed = (serverNow - room.updatedAt) / 1000;
        const expectedPosition = room.position + elapsed;

        // Calculate drift
        const drift = Math.abs(actualPosition - expectedPosition);

        if (drift > 0.5) {
          // Drift > 500ms: Hard seek
          console.log(`⚠️ Drift detected: ${drift.toFixed(2)}s - Hard seeking to ${expectedPosition.toFixed(2)}s`);
          isRemoteUpdateRef.current = true;
          player.seekTo(expectedPosition, true);
          setTimeout(() => {
            isRemoteUpdateRef.current = false;
          }, 500);
        } else if (drift > 0.2) {
          // Drift 200-500ms: Playback rate nudge
          const isBehind = actualPosition < expectedPosition;
          const nudgeRate = isBehind ? 1.05 : 0.95;

          console.log(`🔧 Minor drift: ${drift.toFixed(2)}s - Nudging playback rate to ${nudgeRate}`);
          player.setPlaybackRate(nudgeRate);

          // Reset to normal speed after 2 seconds
          setTimeout(() => {
            player.setPlaybackRate(1.0);
            console.log('↻ Playback rate reset to 1.0');
          }, 2000);
        }
      } catch (e) {
        // Player might not be ready, ignore errors
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [player, room, getServerTime, isRemoteUpdateRef]);

  return {
    handleLocalPlay,
    handleLocalPause,
    handleLocalSeek,
    isRemoteUpdate: () => isRemoteUpdateRef.current
  };
}
