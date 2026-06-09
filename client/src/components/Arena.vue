<template>
  <div class="arena-wrapper">
    <!-- HUD -->
    <div class="arena-hud">
      <Timer
        v-if="store.phase === 'playing' || store.phase === 'roundEnd'"
        :deadline="store.potatoDeadline"
        :duration="store.roundDuration"
        class="arena-timer"
      />
      <div class="hud-status">
        <template v-if="store.phase === 'playing'">
          <span v-if="store.iHavePotato" class="hud-danger">🥔 БЕГИ от игроков!</span>
          <span v-else-if="myIsAlive" class="hud-safe">Догони {{ potatoHolderName }}!</span>
          <span v-else class="hud-spectator">👻 Ты зритель</span>
        </template>
        <span v-else-if="store.phase === 'roundEnd'" class="hud-explosion">
          💥 {{ store.lastEliminated }} выбыл(а)!
        </span>
      </div>
      <div class="hud-right">
        <div class="hud-alive">{{ aliveCount }}/{{ store.players.length }} 💚</div>
        <div v-if="myEffects.length" class="hud-effects">
          <span v-for="fx in myEffects" :key="fx" class="hud-effect-badge">{{ fx }}</span>
        </div>
      </div>
    </div>

    <!-- Canvas arena -->
    <div class="canvas-container">
      <canvas ref="canvasRef" :width="ARENA_W" :height="ARENA_H" class="arena-canvas" />
    </div>

    <!-- Controls hint -->
    <div class="arena-hint">WASD / ↑↓←→ или джойстик — движение &nbsp;|&nbsp; коснись игрока с картошкой — передашь!</div>

    <!-- Mobile joystick (fixed position, visibility controlled by touchControls setting) -->
    <MobileJoystick
      :touch-controls="store.settings.touchControls"
      @move="onJoystickMove"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import Timer from './Timer.vue'
import MobileJoystick from './MobileJoystick.vue'
import type { Player } from '@/types'

const store = useGameStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

const ARENA_W = 800
const ARENA_H = 500
const PLAYER_R = 24
const POWERUP_R = 16
const SPEED = 190
const SEND_INTERVAL = 50

const PLAYER_COLORS = [
  '#e94560', '#f5a623', '#4caf50', '#2196f3',
  '#9c27b0', '#ff9800', '#00bcd4', '#ff6b6b',
]

const myX = ref(400)
const myY = ref(250)

const keys = new Set<string>()
let rafId: number | null = null
let lastTs = 0
let lastSendTime = 0
let lastPassTime = -2000
let lastFreezeUseTime = -3000
let lastCollectTime = -500
// Track already-sent collect requests to avoid duplicates before server confirms
const pendingCollects = new Set<string>()

const joystickDir = { x: 0, y: 0 }

function onJoystickMove(dir: { x: number; y: number }) {
  joystickDir.x = dir.x
  joystickDir.y = dir.y
}

const myIsAlive    = computed(() => store.myPlayer?.isAlive ?? false)
const aliveCount   = computed(() => store.players.filter(p => p.isAlive).length)
const potatoHolderName = computed(() => {
  const h = store.players.find(p => p.hasPotato)
  return h ? `${h.avatar} ${h.nickname}` : '?'
})

const myEffects = computed(() => {
  const me = store.myPlayer
  if (!me) return []
  const now = Date.now()
  const fx: string[] = []
  if (me.speedUntil && me.speedUntil > now)   fx.push('⚡ Скорость')
  if (me.shieldUntil && me.shieldUntil > now) fx.push('🛡 Щит')
  if (me.hasFreezeCharge)                     fx.push('❄ Заморозка')
  if (me.freezeUntil && me.freezeUntil > now) fx.push('🧊 Заморожен')
  return fx
})

function getPlayerColor(playerId: string): string {
  const idx = store.players.findIndex(p => p.id === playerId)
  return PLAYER_COLORS[Math.max(0, idx) % PLAYER_COLORS.length]
}

// ─── Drawing ────────────────────────────────────────────────────────────────

