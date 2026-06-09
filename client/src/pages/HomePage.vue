<template>
  <div class="page home-page">
    <div class="card">
      <h1 class="title">🥔 Hot Potato Online</h1>

      <div class="field">
        <label>Твой никнейм</label>
        <input
          v-model="nickname"
          type="text"
          placeholder="Введи никнейм..."
          maxlength="20"
          @keyup.enter="handleCreate"
        />
      </div>

      <div class="field">
        <label>Выбери персонажа</label>
        <div class="avatar-grid">
          <button
            v-for="av in AVATARS"
            :key="av"
            class="avatar-btn"
            :class="{ selected: avatar === av }"
            @click="avatar = av"
          >{{ av }}</button>
        </div>
      </div>

      <p v-if="store.error" class="error">{{ store.error }}</p>

      <div class="actions">
        <button class="btn btn-primary" :disabled="!nickname.trim()" @click="handleCreate">
          Создать комнату
        </button>
        <div class="divider">или</div>
        <div class="join-row">
          <input
            v-model="roomCode"
            type="text"
            placeholder="Код комнаты"
            maxlength="6"
            class="code-input"
            @keyup.enter="handleJoin"
          />
          <button class="btn btn-secondary" :disabled="!canJoin" @click="handleJoin">
            Войти
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const AVATARS = ['🐸', '🐔', '🐼', '🦆', '🤖', '👻', '🐯', '🦁', '🐻', '🦊']

const store = useGameStore()
const nickname = ref('')
const roomCode = ref('')
const avatar = ref('🐸')

const canJoin = computed(() => nickname.value.trim() && roomCode.value.trim().length === 6)

function handleCreate() {
  if (!nickname.value.trim()) return
  store.clearError()
  store.createRoom(nickname.value.trim(), avatar.value)
}

function handleJoin() {
  if (!canJoin.value) return
  store.clearError()
  store.joinRoom(roomCode.value.trim().toUpperCase(), nickname.value.trim(), avatar.value)
}
</script>
