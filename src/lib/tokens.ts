// Lit les variables CSS de :root pour que la scène 3D utilise la même palette que l'interface.
export function readTokens() {
  const css = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    night: get('--night', '#140b0d'),
    envelope: get('--envelope', '#2a2526'),
    envelopeShade: get('--envelope-shade', '#1f1b1c'),
    lining: get('--lining', '#b84a5c'),
    wax: get('--wax', '#c2364f'),
    paper: get('--paper', '#f3e9da'),
    ink: get('--ink', '#3a2428'),
    roseInk: get('--rose-ink', '#a3263d'),
  }
}

export type Tokens = ReturnType<typeof readTokens>

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
