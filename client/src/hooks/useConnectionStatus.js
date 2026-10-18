import { useState, useEffect } from 'react';

/**
 * Hook to track Socket.io connection status
 * Shows reconnection status to the user
 */
export function useConnectionStatus(socket) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log('✓ Connected to server');
      setIsConnected(true);
      setIsReconnecting(false);
    };

    const handleDisconnect = (reason) => {
      console.log('✗ Disconnected:', reason);
      setIsConnected(false);

      // Auto-reconnect will happen via Socket.io
      if (reason !== 'io client disconnect') {
        setIsReconnecting(true);
      }
    };

    const handleReconnectAttempt = (attemptNumber) => {
      console.log(`Reconnect attempt ${attemptNumber}...`);
      setIsReconnecting(true);
    };

    const handleReconnectError = (error) => {
      console.error('Reconnect error:', error);
    };

    const handleReconnectFailed = () => {
      console.error('Reconnection failed after all attempts');
      setIsReconnecting(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('reconnect_error', handleReconnectError);
    socket.on('reconnect_failed', handleReconnectFailed);

    // Check initial connection state
    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('reconnect_error', handleReconnectError);
      socket.off('reconnect_failed', handleReconnectFailed);
    };
  }, [socket]);

  return { isConnected, isReconnecting };
}
