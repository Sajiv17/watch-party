import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import Room from './components/Room';

// Initialize socket connection
// Use relative path for ngrok compatibility (proxied through Vite)
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

function App() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Create socket connection when app loads
    const newSocket = io(SOCKET_URL, {
      // Automatically reconnect if connection is lost
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Connected to server:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  // Don't render until socket is ready
  if (!socket) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div>Connecting to server...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Lobby socket={socket} />} />
        <Route path="/room/:code" element={<Room socket={socket} />} />
      </Routes>
    </Router>
  );
}

export default App;
