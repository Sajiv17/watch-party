// Shared socket event names used by both client and server
// Keeping all event names in one place prevents typos and makes the protocol clear

export const EVENTS = {
  // Room management
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_STATE: 'room_state',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',

  // Video control
  PLAY: 'play',
  PAUSE: 'pause',
  SEEK: 'seek',
  VIDEO_UPDATE: 'video_update',

  // Clock sync (for drift correction)
  PING: 'ping',
  PONG: 'pong',

  // Chat
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE: 'new_message',

  // Reactions
  SEND_REACTION: 'send_reaction',
  NEW_REACTION: 'new_reaction',

  // Playlist
  ADD_TO_PLAYLIST: 'add_to_playlist',
  REMOVE_FROM_PLAYLIST: 'remove_from_playlist',
  PLAY_FROM_PLAYLIST: 'play_from_playlist',
  PLAYLIST_UPDATED: 'playlist_updated',

  // Polls
  CREATE_POLL: 'create_poll',
  VOTE_POLL: 'vote_poll',
  POLL_UPDATED: 'poll_updated',

  // Host management
  TRANSFER_HOST: 'transfer_host',
  HOST_CHANGED: 'host_changed',

  // Errors
  ERROR: 'error'
};
