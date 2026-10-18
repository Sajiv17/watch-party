import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EVENTS } from '../utils/constants';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { useClockOffset } from '../hooks/useClockOffset';
import VideoPlayer from './VideoPlayer';
import MovieBrowser from './MovieBrowser';
import Chat from './Chat';
import Reactions from './Reactions';
import Playlist from './Playlist';
import Polls from './Polls';

// Room page: the main watch party interface
function Room({ socket }) {
  const { code } = useParams();
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');

  // Use the custom hook to manage room state and socket events
  const { room, error, sendPlay, sendPause, sendSeek } = useRoomSocket(socket, code);

  // Estimate clock offset for accurate sync
  const { offset, isCalibrated, getServerTime } = useClockOffset(socket);

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

  // Handle playing trailer from movie browser
  const handlePlayTrailer = (youtubeVideoId, movie) => {
    socket.emit(EVENTS.PLAY_FROM_PLAYLIST, {
      code,
      videoId: youtubeVideoId,
      version: room.version
    });
  };

  // Handle adding movie to playlist
  const handleAddToPlaylist = async (movie) => {
    try {
      // Get the movie's trailer
      const { getMovieVideos } = await import('../utils/tmdb');
      const videos = await getMovieVideos(movie.id);

      if (videos.length > 0) {
        const trailer = videos[0];
        socket.emit(EVENTS.ADD_TO_PLAYLIST, {
          code,
          video: {
            videoId: trailer.key,
            title: movie.title,
            thumbnail: movie.poster_path
          }
        });
      } else {
        alert('No trailer available for this movie');
      }
    } catch (err) {
      console.error('Failed to add to playlist:', err);
    }
  };

  // Handle host transfer
  const handleTransferHost = (newHostId) => {
    if (!isHost) return;

    socket.emit(EVENTS.TRANSFER_HOST, {
      code,
      currentHostId: currentUserId,
      newHostId
    });
  };

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
          {/* Left column: Video + Reactions + Chat + Playlist */}
          <div className="lg:col-span-3 space-y-4">
            {/* Video player with reactions */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="relative">
                <VideoPlayer
                  room={room}
                  sendPlay={sendPlay}
                  sendPause={sendPause}
                  sendSeek={sendSeek}
                  getServerTime={getServerTime}
                />
              </div>

              {/* Reactions component (buttons + floating overlay) */}
              <Reactions socket={socket} roomCode={code} />

              {/* Video URL input (fallback for custom YouTube URLs) */}
              <div className="mt-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Or paste a YouTube URL directly:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="e.g., https://youtube.com/watch?v=dQw4w9WgXcQ"
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-sm font-medium"
                  >
                    Load
                  </button>
                </div>
              </div>
            </div>

            {/* Chat */}
            <Chat
              socket={socket}
              roomCode={code}
              messages={room.chat || []}
            />

            {/* Playlist */}
            <Playlist
              socket={socket}
              roomCode={code}
              playlist={room.playlist || []}
              currentVideoId={room.videoId}
            />
          </div>

          {/* Right sidebar: Participants + Polls + Movie Browser */}
          <div className="lg:col-span-1 space-y-4">
            {/* User list with host transfer */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-xl font-bold mb-4">
                Participants ({room.users.length})
              </h2>
              <div className="space-y-2">
                {room.users.map((user) => (
                  <div
                    key={user.id}
                    className="p-2 bg-gray-700 rounded"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span>{user.name}</span>
                      {user.id === room.hostId && (
                        <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded">
                          HOST
                        </span>
                      )}
                    </div>
                    {isHost && user.id !== currentUserId && (
                      <button
                        onClick={() => handleTransferHost(user.id)}
                        className="w-full mt-1 bg-purple-600 hover:bg-purple-700 text-xs py-1 rounded"
                      >
                        Make Host
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Polls */}
            <Polls
              socket={socket}
              roomCode={code}
              polls={room.polls || []}
            />

            {/* Movie Browser */}
            <MovieBrowser
              onPlayTrailer={handlePlayTrailer}
              onAddToPlaylist={handleAddToPlaylist}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Room;