function drawPowerUps() {
  if (!ctx) return
  const now = Date.now()
  for (const pu of store.powerUps) {
    const pulse = 0.7 + 0.3 * Math.sin(now / 400 + pu.x)
    const glowColor = pu.type === 'speed'  ? '#2196f3' :
                      pu.type === 'shield' ? '#9c27b0' : '#00bcd4'
    const bgColor   = pu.type === 'speed'  ? `rgba(33,150,243,${0.25 * pulse})` :
                      pu.type === 'shield' ? `rgba(156,39,176,${0.25 * pulse})` :
                                             `rgba(0,188,212,${0.25 * pulse})`
    const emoji     = pu.type === 'speed' ? '⚡' : pu.type === 'shield' ? '🛡' : '❄️'

    ctx.save()
    ctx.shadowColor = glowColor
    ctx.shadowBlur = 18 * pulse

    ctx.beginPath()
    ctx.arc(pu.x, pu.y, POWERUP_R, 0, Math.PI * 2)
    ctx.fillStyle = bgColor
    ctx.fill()
    ctx.strokeStyle = glowColor
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.shadowBlur = 0
    ctx.font = '16px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, pu.x, pu.y)

    ctx.restore()
  }
}

function draw() {
  if (!ctx) return

  ctx.fillStyle = '#0d2b0d'
  ctx.fillRect(0, 0, ARENA_W, ARENA_H)

  ctx.strokeStyle = '#113311'
  ctx.lineWidth = 1
  for (let x = 50; x < ARENA_W; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke()
  }
  for (let y = 50; y < ARENA_H; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke()
  }

  ctx.shadowColor = '#2a8a2a'
  ctx.shadowBlur = 12
  ctx.strokeStyle = '#3a7a3a'
  ctx.lineWidth = 5
  ctx.strokeRect(2.5, 2.5, ARENA_W - 5, ARENA_H - 5)
  ctx.shadowBlur = 0

  drawPowerUps()

  for (const player of store.players) {
    if (player.id === store.mySocketId) continue
    const pos = store.positions.get(player.id)
    const x = pos?.x ?? player.x
    const y = pos?.y ?? player.y
    drawPlayer(x, y, player, false)
  }

  const me = store.myPlayer
  if (me) {
    drawPlayer(myX.value, myY.value, me, true)
  }
}

