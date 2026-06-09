export const EVENTS = {
  // Client → Server
  CREATE_ROOM:      'create_room',
  JOIN_ROOM:        'join_room',
  START_GAME:       'start_game',
  PASS_POTATO:      'pass_potato',
  RESTART_GAME:     'restart_game',
  PLAYER_MOVE:      'player_move',
  UPDATE_SETTINGS:  'update_settings',
  RETURN_TO_LOBBY:  'return_to_lobby',
  COLLECT_POWERUP:  'collect_powerup',
  USE_FREEZE:       'use_freeze',

  // Server → Client
  ROOM_JOINED:      'room_joined',
  ROOM_ERROR:       'room_error',
  GAME_STATE:       'game_state',
  PLAYER_JOINED:    'player_joined',
  PLAYER_LEFT:      'player_left',
  ROUND_END:        'round_end',
  GAME_OVER:        'game_over',
  POSITIONS_UPDATE: 'positions_update',
  SETTINGS_UPDATED: 'settings_updated',
  POWERUPS_UPDATE:  'powerups_update',
} as const
