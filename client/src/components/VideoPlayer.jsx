import { useEffect, useRef, useState } from 'react';
import { useSyncedPlayer } from '../hooks/useSyncedPlayer';

/**
 * VideoPlayer component using YouTube IFrame Player API
 * Loads the API, creates the player, and handles sync with server state
 */
function VideoPlayer({ room, sendPlay, sendPause, sendSeek }) {
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [apiReady, setApiReady] = useState(false);

  // Use the sync hook to handle play/pause/seek
  const { handleLocalPlay, handleLocalPause, handleLocalSeek, isRemoteUpdate } =
    useSyncedPlayer(player, room, sendPlay, sendPause, sendSeek);

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
   */
  useEffect(() => {
    if (!apiReady || !playerContainerRef.current || playerRef.current) return;

    const newPlayer = new window.YT.Player(playerContainerRef.current, {
      height: '100%',
      width: '100%',
      videoId: room?.videoId || 'dQw4w9WgXcQ', // Default video (Rick Roll)
      playerVars: {
        controls: 1,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: (event) => {
          playerRef.current = event.target;
          setPlayer(event.target);
        },
        // Listen to state changes from the player itself
        // These fire when the user clicks play/pause on the YouTube controls
        onStateChange: (event) => {
          // Only handle local actions, not remote updates
          if (isRemoteUpdate()) return;

          // YT.PlayerState: PLAYING = 1, PAUSED = 2
          if (event.data === window.YT.PlayerState.PLAYING) {
            handleLocalPlay();
          } else if (event.data === window.YT.PlayerState.PAUSED) {
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
  }, [apiReady, room?.videoId]);

  /**
   * Handle seek when user drags the progress bar
   * We detect this by checking if the player time jumped significantly
   */
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (isRemoteUpdate()) return;

      // This is a basic seek detection
      // In Phase 3 we'll add drift correction here
    }, 1000);

    return () => clearInterval(interval);
  }, [player, isRemoteUpdate]);

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
