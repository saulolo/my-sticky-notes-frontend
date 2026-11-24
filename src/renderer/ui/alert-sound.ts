// Sonido del aviso por hora (SPEC 11). El usuario pone su mp3 en
// `src/renderer/assets/sounds/task-alert.mp3`. Con `import.meta.glob` la ausencia del archivo no
// rompe el build: simplemente no suena.
const soundUrl = Object.values(
  import.meta.glob<string>('../assets/sounds/task-alert.mp3', {
    eager: true,
    query: '?url',
    import: 'default'
  })
)[0]

let audio: HTMLAudioElement | null = null

/** Reproduce el mp3 una vez desde el principio. No hace nada sin archivo; ignora fallos de `play()`. */
export function playAlert(): void {
  if (!soundUrl) return
  try {
    audio ??= new Audio(soundUrl)
    audio.currentTime = 0
    audio.play().catch(() => undefined)
  } catch {
    // Sin audio disponible: el aviso sigue siendo silencioso.
  }
}
