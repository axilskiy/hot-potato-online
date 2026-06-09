<template>
  <div
    v-if="visible"
    class="joystick-wrapper"
    @pointerdown.prevent="onPointerDown"
    @pointermove.prevent="onPointerMove"
    @pointerup.prevent="onPointerUp"
    @pointercancel.prevent="onPointerUp"
  >
    <div class="joystick-base">
      <div
        class="joystick-knob"
        :style="{ transform: `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDevice } from '@/composables/useDevice'

const props = withDefaults(defineProps<{
  touchControls?: 'auto' | 'on' | 'off'
}>(), {
  touchControls: 'auto',
})

const emit = defineEmits<{
  (e: 'move', dir: { x: number; y: number }): void
}>()

const { isMobile } = useDevice()

const visible = computed(() => {
  if (props.touchControls === 'off') return false
  if (props.touchControls === 'on') return true
  return isMobile  // 'auto': show only on mobile/touch devices
})

const JOYSTICK_R = 44
const knobX = ref(0)
const knobY = ref(0)
let activePointerId: number | null = null
let baseX = 0
let baseY = 0

function onPointerDown(e: PointerEvent) {
  if (activePointerId !== null) return
  activePointerId = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  baseX = rect.left + rect.width / 2
  baseY = rect.top + rect.height / 2
  updateDirection(e.clientX, e.clientY)
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerId !== activePointerId) return
  updateDirection(e.clientX, e.clientY)
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== activePointerId) return
  activePointerId = null
  knobX.value = 0
  knobY.value = 0
  emit('move', { x: 0, y: 0 })
}

function updateDirection(cx: number, cy: number) {
  let dx = cx - baseX
  let dy = cy - baseY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > JOYSTICK_R) {
    dx = (dx / dist) * JOYSTICK_R
    dy = (dy / dist) * JOYSTICK_R
  }
  knobX.value = dx
  knobY.value = dy
  emit('move', { x: dx / JOYSTICK_R, y: dy / JOYSTICK_R })
}
</script>

<style scoped>
.joystick-wrapper {
  position: fixed;
  bottom: 24px;
  left: 24px;
  width: 110px;
  height: 110px;
  z-index: 100;
  touch-action: none;
  user-select: none;
}

.joystick-base {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 2px solid rgba(255, 255, 255, 0.15);
  position: relative;
}

.joystick-knob {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.28);
  border: 2px solid rgba(255, 255, 255, 0.5);
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: background 0.1s;
}
</style>
