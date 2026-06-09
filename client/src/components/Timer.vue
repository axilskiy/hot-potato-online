<template>
  <div class="timer" :class="urgencyClass">
    <div class="timer-bar-bg">
      <div class="timer-bar" :style="{ width: barWidth + '%' }" />
    </div>
    <div class="timer-text">{{ displaySeconds }}s</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps<{
  deadline: number | null
  duration: number
}>()

const remaining = ref(0)
let intervalId: ReturnType<typeof setInterval> | null = null

function tick() {
  if (!props.deadline) {
    remaining.value = 0
    return
  }
  const diff = Math.max(0, props.deadline - Date.now())
  remaining.value = Math.ceil(diff / 1000)
}

watch(
  () => props.deadline,
  (val) => {
    if (intervalId) clearInterval(intervalId)
    if (!val) { remaining.value = 0; return }
    tick()
    intervalId = setInterval(tick, 200)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})

const displaySeconds = computed(() => remaining.value)
const barWidth = computed(() => {
  if (!props.duration || !props.deadline) return 0
  return Math.max(0, (remaining.value / props.duration) * 100)
})
const urgencyClass = computed(() => {
  if (remaining.value <= 3) return 'urgent'
  if (remaining.value <= 6) return 'warning'
  return ''
})
</script>