function drawPlayer(x: number, y: number, player: Player, isMe: boolean) {
  if (!ctx) return
  const alive = player.isAlive
  const hasPotato = player.hasPotato
  const color = getPlayerColor(player.id)
  const now = Date.now()

  const hasSpeed  = !!(player.speedUntil  && player.speedUntil  > now)
  const hasShield = !!(player.shieldUntil && player.shieldUntil > now)
  const isFrozen  = !!(player.freezeUntil && player.freezeUntil > now)
  const hasFreeze = !!player.hasFreezeCharge

  ctx.save()
  ctx.globalAlpha = alive ? 1 : 0.32

  // Speed glow (blue)
  if (hasSpeed && alive) {
    ctx.shadowColor = '#2196f3'
    ctx.shadowBlur = 22
  } else if (hasPotato) {
    ctx.shadowColor = '#f5a623'
    ctx.shadowBlur = 30
  }

  ctx.beginPath()
  ctx.arc(x, y, PLAYER_R, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(255,255,255,0.45)'
  ctx.lineWidth = isMe ? 3 : 1.5
  ctx.stroke()

  ctx.shadowBlur = 0

  // Freeze overlay
  if (isFrozen && alive) {
    ctx.beginPath()
    ctx.arc(x, y, PLAYER_R, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,188,212,0.45)'
    ctx.fill()
  }

  ctx.font = `${PLAYER_R - 2}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(alive ? (player.avatar || '😊') : '💀', x, y)

  if (hasPotato) {
    ctx.font = '14px serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('🥔', x + PLAYER_R - 4, y - PLAYER_R + 4)
  }

  // Shield ring
  if (hasShield && alive) {
    ctx.beginPath()
    ctx.arc(x, y, PLAYER_R + 8, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(156,39,176,0.85)'
    ctx.lineWidth = 3
    ctx.shadowColor = '#9c27b0'
    ctx.shadowBlur = 14
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // Freeze charge indicator
  if (hasFreeze && alive) {
    ctx.font = '13px serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('❄️', x - PLAYER_R + 2, y - PLAYER_R - 2)
  }

  // Frozen indicator above player
  if (isFrozen && alive) {
    ctx.font = '13px serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('🧊', x + PLAYER_R - 4, y - PLAYER_R - 2)
  }

  ctx.font = `bold 11px "Segoe UI", system-ui, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'
  ctx.shadowBlur = 4
  ctx.fillText(player.nickname, x, y + PLAYER_R + 4)
  ctx.shadowBlur = 0

  if (isMe) {
    ctx.font = `10px "Segoe UI", system-ui, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText('(ты)', x, y + PLAYER_R + 17)
  }

  ctx.restore()
}

// ─── Game loop ───────────────────────────────────────────────────────────────

function gameLoop(ts: number) {
  if (!lastTs) lastTs = ts
  const dt = Math.min((ts - lastTs) / 1000, 0.05)
  lastTs = ts

  const me = store.myPlayer

  if (store.phase === 'playing' && me?.isAlive) {
    const now = Date.now()
    const isFrozen = !!(me.freezeUntil && me.freezeUntil > now)

    if (!isFrozen) {
      let dx = joystickDir.x
      let dy = joystickDir.y
      if (keys.has('w') || keys.has('arrowup'))    dy -= 1
      if (keys.has('s') || keys.has('arrowdown'))  dy += 1
      if (keys.has('a') || keys.has('arrowleft'))  dx -= 1
      if (keys.has('d') || keys.has('arrowright')) dx += 1

      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy)
        dx /= len; dy /= len
        const speed = (me.speedUntil && me.speedUntil > now) ? SPEED * 1.5 : SPEED
        myX.value = Math.max(PLAYER_R, Math.min(ARENA_W - PLAYER_R, myX.value + dx * speed * dt))
        myY.value = Math.max(PLAYER_R, Math.min(ARENA_H - PLAYER_R, myY.value + dy * speed * dt))

        if (ts - lastSendTime > SEND_INTERVAL) {
          store.movePlayer(myX.value, myY.value)
          lastSendTime = ts
        }
      }

      // Collect power-ups
      if (ts - lastCollectTime > 500) {
        for (const pu of store.powerUps) {
          if (pendingCollects.has(pu.id)) continue
          const dist = Math.hypot(myX.value - pu.x, myY.value - pu.y)
          if (dist < PLAYER_R + POWERUP_R) {
            pendingCollects.add(pu.id)
            store.collectPowerUp(pu.id)
            lastCollectTime = ts
            break
          }
        }
      }

      // Pass potato on collision
      if (store.iHavePotato && ts - lastPassTime > 900) {
        for (const player of store.players) {
          if (player.id === me.id || !player.isAlive) continue
          const pos = store.positions.get(player.id)
          const px = pos?.x ?? player.x
          const py = pos?.y ?? player.y
          const dist = Math.hypot(myX.value - px, myY.value - py)
          if (dist < PLAYER_R * 2.1) {
            store.passPotato(player.id)
            lastPassTime = ts
            break
          }
        }
      }

      // Use freeze charge on collision
      if (me.hasFreezeCharge && ts - lastFreezeUseTime > 1000) {
        for (const player of store.players) {
          if (player.id === me.id || !player.isAlive) continue
          const pos = store.positions.get(player.id)
          const px = pos?.x ?? player.x
          const py = pos?.y ?? player.y
          const dist = Math.hypot(myX.value - px, myY.value - py)
          if (dist < PLAYER_R * 2.1) {
            store.useFreezeCharge(player.id)
            lastFreezeUseTime = ts
            break
          }
        }
      }
    }
  }

  draw()
  rafId = requestAnimationFrame(gameLoop)
}

// ─── Event handlers ──────────────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent) {
  keys.add(e.key.toLowerCase())
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
    e.preventDefault()
  }
}

function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.key.toLowerCase())
}

// ─── Watchers ────────────────────────────────────────────────────────────────

watch(() => store.phase, (phase, oldPhase) => {
  if (phase === 'playing' && oldPhase !== 'playing') {
    const me = store.players.find(p => p.id === store.mySocketId)
    if (me) {
      myX.value = me.x
      myY.value = me.y
    }
    lastPassTime = -2000
    lastFreezeUseTime = -3000
    lastCollectTime = -500
    lastTs = 0
    pendingCollects.clear()
  }
})

watch(() => store.myPlayer?.hasPotato, (now, prev) => {
  if (now && !prev) {
    lastPassTime = performance.now()
  }
})

// Clear pending collects when server confirms power-up was removed
watch(() => store.powerUps, (newPUs) => {
  const newIds = new Set(newPUs.map(p => p.id))
  for (const id of pendingCollects) {
    if (!newIds.has(id)) pendingCollects.delete(id)
  }
}, { deep: true })

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
  ctx = canvasRef.value?.getContext('2d') ?? null

  const me = store.myPlayer
  if (me) {
    myX.value = me.x
    myY.value = me.y
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  rafId = requestAnimationFrame(gameLoop)
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<style scoped>
.hud-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.hud-effects {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.hud-effect-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
}
</style>
