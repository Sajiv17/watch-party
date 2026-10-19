import { useEffect, useRef, useState } from 'react';
import { useSyncedPlayer } from '../hooks/useSyncedPlayer';

/**
 * VideoPlayer component using YouTube IFrame Player API
 * Loads the API, creates the player, and handles sync with server state
 */
function VideoPlayer({ room, sendPlay, sendPause, sendSeek, getServerTime }) {
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [apiReady, setApiReady] = useState(false);

  // Use the sync hook to handle play/pause/seek and drift correction
  const { handleLocalPlay, handleLocalPause, handleLocalSeek, isRemoteUpdate } =
    useSyncedPlayer(player, room, sendPlay, sendPause, sendSeek, getServerTime);

  // Store handlers in refs so event listeners always have latest version
  const handlersRef = useRef({ handleLocalPlay, handleLocalPause, isRemoteUpdate });

  useEffect(() => {
    handlersRef.current = { handleLocalPlay, handleLocalPause, isRemoteUpdate };
  }, [handleLocalPlay, handleLocalPause, isRemoteUpdate]);

  /**
   * Load the YouTube IFrame Player API
   * This injects the script and waits for it to be ready
   */
  useEffect(() => {
    // Check if API is already loaded
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }

    // Load the API script
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // The API will call this function when ready
    window.onYouTubeIframeAPIReady = () => {
      setApiReady(true);
    };

    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, []);

  /**
   * Create the YouTube player instance when API is ready
   * We create it ONCE, not every time the video changes
   */
  useEffect(() => {
    if (!apiReady || !playerContainerRef.current || playerRef.current) return;

    const newPlayer = new window.YT.Player(playerContainerRef.current, {
      height: '100%',
      width: '100%',
      videoId: '', // Start with no video - we'll load it separately
      playerVars: {
        controls: 1,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: (event) => {
          playerRef.current = event.target;
          setPlayer(event.target);
          console.log('YouTube player ready');
        },
        // Listen to state changes from the player itself
        // These fire when the user clicks play/pause on the YouTube controls
        onStateChange: (event) => {
          // Use refs to get the latest handlers
          const { isRemoteUpdate, handleLocalPlay, handleLocalPause } = handlersRef.current;

          const stateNames = {
            '-1': 'UNSTARTED',
            '0': 'ENDED',
            '1': 'PLAYING',
            '2': 'PAUSED',
            '3': 'BUFFERING',
            '5': 'CUED'
          };

          console.log('━━━ YouTube Event:', stateNames[event.data] || event.data, '| Remote flag:', isRemoteUpdate());

          // Only handle local actions, not remote updates
          if (isRemoteUpdate()) {
            console.log('  → BLOCKED (remote update in progress)');
            return;
          }

          // YT.PlayerState: PLAYING = 1, PAUSED = 2
          if (event.data === window.YT.PlayerState.PLAYING) {
            console.log('  → User PLAY action detected');
            handleLocalPlay();
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            console.log('  → User PAUSE action detected');
            handleLocalPause();
          }
        }
      }
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [apiReady]); // Only depends on API ready, NOT videoId

  /**
   * Load new video when videoId changes
   * This updates the existing player instead of recreating it
   */
  useEffect(() => {
    if (!player || !room?.videoId) return;

    // Load the new video into the existing player
    // cueVideoById loads but doesn't autoplay
    player.cueVideoById(room.videoId);
    console.log('Loading video:', room.videoId);
  }, [player, room?.videoId]);

  /**
   * Handle seek when user drags the progress bar
   * We detect this by checking if the player time jumped significantly
   */
  useEffect(() => {
    if (!player || !room?.videoId) return;

    let lastPosition = 0;

    const interval = setInterval(() => {
      // Skip during remote updates (drift correction or sync)
      if (isRemoteUpdate()) return;

      try {
        const currentPosition = player.getCurrentTime();

        // Calculate the jump in position
        const jump = Math.abs(currentPosition - lastPosition);

        // If position jumped by more than 2 seconds, user likely seeked
        // Normal playback advances by ~0.5s per check (500ms interval)
        // Give some buffer for lag, so anything > 2s is a seek
        if (jump > 2) {
          console.log(`🎯 Seek detected: jumped ${jump.toFixed(2)}s from ${lastPosition.toFixed(2)} to ${currentPosition.toFixed(2)}`);
          handleLocalSeek();
        }

        lastPosition = currentPosition;
      } catch (e) {
        // Player might not be ready yet
      }
    }, 500); // Check every 500ms for responsiveness

    return () => clearInterval(interval);
  }, [player, room?.videoId, isRemoteUpdate, handleLocalSeek]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <div ref={playerContainerRef} className="w-full h-full" />

      {!room?.videoId && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90 text-white">
          <div className="text-center">
            <p className="text-xl mb-4">No video playing</p>
            <p className="text-sm text-gray-400">
              Paste a YouTube URL or select a movie from the browser (Phase 4)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
