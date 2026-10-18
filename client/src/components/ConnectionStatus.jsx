/**
 * Connection status banner - shows when disconnected or reconnecting
 */
function ConnectionStatus({ isConnected, isReconnecting }) {
  if (isConnected && !isReconnecting) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 p-2 text-center text-sm font-medium ${
      isReconnecting ? 'bg-yellow-600' : 'bg-red-600'
    }`}>
      {isReconnecting ? '⚠️ Reconnecting to server...' : '✗ Disconnected from server'}
    </div>
  );
}

export default ConnectionStatus;
