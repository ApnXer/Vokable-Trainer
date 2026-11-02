/* Tastenbelegung der Karteikarten: Pfeiltasten und WASD (W/S bzw. ↑/↓ und Leertaste drehen um) */
const k = (e: KeyboardEvent) => e.key.toLowerCase()

export const nextKey = (e: KeyboardEvent) => e.key === 'ArrowRight' || k(e) === 'd'
export const prevKey = (e: KeyboardEvent) => e.key === 'ArrowLeft' || k(e) === 'a'
export const flipKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || k(e) === 'w' || k(e) === 's'

export const typingTarget = (e: KeyboardEvent) => !!(e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]')
