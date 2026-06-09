import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSocket, connectSocket, disconnectSocket } from '@/socket/socket'
import { EVENTS } from '@/socket/events'
import type {
  Player,
  PowerUp,
  GameState,
  RoomJoinedPayload,
  RoomSettings,
  RoundEndPayload,
  GameOverPayload,
} from '@/types'
import { useRouter } from 'vue-router'

const DEFAULT_SETTINGS: RoomSettings = {
  roundDuration: 15,
  maxPlayers: 10,
  mapType: 'classic',
  touchControls: 'auto',
}

export const useGameStore = defineStore('game', () => {
  const router = useRouter()

  // --- State ---
  const roomId         = ref<string | null>(null)
  const myPlayer       = ref<Player | null>(null)
  const players        = ref<Player[]>([])
  const phase          = ref<GameState['phase']>('waiting')
  const potatoDeadline = ref<number | null>(null)
  const roundDuration  = ref<number>(15)
  const settings       = ref<RoomSettings>({ ...DEFAULT_SETTINGS })
  const error          = ref<string | null>(null)
  const lastEliminated = ref<string | null>(null)
  const gameOverData   = ref<GameOverPayload | null>(null)
  const powerUps       = ref<PowerUp[]>([])

  const positions = ref<Map<string, { x: number; y: number }>>(new Map())

  // --- Computed ---
  const mySocketId   = computed(() => getSocket().id ?? '')
  const alivePlayers = computed(() => players.value.filter(p => p.isAlive))
  const iAmHost      = computed(() => myPlayer.value?.isHost ?? false)
  const iHavePotato  = computed(() => myPlayer.value?.hasPotato ?? false)
  const canStart     = computed(() => iAmHost.value && players.value.length >= 3 && phase.value === 'waiting')

  // --- Socket listener setup ---
  function setupListeners() {
    const socket = getSocket()

    socket.on(EVENTS.ROOM_JOINED, (payload: RoomJoinedPayload) => {
      roomId.value = payload.roomId
      myPlayer.value = payload.player
      applyGameState(payload.gameState)
      initPositionsFromPlayers(payload.gameState.players)
      error.value = null
      router.push('/lobby')
    })

    socket.on(EVENTS.ROOM_ERROR, ({ message }: { message: string }) => {
      error.value = message
    })

    socket.on(EVENTS.GAME_STATE, (state: GameState) => {
      applyGameState(state)
      initPositionsFromPlayers(state.players)
      syncMyPlayer()
      if (state.phase === 'playing') router.push('/game')
      if (state.phase === 'waiting') router.push('/lobby')
    })

    socket.on(EVENTS.PLAYER_JOINED, ({ gameState }: { player: Player; gameState: GameState }) => {
      applyGameState(gameState)
      initPositionsFromPlayers(gameState.players)
    })

    socket.on(EVENTS.PLAYER_LEFT, ({ playerId, gameState }: { playerId: string; gameState: GameState }) => {
      positions.value.delete(playerId)
      applyGameState(gameState)
      syncMyPlayer()
    })

    socket.on(EVENTS.ROUND_END, (payload: RoundEndPayload) => {
      players.value = payload.players
      phase.value = 'roundEnd'
      lastEliminated.value = payload.eliminated
      potatoDeadline.value = null
      syncMyPlayer()
    })

    socket.on(EVENTS.GAME_OVER, (payload: GameOverPayload) => {
      players.value = payload.players
      phase.value = 'gameOver'
      potatoDeadline.value = null
      gameOverData.value = payload
      syncMyPlayer()
      router.push('/results')
    })

    socket.on(EVENTS.POSITIONS_UPDATE, ({ id, x, y }: { id: string; x: number; y: number }) => {
      positions.value.set(id, { x, y })
    })

    socket.on(EVENTS.SETTINGS_UPDATED, ({ settings: newSettings }: { settings: RoomSettings }) => {
      settings.value = newSettings
    })

    socket.on(EVENTS.POWERUPS_UPDATE, ({ powerUps: newPowerUps }: { powerUps: PowerUp[] }) => {
      powerUps.value = newPowerUps
    })
  }

  // --- Actions ---
  function createRoom(nickname: string, avatar: string) {
    connectSocket()
    const socket = getSocket()
    setupListeners()
    socket.emit(EVENTS.CREATE_ROOM, { nickname, avatar })
  }

  function joinRoom(code: string, nickname: string, avatar: string) {
    connectSocket()
    const socket = getSocket()
    setupListeners()
    socket.emit(EVENTS.JOIN_ROOM, { roomId: code, nickname, avatar })
  }

  function startGame() {
    if (!roomId.value) return
    getSocket().emit(EVENTS.START_GAME, { roomId: roomId.value })
  }

  function passPotato(toId: string) {
    if (!roomId.value) return
    getSocket().emit(EVENTS.PASS_POTATO, { roomId: roomId.value, toId })
  }

  function restartGame() {
    if (!roomId.value) return
    getSocket().emit(EVENTS.RESTART_GAME, { roomId: roomId.value })
  }

  function returnToLobby() {
    if (!roomId.value) return
    getSocket().emit(EVENTS.RETURN_TO_LOBBY, { roomId: roomId.value })
  }

  function updateSettings(newSettings: Partial<RoomSettings>) {
    if (!roomId.value) return
    getSocket().emit(EVENTS.UPDATE_SETTINGS, { roomId: roomId.value, settings: newSettings })
  }

  function movePlayer(x: number, y: number) {
    getSocket().emit(EVENTS.PLAYER_MOVE, { x, y })
  }

  function collectPowerUp(powerUpId: string) {
    getSocket().emit(EVENTS.COLLECT_POWERUP, { powerUpId })
  }

  function useFreezeCharge(targetId: string) {
    getSocket().emit(EVENTS.USE_FREEZE, { targetId })
  }

  function leaveRoom() {
    disconnectSocket()
    roomId.value = null
    myPlayer.value = null
    players.value = []
    phase.value = 'waiting'
    potatoDeadline.value = null
    settings.value = { ...DEFAULT_SETTINGS }
    error.value = null
    lastEliminated.value = null
    gameOverData.value = null
    powerUps.value = []
    positions.value = new Map()
    router.push('/')
  }

  function clearError() {
    error.value = null
  }

  // --- Helpers ---
  function applyGameState(state: GameState) {
    players.value = state.players
    phase.value = state.phase
    potatoDeadline.value = state.potatoDeadline
    roundDuration.value = state.roundDuration
    if (state.settings) settings.value = state.settings
    if (state.powerUps) powerUps.value = state.powerUps
  }

  function initPositionsFromPlayers(statePlayers: Player[]) {
    const myId = getSocket().id
    for (const p of statePlayers) {
      if (p.id !== myId) {
        positions.value.set(p.id, { x: p.x, y: p.y })
      }
    }
  }

  function syncMyPlayer() {
    if (!myPlayer.value) return
    const updated = players.value.find(p => p.id === myPlayer.value!.id)
    if (updated) myPlayer.value = { ...updated }
  }

  return {
    roomId, myPlayer, players, phase, potatoDeadline,
    roundDuration, settings, error, lastEliminated, gameOverData,
    positions, powerUps,
    alivePlayers, iAmHost, iHavePotato, canStart, mySocketId,
    createRoom, joinRoom, startGame, passPotato, restartGame, returnToLobby,
    updateSettings, movePlayer, collectPowerUp, useFreezeCharge, clearError, leaveRoom,
  }
})
