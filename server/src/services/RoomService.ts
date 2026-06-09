import { Room, Player, RoomSettings } from '../types/index.js'

const rooms = new Map<string, Room>()

const PLAYER_COLORS = [
  '#e94560', '#f5a623', '#4caf50', '#2196f3',
  '#9c27b0', '#ff9800', '#00bcd4', '#ff6b6b',
]

const SPAWN_POSITIONS = [
  { x: 120, y: 120 }, { x: 680, y: 120 },
  { x: 120, y: 380 }, { x: 680, y: 380 },
  { x: 400, y: 120 }, { x: 400, y: 380 },
  { x: 200, y: 250 }, { x: 600, y: 250 },
]

const DEFAULT_SETTINGS: RoomSettings = {
  roundDuration: 15,
  maxPlayers: 10,
  mapType: 'classic',
  touchControls: 'auto',
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return rooms.has(id) ? generateRoomId() : id
}

export function createRoom(hostId: string, nickname: string, avatar: string): Room {
  const roomId = generateRoomId()
  const host: Player = {
    id: hostId,
    nickname,
    isHost: true,
    isAlive: true,
    hasPotato: false,
    avatar,
    color: PLAYER_COLORS[0],
    x: SPAWN_POSITIONS[0].x,
    y: SPAWN_POSITIONS[0].y,
    score: 0,
  }
  const room: Room = {
    id: roomId,
    players: [host],
    phase: 'waiting',
    potatoTimer: null,
    potatoDeadline: null,
    roundDuration: DEFAULT_SETTINGS.roundDuration,
    eliminatedOrder: [],
    settings: { ...DEFAULT_SETTINGS },
    powerUps: [],
    powerUpSpawnTimer: null,
  }
  rooms.set(roomId, room)
  return room
}

export function joinRoom(
  roomId: string,
  playerId: string,
  nickname: string,
  avatar: string,
): Room | null {
  const room = rooms.get(roomId)
  if (!room) return null
  if (room.phase !== 'waiting') return null
  if (room.players.length >= room.settings.maxPlayers) return null

  const nicknameExists = room.players.some(p => p.nickname === nickname)
  if (nicknameExists) return null

  const idx = room.players.length
  const player: Player = {
    id: playerId,
    nickname,
    isHost: false,
    isAlive: true,
    hasPotato: false,
    avatar,
    color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
    x: SPAWN_POSITIONS[idx % SPAWN_POSITIONS.length].x,
    y: SPAWN_POSITIONS[idx % SPAWN_POSITIONS.length].y,
    score: 0,
  }
  room.players.push(player)
  return room
}

export function updateSettings(
  roomId: string,
  newSettings: Partial<RoomSettings>,
): Room | null {
  const room = rooms.get(roomId)
  if (!room) return null
  if (room.phase !== 'waiting') return null

  const validRoundDurations: number[] = [10, 15, 20, 30]
  const validMaxPlayers: number[] = [3, 4, 6, 8, 10]
  const validMapTypes = ['classic', 'maze', 'cross']
  const validTouchControls = ['auto', 'on', 'off']

  if (newSettings.roundDuration !== undefined && !validRoundDurations.includes(newSettings.roundDuration)) return null
  if (newSettings.maxPlayers !== undefined && !validMaxPlayers.includes(newSettings.maxPlayers)) return null
  if (newSettings.mapType !== undefined && !validMapTypes.includes(newSettings.mapType)) return null
  if (newSettings.touchControls !== undefined && !validTouchControls.includes(newSettings.touchControls)) return null

  room.settings = { ...room.settings, ...newSettings }
  return room
}

export function removePlayer(socketId: string): Room | null {
  for (const [, room] of rooms) {
    const index = room.players.findIndex(p => p.id === socketId)
    if (index === -1) continue

    const wasHost = room.players[index].isHost
    room.players.splice(index, 1)

    if (room.players.length === 0) {
      if (room.potatoTimer) clearTimeout(room.potatoTimer)
      if (room.powerUpSpawnTimer) clearTimeout(room.powerUpSpawnTimer)
      rooms.delete(room.id)
      return null
    }

    if (wasHost) {
      room.players[0].isHost = true
    }

    return room
  }
  return null
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId)
}

export function getRoomByPlayerId(socketId: string): Room | undefined {
  for (const [, room] of rooms) {
    if (room.players.some(p => p.id === socketId)) return room
  }
  return undefined
}
