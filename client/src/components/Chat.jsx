import { useState, useEffect, useRef } from 'react';
import { EVENTS } from '../utils/constants';

/**
 * Chat component for live messaging in the room
 */
function Chat({ socket, roomCode, messages }) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  // Use 'nearest' to only scroll the chat container, not the whole page
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',  // Don't scroll the whole page!
      inline: 'nearest'
    });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!message.trim()) return;

    socket.emit(EVENTS.SEND_MESSAGE, {
      code: roomCode,
      userId: localStorage.getItem('clientId'),
      message: message.trim()
    });

    setMessage('');
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col h-96">
      <h2 className="text-xl font-bold mb-4">Chat</h2>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-2">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-sm text-center">No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="bg-gray-700 rounded p-2">
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-semibold text-sm text-purple-400">
                  {msg.userName}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <p className="text-sm break-words">{msg.message}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          maxLength={500}
          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-medium text-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default Chat;
