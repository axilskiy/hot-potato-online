import { Server } from 'socket.io'
import { Room, GameState, PowerUpType, PowerUp } from '../types/index.js'
import { EVENTS } from '../socket/events.js'

const ARENA_W = 800
const ARENA_H = 500
const POWERUP_MARGIN = 50
const MAX_POWERUPS = 3
const POWERUP_TYPES: PowerUpType[] = ['speed', 'shield', 'freeze']

const SPAWN_POSITIONS = [
  { x: 120, y: 120 }, { x: 680, y: 120 },
  { x: 120, y: 380 }, { x: 680, y: 380 },
  { x: 400, y: 120 }, { x: 400, y: 380 },
  { x: 200, y: 250 }, { x: 600, y: 250 },
]

export function buildGameState(room: Room): GameState {
  return {
    roomId: room.id,
    players: room.players,
    phase: room.phase,
    potatoDeadline: room.potatoDeadline,
    roundDuration: room.roundDuration,
    settings: room.settings,
    powerUps: room.powerUps,
  }
}

// ─── Power-up spawner ────────────────────────────────────────────────────────

function stopPowerUpSpawner(room: Room): void {
  if (room.powerUpSpawnTimer) {
    clearTimeout(room.powerUpSpawnTimer)
    room.powerUpSpawnTimer = null
  }
}

function scheduleNextSpawn(io: Server, room: Room): void {
  const delay = 3000 + Math.random() * 2000
  room.powerUpSpawnTimer = setTimeout(() => spawnPowerUp(io, room), delay)
}

function spawnPowerUp(io: Server, room: Room): void {
  if (room.phase !== 'playing') {
    scheduleNextSpawn(io, room)
    return
  }
  if (room.powerUps.length >= MAX_POWERUPS) {
    scheduleNextSpawn(io, room)
    return
  }

  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]
  const x = Math.floor(POWERUP_MARGIN + Math.random() * (ARENA_W - 2 * POWERUP_MARGIN))
  const y = Math.floor(POWERUP_MARGIN + Math.random() * (ARENA_H - 2 * POWERUP_MARGIN))
  const id = Math.random().toString(36).slice(2, 10)

  room.powerUps.push({ id, type, x, y })
  io.to(room.id).emit(EVENTS.POWERUPS_UPDATE, { powerUps: room.powerUps })

  scheduleNextSpawn(io, room)
}

// ─── Core game functions ─────────────────────────────────────────────────────

export function startGame(io: Server, room: Room): void {
  room.phase = 'playing'
  room.eliminatedOrder = []
  room.powerUps = []
  stopPowerUpSpawner(room)

  for (const p of room.players) {
    p.speedUntil = undefined
    p.shieldUntil = undefined
    p.freezeUntil = undefined
    p.hasFreezeCharge = undefined
  }

  const spawns = [...SPAWN_POSITIONS].sort(() => Math.random() - 0.5)
  for (let i = 0; i < room.players.length; i++) {
    const p = room.players[i]
    p.isAlive = true
    p.hasPotato = false
    p.x = spawns[i % spawns.length].x
    p.y = spawns[i % spawns.length].y
  }

  scheduleNextSpawn(io, room)
  givePotato(io, room)
}

export function givePotato(io: Server, room: Room): void {
  if (room.potatoTimer) clearTimeout(room.potatoTimer)

  const alivePlayers = room.players.filter(p => p.isAlive)

  if (alivePlayers.length === 1) {
    room.phase = 'gameOver'
    room.potatoDeadline = null
    room.potatoTimer = null
    stopPowerUpSpawner(room)
    awardScores(room)
    io.to(room.id).emit(EVENTS.GAME_OVER, {
      winner: alivePlayers[0].nickname,
      eliminatedOrder: room.eliminatedOrder,
      players: room.players,
    })
    return
  }

  if (alivePlayers.length === 0) return

  for (const p of room.players) p.hasPotato = false

  const lucky = alivePlayers[Math.floor(Math.random() * alivePlayers.length)]
  lucky.hasPotato = true

  const duration = room.settings.roundDuration
  room.roundDuration = duration
  room.potatoDeadline = Date.now() + duration * 1000

  io.to(room.id).emit(EVENTS.GAME_STATE, buildGameState(room))

  room.potatoTimer = setTimeout(() => explodePotato(io, room), duration * 1000)
}

export function passPotato(io: Server, room: Room, fromId: string, toId: string): boolean {
  if (room.phase !== 'playing') return false

  const from = room.players.find(p => p.id === fromId)
  const to = room.players.find(p => p.id === toId && p.isAlive)

  if (!from || !from.hasPotato || !to || from.id === to.id) return false

  // Shield blocks potato pass
  if (to.shieldUntil && Date.now() < to.shieldUntil) return false

  from.hasPotato = false
  to.hasPotato = true

  io.to(room.id).emit(EVENTS.GAME_STATE, buildGameState(room))
  return true
}

