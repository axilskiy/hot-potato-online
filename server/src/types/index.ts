export type GamePhase = 'waiting' | 'playing' | 'roundEnd' | 'gameOver'
export type MapType = 'classic' | 'maze' | 'cross'
export type TouchControls = 'auto' | 'on' | 'off'
export type PowerUpType = 'speed' | 'shield' | 'freeze'

export interface RoomSettings {
  roundDuration: 10 | 15 | 20 | 30
  maxPlayers: 3 | 4 | 6 | 8 | 10
  mapType: MapType
  touchControls: TouchControls
}

export interface PowerUp {
  id: string
  type: PowerUpType
  x: number
  y: number
}

export interface Player {
  id: string
  nickname: string
  isHost: boolean
  isAlive: boolean
  hasPotato: boolean
  avatar: string
  color: string
  x: number
  y: number
  score: number
  speedUntil?: number
  shieldUntil?: number
  freezeUntil?: number
  hasFreezeCharge?: boolean
}

export interface Room {
  id: string
  players: Player[]
  phase: GamePhase
  potatoTimer: NodeJS.Timeout | null
  potatoDeadline: number | null
  roundDuration: number
  eliminatedOrder: string[]
  settings: RoomSettings
  powerUps: PowerUp[]
  powerUpSpawnTimer: NodeJS.Timeout | null
}

export interface GameState {
  roomId: string
  players: Player[]
  phase: GamePhase
  potatoDeadline: number | null
  roundDuration: number
  settings: RoomSettings
  powerUps: PowerUp[]
}
