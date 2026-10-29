import * as THREE from 'three'
import type { Tokens } from '../lib/tokens'

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

// Grain de papier : sert de bumpMap pour que l'enveloppe accroche la lumière comme une vraie fibre.
export function paperGrain() {
  const [c, ctx] = canvas(256, 256)
  const img = ctx.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.random() * 20
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  return t
}

// Empreinte du sceau : un cœur en relief. Les UV des faces d'un ExtrudeGeometry valent (x, y),
// on recadre donc la texture sur [-r, r] avec repeat/offset.
export function sealBump(radius: number) {
  const [c, ctx] = canvas(256, 256)
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, 256, 256)

  // Bourrelet de cire en bordure
  const ring = ctx.createRadialGradient(128, 128, 70, 128, 128, 128)
  ring.addColorStop(0, 'rgba(255,255,255,0)')
  ring.addColorStop(0.55, 'rgba(255,255,255,0.35)')
  ring.addColorStop(1, 'rgba(0,0,0,0.2)')
  ctx.fillStyle = ring
  ctx.fillRect(0, 0, 256, 256)

  // Creux circulaire du cachet
  ctx.beginPath()
  ctx.arc(128, 128, 78, 0, Math.PI * 2)
  ctx.fillStyle = '#5c5c5c'
  ctx.filter = 'blur(2px)'
  ctx.fill()

  // Cœur en relief (le canvas a l'axe y inversé par rapport à la texture : flipY le remet à l'endroit)
  ctx.save()
  ctx.translate(128, 132)
  ctx.scale(2.1, 2.1)
  ctx.beginPath()
  ctx.moveTo(0, 22)
  ctx.bezierCurveTo(-30, 2, -26, -22, -12, -22)
  ctx.bezierCurveTo(-5, -22, 0, -16, 0, -10)
  ctx.bezierCurveTo(0, -16, 5, -22, 12, -22)
  ctx.bezierCurveTo(26, -22, 30, 2, 0, 22)
  ctx.closePath()
  ctx.fillStyle = '#d8d8d8'
  ctx.fill()
  ctx.restore()
  ctx.filter = 'none'

  const t = new THREE.CanvasTexture(c)
  t.repeat.set(1 / (2 * radius), 1 / (2 * radius))
  t.offset.set(0.5, 0.5)
  return t
}

// Recto de la lettre vu en 3D : copie fidèle de la carte HTML (papier, lignes, titre, pied de page)
// dessinée à partir de sa mise en page réelle, pour que la 3D se fonde dans le HTML sans saut.
// Le corps du texte n'est pas dessiné : il s'écrit mot à mot une fois la carte affichée.
const HEART = new Path2D(
  'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z',
)

export function drawCard(card: HTMLElement, tokens: Tokens, target?: HTMLCanvasElement) {
  const box = card.getBoundingClientRect()
  const scale = Math.min(2, 2048 / Math.max(box.width, box.height))
  const w = Math.round(box.width * scale)
  const h = Math.round(box.height * scale)
  const c = target ?? document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  const bw = box.width
  const bh = box.height

  // Fond : radial-gradient(ellipse at 20% 0%, #fbf4e9, paper 55%, #e9dbc6)
  ctx.save()
  ctx.translate(bw * 0.2, 0)
  ctx.scale(bw * 0.8 * Math.SQRT2, bh * Math.SQRT2)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  g.addColorStop(0, '#fbf4e9')
  g.addColorStop(0.55, tokens.paper)
  g.addColorStop(1, '#e9dbc6')
  ctx.fillStyle = g
  ctx.fillRect(-1, -1, 3, 3)
  ctx.restore()

  // Textes visibles avant l'écriture : titre et boutons du pied de page
  const drawText = (el: Element | null, underline = false) => {
    if (!el) return
    const cs = getComputedStyle(el)
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim()
      if (!text) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      const r = range.getBoundingClientRect()
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      ctx.fillStyle = cs.color
      ctx.textBaseline = 'middle'
      ctx.fillText(text, r.left - box.left, r.top - box.top + r.height / 2)
      if (underline) ctx.fillRect(r.left - box.left, r.bottom - box.top + 1, ctx.measureText(text).width, 1)
    }
    const svg = el.querySelector('svg')
    if (svg) {
      const r = svg.getBoundingClientRect()
      ctx.save()
      ctx.translate(r.left - box.left, r.top - box.top)
      ctx.scale(r.width / 24, r.height / 24)
      ctx.fillStyle = cs.color
      ctx.fill(HEART)
      ctx.restore()
    }
  }
  drawText(card.querySelector('.letter-to'))
  drawText(card.querySelector('h2'))
  drawText(card.querySelector('.btn-love'))
  drawText(card.querySelector('.btn-close'), true)

  return { canvas: c, aspect: bw / bh, rect: box }
}

// Ombre douce projetée sur le "mur" derrière l'enveloppe (ombre cuite, pas d'ombre temps réel).
export function softShadow() {
  const [c, ctx] = canvas(256, 256)
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128)
  g.addColorStop(0, 'rgba(0,0,0,0.75)')
  g.addColorStop(0.5, 'rgba(0,0,0,0.35)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}