export function collectPowerUp(io: Server, room: Room, playerId: string, powerUpId: string): boolean {
  if (room.phase !== 'playing') return false

  const player = room.players.find(p => p.id === playerId && p.isAlive)
  if (!player) return false

  const puIndex = room.powerUps.findIndex(pu => pu.id === powerUpId)
  if (puIndex === -1) return false

  const powerUp = room.powerUps[puIndex]
  room.powerUps.splice(puIndex, 1)

  const now = Date.now()
  switch (powerUp.type) {
    case 'speed':
      player.speedUntil = Math.max(player.speedUntil ?? 0, now + 5000)
      break
    case 'shield':
      player.shieldUntil = Math.max(player.shieldUntil ?? 0, now + 5000)
      break
    case 'freeze':
      player.hasFreezeCharge = true
      break
  }

  io.to(room.id).emit(EVENTS.GAME_STATE, buildGameState(room))
  return true
}

export function useFreezeCharge(io: Server, room: Room, fromId: string, targetId: string): boolean {
  if (room.phase !== 'playing') return false

  const from = room.players.find(p => p.id === fromId && p.isAlive && p.hasFreezeCharge)
  if (!from) return false

  const target = room.players.find(p => p.id === targetId && p.isAlive && p.id !== fromId)
  if (!target) return false

  from.hasFreezeCharge = false
  target.freezeUntil = Date.now() + 2000

  io.to(room.id).emit(EVENTS.GAME_STATE, buildGameState(room))
  return true
}

function awardScores(room: Room): void {
  const winner = room.players.find(p => p.isAlive)
  if (winner) winner.score += 3

  const n = room.eliminatedOrder.length
  if (n >= 1) {
    const p = room.players.find(pl => pl.nickname === room.eliminatedOrder[n - 1])
    if (p) p.score += 2
  }
  if (n >= 2) {
    const p = room.players.find(pl => pl.nickname === room.eliminatedOrder[n - 2])
    if (p) p.score += 1
  }
}

function explodePotato(io: Server, room: Room): void {
  const victim = room.players.find(p => p.hasPotato)
  if (!victim) return

  victim.isAlive = false
  victim.hasPotato = false
  victim.hasFreezeCharge = undefined
  room.eliminatedOrder.push(victim.nickname)

  const alivePlayers = room.players.filter(p => p.isAlive)

  if (alivePlayers.length === 1) {
    room.phase = 'gameOver'
    if (room.potatoTimer) clearTimeout(room.potatoTimer)
    room.potatoTimer = null
    room.potatoDeadline = null
    stopPowerUpSpawner(room)

    awardScores(room)

    io.to(room.id).emit(EVENTS.GAME_OVER, {
      winner: alivePlayers[0].nickname,
      eliminatedOrder: room.eliminatedOrder,
      players: room.players,
    })
    return
  }

  room.phase = 'roundEnd'
  room.potatoDeadline = null
  io.to(room.id).emit(EVENTS.ROUND_END, {
    eliminated: victim.nickname,
    players: room.players,
  })

  room.potatoTimer = setTimeout(() => {
    room.phase = 'playing'
    givePotato(io, room)
  }, 3000)
}

export function restartGame(io: Server, room: Room): void {
  if (room.potatoTimer) clearTimeout(room.potatoTimer)
  stopPowerUpSpawner(room)
  room.phase = 'waiting'
  room.potatoDeadline = null
  room.potatoTimer = null
  room.eliminatedOrder = []
  room.powerUps = []

  for (const p of room.players) {
    p.isAlive = true
    p.hasPotato = false
    p.speedUntil = undefined
    p.shieldUntil = undefined
    p.freezeUntil = undefined
    p.hasFreezeCharge = undefined
  }

  io.to(room.id).emit(EVENTS.GAME_STATE, buildGameState(room))
}

export function handleDisconnect(io: Server, room: Room): void {
  if (room.phase !== 'playing') return

  const alive = room.players.filter(p => p.isAlive)
  if (alive.length === 0) return

  if (alive.length === 1) {
    if (room.potatoTimer) clearTimeout(room.potatoTimer)
    room.potatoTimer = null
    room.phase = 'gameOver'
    room.potatoDeadline = null
    stopPowerUpSpawner(room)
    awardScores(room)
    io.to(room.id).emit(EVENTS.GAME_OVER, {
      winner: alive[0].nickname,
      eliminatedOrder: room.eliminatedOrder,
      players: room.players,
    })
    return
  }

  const someoneHasPotato = room.players.some(p => p.hasPotato)
  if (!someoneHasPotato) {
    if (room.potatoTimer) clearTimeout(room.potatoTimer)
    givePotato(io, room)
  }
}
