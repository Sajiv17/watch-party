import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EVENTS } from '../utils/constants';
import { useRoomSocket } from '../hooks/useRoomSocket';
import VideoPlayer from './VideoPlayer';

// Room page: the main watch party interface
function Room({ socket }) {
  const { code } = useParams();
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');

  // Use the custom hook to manage room state and socket events
  const { room, error, sendPlay, sendPause, sendSeek } = useRoomSocket(socket, code);

  useEffect(() => {
    // Get user info from localStorage
    const userId = localStorage.getItem('clientId');
    const userName = localStorage.getItem('userName');

    if (!userId || !userName) {
      navigate('/');
      return;
    }

    // Join the room
    socket.emit(EVENTS.JOIN_ROOM, { code, userId, userName });
  }, [code, socket, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl mb-4">Error: {error}</h2>
          <button
            onClick={() => navigate('/')}
            className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div>Loading room...</div>
      </div>
    );
  }

  const currentUserId = localStorage.getItem('clientId');
  const isHost = room.hostId === currentUserId;

  // Generate shareable invite link
  const inviteLink = `${window.location.origin}/room/${room.code}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">Watch Party</h1>
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-gray-400">Room Code: </span>
              <span className="font-mono text-xl font-bold text-purple-400">
                {room.code}
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteLink);
                alert('Invite link copied!');
              }}
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-sm"
            >
              Copy Invite Link
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Video player */}
          <div className="lg:col-span-3">
            <div className="bg-gray-800 rounded-lg p-4">
              <VideoPlayer
                room={room}
                sendPlay={sendPlay}
                sendPause={sendPause}
                sendSeek={sendSeek}
              />

              {/* Video URL input (temporary until Phase 4 TMDB integration) */}
              <div className="mt-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Load a YouTube video (paste URL or video ID):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="e.g., https://youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ"
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => {
                      // Extract video ID from URL or use the input directly
                      let videoId = videoUrl;
                      const urlMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
                      if (urlMatch) {
                        videoId = urlMatch[1];
                      }

                      if (videoId) {
                        // Update the room's video
                        socket.emit(EVENTS.PLAY_FROM_PLAYLIST, {
                          code,
                          videoId,
                          version: room.version
                        });
                        setVideoUrl('');
                      }
                    }}
                    className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded font-medium"
                  >
                    Load Video
                  </button>
                </div>
                {isHost && (
                  <p className="text-purple-400 text-sm mt-2">
                    You are the host - you can control playback
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* User list */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-xl font-bold mb-4">
                Participants ({room.users.length})
              </h2>
              <div className="space-y-2">
                {room.users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 bg-gray-700 rounded"
                  >
                    <span>{user.name}</span>
                    {user.id === room.hostId && (
                      <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded">
                        HOST
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Room;
