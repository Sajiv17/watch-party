import { useState, useEffect } from 'react';
import { EVENTS } from '../utils/constants';

/**
 * Reactions component - emoji reactions that float over the video
 */
function Reactions({ socket, roomCode }) {
  const [activeReactions, setActiveReactions] = useState([]);
  const emojis = ['👍', '❤️', '😂', '😮', '🎉', '🔥'];

  useEffect(() => {
    if (!socket) return;

    const handleNewReaction = ({ emoji, userName }) => {
      // Create a new floating reaction
      const reaction = {
        id: Date.now() + Math.random(),
        emoji,
        userName,
        // Random horizontal position
        left: Math.random() * 80 + 10, // 10-90%
      };

      setActiveReactions(prev => [...prev, reaction]);

      // Remove after animation (3 seconds)
      setTimeout(() => {
        setActiveReactions(prev => prev.filter(r => r.id !== reaction.id));
      }, 3000);
    };

    socket.on(EVENTS.NEW_REACTION, handleNewReaction);

    return () => {
      socket.off(EVENTS.NEW_REACTION, handleNewReaction);
    };
  }, [socket]);

  const sendReaction = (emoji) => {
    socket.emit(EVENTS.SEND_REACTION, {
      code: roomCode,
      userId: localStorage.getItem('clientId'),
      emoji
    });
  };

  return (
    <>
      {/* Emoji buttons */}
      <div className="flex gap-2 justify-center mb-4">
        {emojis.map(emoji => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-2xl hover:scale-125 transition-transform duration-200 bg-gray-700 hover:bg-gray-600 w-12 h-12 rounded-full flex items-center justify-center"
            title="Send reaction"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Floating reactions overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {activeReactions.map(reaction => (
          <div
            key={reaction.id}
            className="absolute animate-float-up text-4xl"
            style={{
              left: `${reaction.left}%`,
              bottom: '0',
              animation: 'floatUp 3s ease-out forwards'
            }}
          >
            {reaction.emoji}
          </div>
        ))}
      </div>

      {/* CSS for float animation */}
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-400px) scale(1.5);
            opacity: 0;
          }
        }
        .animate-float-up {
          animation: floatUp 3s ease-out forwards;
        }
      `}</style>
    </>
  );
}

export default Reactions;
