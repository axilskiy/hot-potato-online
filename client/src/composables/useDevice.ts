export function useDevice() {
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
  const hasTouchStart   = 'ontouchstart' in window
  const hasTouchPoints  = navigator.maxTouchPoints > 0
  const isNarrowScreen  = window.innerWidth <= 768

  const isTouchDevice = isCoarsePointer || hasTouchStart || hasTouchPoints
  const isMobile      = isTouchDevice && isNarrowScreen
  const isDesktop     = !isTouchDevice

  return { isMobile, isTouchDevice, isDesktop }
}
