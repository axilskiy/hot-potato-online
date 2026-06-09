<template>
  <div class="page lobby-page">
    <div class="card">
      <h2 class="title">Лобби</h2>

      <div class="room-code">
        <span class="label">Код комнаты</span>
        <div class="code" @click="copyCode" title="Нажми чтобы скопировать">
          {{ store.roomId }}
          <span class="copy-hint">{{ copied ? '✓' : '⧉' }}</span>
        </div>
      </div>

      <div class="player-section">
        <h3>Игроки ({{ store.players.length }} / {{ store.settings.maxPlayers }})</h3>
        <ul class="player-list">
          <li v-for="p in store.players" :key="p.id" class="player-item">
            <span class="player-name">
              <span class="player-avatar-sm">{{ p.avatar }}</span>
              {{ p.nickname }}
              <span v-if="p.isHost" class="badge host">хост</span>
              <span v-if="p.id === store.myPlayer?.id" class="badge me">ты</span>
            </span>
            <span v-if="p.score > 0" class="player-score">{{ p.score }} ★</span>
          </li>
        </ul>
      </div>

      <!-- Settings panel -->
      <div class="settings-panel">
        <h3 class="settings-title">Настройки</h3>

        <div class="setting-row">
          <span class="setting-label">Длительность раунда</span>
          <div v-if="store.iAmHost" class="setting-options">
            <button
              v-for="d in ROUND_DURATIONS"
              :key="d"
              :class="['opt-btn', { active: store.settings.roundDuration === d }]"
              @click="changeSetting('roundDuration', d)"
            >{{ d }}с</button>
          </div>
          <span v-else class="setting-value">{{ store.settings.roundDuration }}с</span>
        </div>

        <div class="setting-row">
          <span class="setting-label">Макс. игроков</span>
          <div v-if="store.iAmHost" class="setting-options">
            <button
              v-for="n in MAX_PLAYERS_OPTIONS"
              :key="n"
              :class="['opt-btn', { active: store.settings.maxPlayers === n }]"
              @click="changeSetting('maxPlayers', n)"
            >{{ n }}</button>
          </div>
          <span v-else class="setting-value">{{ store.settings.maxPlayers }}</span>
        </div>

        <div class="setting-row">
          <span class="setting-label">Сенсорное управление</span>
          <div v-if="store.iAmHost" class="setting-options">
            <button
              v-for="t in TOUCH_OPTIONS"
              :key="t"
              :class="['opt-btn', { active: store.settings.touchControls === t }]"
              @click="changeSetting('touchControls', t)"
            >{{ TOUCH_LABELS[t] }}</button>
          </div>
          <span v-else class="setting-value">{{ TOUCH_LABELS[store.settings.touchControls] }}</span>
        </div>
      </div>

      <p v-if="store.players.length < 3" class="hint">
        Нужно ещё {{ 3 - store.players.length }} игрок(ов) для старта
      </p>

      <button
        v-if="store.iAmHost"
        class="btn btn-primary"
        :disabled="!store.canStart"
        @click="store.startGame()"
      >
        Начать игру
      </button>

      <p v-else class="hint">Ждём хоста...</p>

      <button class="btn btn-leave" @click="store.leaveRoom()">
        Выйти
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { RoomSettings } from '@/types'

const store = useGameStore()
const copied = ref(false)

const ROUND_DURATIONS = [10, 15, 20, 30] as const
const MAX_PLAYERS_OPTIONS = [3, 4, 6, 8, 10] as const
const TOUCH_OPTIONS = ['auto', 'on', 'off'] as const

const TOUCH_LABELS: Record<string, string> = {
  auto: 'Авто',
  on: 'Вкл',
  off: 'Выкл',
}

function changeSetting(key: keyof RoomSettings, value: RoomSettings[typeof key]) {
  store.updateSettings({ [key]: value })
}

function copyCode() {
  if (!store.roomId) return
  navigator.clipboard.writeText(store.roomId)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<style scoped>
.settings-panel {
  margin: 16px 0;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.settings-title {
  margin: 0 0 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.setting-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  min-width: 150px;
  flex-shrink: 0;
}

.setting-options {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.opt-btn {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  font-family: inherit;
}

.opt-btn:hover {
  border-color: rgba(255, 255, 255, 0.35);
  color: rgba(255, 255, 255, 0.85);
}

.opt-btn.active {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.18);
  color: #7ecf82;
}

.setting-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

.btn-leave {
  margin-top: 10px;
  width: 100%;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.btn-leave:hover {
  border-color: #e94560;
  color: #e94560;
  background: rgba(233, 69, 96, 0.08);
}
</style>
