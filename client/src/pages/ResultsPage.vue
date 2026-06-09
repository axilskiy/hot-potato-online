<template>
  <div class="page results-page">
    <div class="card results-card">
      <div class="trophy">🏆</div>
      <h2 class="title">Победитель!</h2>

      <!-- Winner highlight -->
      <div class="winner-box">
        <span class="winner-avatar">{{ winnerPlayer?.avatar }}</span>
        <span class="winner-name">{{ store.gameOverData?.winner }}</span>
      </div>

      <!-- Placement awards this game -->
      <div v-if="placements.length" class="placements">
        <h3>Результаты игры</h3>
        <div v-for="(entry, i) in placements" :key="i" class="placement-row">
          <span class="place-medal">{{ MEDALS[i] }}</span>
          <span class="place-avatar">{{ entry.avatar }}</span>
          <span class="place-name">{{ entry.nickname }}</span>
          <span class="place-points">+{{ POINTS[i] }}</span>
        </div>
      </div>

      <!-- Cumulative scoreboard -->
      <div v-if="sortedByScore.length" class="scoreboard">
        <h3>Таблица очков</h3>
        <div v-for="(p, i) in sortedByScore" :key="p.id" class="score-row">
          <span class="score-rank">#{{ i + 1 }}</span>
          <span class="score-avatar">{{ p.avatar }}</span>
          <span class="score-name">{{ p.nickname }}</span>
          <span class="score-pts">{{ p.score }} ★</span>
        </div>
      </div>

      <div class="actions">
        <template v-if="store.iAmHost">
          <button class="btn btn-primary" @click="store.restartGame()">
            Играть снова
          </button>
          <button class="btn btn-secondary" @click="store.returnToLobby()">
            Вернуться в лобби
          </button>
        </template>
        <p v-else class="hint">Ждём решения хоста...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

const MEDALS = ['🥇', '🥈', '🥉']
const POINTS = [3, 2, 1]

const placements = computed(() => {
  const data = store.gameOverData
  if (!data) return []
  const result = []

  const wp = data.players.find(p => p.nickname === data.winner)
  if (wp) result.push({ nickname: wp.nickname, avatar: wp.avatar })

  const reversed = [...data.eliminatedOrder].reverse()
  for (const name of reversed) {
    if (result.length >= 3) break
    const p = data.players.find(pl => pl.nickname === name)
    if (p) result.push({ nickname: p.nickname, avatar: p.avatar })
  }

  return result
})

const winnerPlayer = computed(() =>
  store.gameOverData?.players.find(p => p.nickname === store.gameOverData?.winner)
)

const sortedByScore = computed(() =>
  [...(store.gameOverData?.players ?? [])].sort((a, b) => b.score - a.score)
)
</script>

<style scoped>
.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
}

.btn-secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.65);
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  font-family: inherit;
  width: 100%;
}

.btn-secondary:hover {
  border-color: rgba(255, 255, 255, 0.5);
  color: rgba(255, 255, 255, 0.9);
}
</style>
