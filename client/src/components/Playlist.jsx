import { EVENTS } from '../utils/constants';

/**
 * Playlist component - shared playlist with play next functionality
 */
function Playlist({ socket, roomCode, playlist, currentVideoId }) {
  const handlePlayVideo = (videoId) => {
    socket.emit(EVENTS.PLAY_FROM_PLAYLIST, {
      code: roomCode,
      videoId,
      version: Date.now() // This will be replaced with room.version in Room component
    });
  };

  const handleRemoveVideo = (videoId) => {
    socket.emit(EVENTS.REMOVE_FROM_PLAYLIST, {
      code: roomCode,
      videoId
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">Playlist ({playlist.length})</h2>

      {playlist.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No videos in playlist
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {playlist.map((video, index) => (
            <div
              key={video.id}
              className={`p-2 rounded ${
                video.videoId === currentVideoId
                  ? 'bg-purple-900 border-2 border-purple-500'
                  : 'bg-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {video.title || `Video ${index + 1}`}
                  </p>
                  {video.videoId === currentVideoId && (
                    <span className="text-xs text-purple-400">
                      ▶ Now Playing
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {video.videoId !== currentVideoId && (
                    <button
                      onClick={() => handlePlayVideo(video.videoId)}
                      className="bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded text-xs"
                      title="Play this video"
                    >
                      Play
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveVideo(video.id)}
                    className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
                    title="Remove from playlist"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Playlist;
