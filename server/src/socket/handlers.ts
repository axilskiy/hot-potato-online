import { Server, Socket } from 'socket.io'
import { EVENTS } from './events.js'
import { RoomSettings } from '../types/index.js'
import * as RoomService from '../services/RoomService.js'
import * as GameService from '../services/GameService.js'

const ARENA_W = 800
const ARENA_H = 500
const PLAYER_R = 24

export function registerHandlers(io: Server, socket: Socket): void {
  socket.on(EVENTS.CREATE_ROOM, ({ nickname, avatar }: { nickname: string; avatar: string }) => {
    if (!nickname?.trim()) return

    const room = RoomService.createRoom(socket.id, nickname.trim(), avatar || '😊')
    socket.join(room.id)
    socket.emit(EVENTS.ROOM_JOINED, {
      roomId: room.id,
      player: room.players[0],
      gameState: GameService.buildGameState(room),
    })
  })

  socket.on(EVENTS.JOIN_ROOM, ({ roomId, nickname, avatar }: { roomId: string; nickname: string; avatar: string }) => {
    if (!nickname?.trim() || !roomId?.trim()) return

    const room = RoomService.joinRoom(roomId.toUpperCase(), socket.id, nickname.trim(), avatar || '😊')
    if (!room) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Комната недоступна (не найдена, игра уже началась или комната заполнена)' })
      return
    }

    socket.join(room.id)
    const newPlayer = room.players.find(p => p.id === socket.id)!

    socket.emit(EVENTS.ROOM_JOINED, {
      roomId: room.id,
      player: newPlayer,
      gameState: GameService.buildGameState(room),
    })

    socket.to(room.id).emit(EVENTS.PLAYER_JOINED, {
      player: newPlayer,
      gameState: GameService.buildGameState(room),
    })
  })

  socket.on(EVENTS.START_GAME, ({ roomId }: { roomId: string }) => {
    const room = RoomService.getRoom(roomId)
    if (!room) return

    const player = room.players.find(p => p.id === socket.id)
    if (!player?.isHost) return
    if (room.players.length < 3) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Нужно минимум 3 игрока' })
      return
    }

    GameService.startGame(io, room)
  })

  socket.on(EVENTS.PASS_POTATO, ({ roomId, toId }: { roomId: string; toId: string }) => {
    const room = RoomService.getRoom(roomId)
    if (!room) return
    GameService.passPotato(io, room, socket.id, toId)
  })

  socket.on(EVENTS.RESTART_GAME, ({ roomId }: { roomId: string }) => {
    const room = RoomService.getRoom(roomId)
    if (!room) return
    const player = room.players.find(p => p.id === socket.id)
    if (!player?.isHost) return
    GameService.restartGame(io, room)
  })

  socket.on(EVENTS.RETURN_TO_LOBBY, ({ roomId }: { roomId: string }) => {
    const room = RoomService.getRoom(roomId)
    if (!room) return
    const player = room.players.find(p => p.id === socket.id)
    if (!player?.isHost) return
    GameService.restartGame(io, room)
  })

  socket.on(EVENTS.UPDATE_SETTINGS, ({ roomId, settings }: { roomId: string; settings: Partial<RoomSettings> }) => {
    const room = RoomService.getRoom(roomId)
    if (!room) return
    const player = room.players.find(p => p.id === socket.id)
    if (!player?.isHost) return

    const updated = RoomService.updateSettings(roomId, settings)
    if (!updated) return

    io.to(room.id).emit(EVENTS.SETTINGS_UPDATED, { settings: updated.settings })
  })

  socket.on(EVENTS.PLAYER_MOVE, ({ x, y }: { x: number; y: number }) => {
    const room = RoomService.getRoomByPlayerId(socket.id)
    if (!room || room.phase !== 'playing') return

    const player = room.players.find(p => p.id === socket.id)
    if (!player?.isAlive) return

    // Frozen players cannot move
    if (player.freezeUntil && Date.now() < player.freezeUntil) return

    player.x = Math.max(PLAYER_R, Math.min(ARENA_W - PLAYER_R, x))
    player.y = Math.max(PLAYER_R, Math.min(ARENA_H - PLAYER_R, y))

    socket.to(room.id).emit(EVENTS.POSITIONS_UPDATE, {
      id: socket.id,
      x: player.x,
      y: player.y,
    })
  })

  socket.on(EVENTS.COLLECT_POWERUP, ({ powerUpId }: { powerUpId: string }) => {
    const room = RoomService.getRoomByPlayerId(socket.id)
    if (!room) return
    GameService.collectPowerUp(io, room, socket.id, powerUpId)
  })

  socket.on(EVENTS.USE_FREEZE, ({ targetId }: { targetId: string }) => {
    const room = RoomService.getRoomByPlayerId(socket.id)
    if (!room) return
    GameService.useFreezeCharge(io, room, socket.id, targetId)
  })

  socket.on('disconnect', () => {
    const preRoom = RoomService.getRoomByPlayerId(socket.id)
    const hadPotato = preRoom?.phase === 'playing' &&
      preRoom.players.some(p => p.id === socket.id && p.hasPotato)

    const room = RoomService.removePlayer(socket.id)
    if (!room) return

    if (hadPotato) {
      for (const p of room.players) p.hasPotato = false
    }

    GameService.handleDisconnect(io, room)

    io.to(room.id).emit(EVENTS.PLAYER_LEFT, {
      playerId: socket.id,
      gameState: GameService.buildGameState(room),
    })
  })
}
