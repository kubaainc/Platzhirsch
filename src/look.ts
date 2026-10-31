export const LOOKS = { kontor: 'Kontor', tintenblau: 'Tintenblau' } as const
export type Look = keyof typeof LOOKS
const KEY = 'platzhirsch-look'

export function getLook(): Look {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'kontor' || v === 'tintenblau') return v
  } catch { /* Speicher gesperrt: Standard */ }
  return 'kontor'
}

export function setLook(l: Look) {
  document.documentElement.dataset.look = l
  try { localStorage.setItem(KEY, l) } catch { /* nur nicht merken */ }
}
