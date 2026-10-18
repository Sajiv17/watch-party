import { useState } from 'react';
import { EVENTS } from '../utils/constants';

/**
 * Polls component - create and vote on group polls
 */
function Polls({ socket, roomCode, polls }) {
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleCreatePoll = (e) => {
    e.preventDefault();

    const validOptions = options.filter(opt => opt.trim());

    if (!question.trim() || validOptions.length < 2) {
      alert('Please enter a question and at least 2 options');
      return;
    }

    socket.emit(EVENTS.CREATE_POLL, {
      code: roomCode,
      userId: localStorage.getItem('clientId'),
      question: question.trim(),
      options: validOptions
    });

    // Reset form
    setQuestion('');
    setOptions(['', '']);
    setShowCreatePoll(false);
  };

  const handleVote = (pollId, optionIndex) => {
    socket.emit(EVENTS.VOTE_POLL, {
      code: roomCode,
      userId: localStorage.getItem('clientId'),
      pollId,
      optionIndex
    });
  };

  const addOption = () => {
    if (options.length < 4) {
      setOptions([...options, '']);
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Polls</h2>
        <button
          onClick={() => setShowCreatePoll(!showCreatePoll)}
          className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm"
        >
          {showCreatePoll ? 'Cancel' : '+ New Poll'}
        </button>
      </div>

      {/* Create poll form */}
      {showCreatePoll && (
        <form onSubmit={handleCreatePoll} className="mb-4 p-3 bg-gray-700 rounded">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Poll question..."
            maxLength={200}
            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          <div className="space-y-2 mb-2">
            {options.map((opt, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  maxLength={100}
                  className="flex-1 px-3 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < 4 && (
            <button
              type="button"
              onClick={addOption}
              className="text-xs text-purple-400 hover:text-purple-300 mb-2"
            >
              + Add option
            </button>
          )}

          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-sm"
          >
            Create Poll
          </button>
        </form>
      )}

      {/* Active polls */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {polls.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            No active polls
          </p>
        ) : (
          polls.map((poll) => (
            <div key={poll.id} className="bg-gray-700 rounded p-3">
              <p className="font-semibold text-sm mb-2">{poll.question}</p>
              <p className="text-xs text-gray-400 mb-2">
                by {poll.createdBy} • {poll.votes || 0} votes
              </p>

              <div className="space-y-2">
                {poll.options.map((option, index) => {
                  const totalVotes = poll.votes || 1;
                  const percentage = totalVotes > 0
                    ? Math.round((option.votes / totalVotes) * 100)
                    : 0;

                  return (
                    <button
                      key={index}
                      onClick={() => handleVote(poll.id, index)}
                      className="w-full text-left relative overflow-hidden bg-gray-600 hover:bg-gray-500 rounded p-2 text-sm transition-all"
                    >
                      <div
                        className="absolute inset-0 bg-purple-600 opacity-30 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                      <div className="relative flex justify-between items-center">
                        <span>{option.text}</span>
                        <span className="text-xs text-gray-300">
                          {option.votes} ({percentage}%)
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Polls;
