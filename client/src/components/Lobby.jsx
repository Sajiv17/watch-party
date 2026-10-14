import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EVENTS } from '../utils/constants';

// Lobby page: create or join a room
function Lobby({ socket }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Generate a unique client ID (stored in localStorage)
  const getClientId = () => {
    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
      clientId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('clientId', clientId);
    }
    return clientId;
  };

  // Create a new room
  const handleCreateRoom = () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (name.length > 20) {
      setError('Name must be 20 characters or less');
      return;
    }

    const userId = getClientId();

    // Listen for room creation
    socket.once(EVENTS.ROOM_STATE, (room) => {
      // Save user info for reconnection
      localStorage.setItem('userName', name);
      // Navigate to the room
      navigate(`/room/${room.code}`);
    });

    // Request room creation
    socket.emit(EVENTS.CREATE_ROOM, { userId, userName: name });
  };

  // Join an existing room
  const handleJoinRoom = () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (name.length > 20) {
      setError('Name must be 20 characters or less');
      return;
    }

    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    const userId = getClientId();

    // Listen for room state or error
    socket.once(EVENTS.ROOM_STATE, (room) => {
      localStorage.setItem('userName', name);
      navigate(`/room/${room.code}`);
    });

    socket.once(EVENTS.ERROR, (err) => {
      setError(err.message || 'Failed to join room');
    });

    // Request to join room
    socket.emit(EVENTS.JOIN_ROOM, {
      code: roomCode.toUpperCase(),
      userId,
      userName: name
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
          Watch Party
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Watch videos together in sync
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <button
          onClick={handleCreateRoom}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-md mb-4 transition duration-200"
        >
          Create New Room
        </button>

        <div className="flex items-center mb-4">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="px-4 text-gray-500 text-sm">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Room Code
          </label>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Enter 6-digit code"
            maxLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <button
          onClick={handleJoinRoom}
          className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-4 rounded-md transition duration-200"
        >
          Join Room
        </button>
      </div>
    </div>
  );
}

export default Lobby;
