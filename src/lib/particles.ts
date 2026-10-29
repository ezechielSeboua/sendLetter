import { prefersReducedMotion } from './tokens'

export type ParticleEffect = 'embers' | 'confetti' | 'hearts'

export const HEART_PATH =
  'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z'

const SVG_NS = 'http://www.w3.org/2000/svg'

// Étincelles dramatiques
function burstEmbers(origin: HTMLElement) {
  const r = origin.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const reduced = prefersReducedMotion()
  const count = reduced ? 5 : 40
  const colors = ['#ff4500', '#ff8c00', '#ffd700', '#990000', '#ff0000']

  for (let i = 0; i < count; i++) {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('aria-hidden', 'true')
    svg.classList.add('heart-particle')

    const shape = document.createElementNS(SVG_NS, 'circle')
    shape.setAttribute('cx', '12')
    shape.setAttribute('cy', '12')
    shape.setAttribute('r', '8')

    svg.appendChild(shape)
    const size = 0.2 + Math.random() * 0.4
    svg.style.fill = colors[Math.floor(Math.random() * colors.length)]
    document.body.appendChild(svg)

    const start = `translate(${cx - 9}px, ${cy - 9}px)`
    const anim = reduced
      ? svg.animate(
          [
            { transform: `${start} scale(1)`, opacity: 1 },
            { transform: `${start} scale(1)`, opacity: 0 },
          ],
          { duration: 700, easing: 'linear' },
        )
      : (() => {
          const angle = (Math.random() * Math.PI * 2)
          const dist = 40 + Math.random() * 150
          const dx = Math.cos(angle) * dist
          const dy = Math.sin(angle) * dist - 80 // Fly upwards
          return svg.animate(
            [
              { transform: `${start} scale(0.1)`, opacity: 0, filter: 'blur(0px)' },
              { transform: `${start} translate(${dx * 0.3}px, ${dy * 0.3}px) scale(${size})`, opacity: 1, offset: 0.2, filter: 'blur(2px)' },
              { transform: `${start} translate(${dx}px, ${dy}px) scale(0)`, opacity: 0, filter: 'blur(4px)' },
            ],
            { duration: 1000 + Math.random() * 1000, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
          )
        })()
    anim.onfinish = () => svg.remove()
    anim.oncancel = () => svg.remove()
  }
}

// Confettis qui éclatent
function burstConfetti(origin: HTMLElement) {
  const r = origin.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const reduced = prefersReducedMotion()
  const count = reduced ? 3 : 24
  const colors = ['#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#a855f7']

  for (let i = 0; i < count; i++) {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('aria-hidden', 'true')
    svg.classList.add('heart-particle') // on réutilise la classe pour les dimensions

    const shape = document.createElementNS(SVG_NS, Math.random() > 0.5 ? 'rect' : 'circle')
    if (shape.tagName === 'rect') {
      shape.setAttribute('width', '12')
      shape.setAttribute('height', '12')
      shape.setAttribute('x', '6')
      shape.setAttribute('y', '6')
      shape.setAttribute('rx', '2')
    } else {
      shape.setAttribute('cx', '12')
      shape.setAttribute('cy', '12')
      shape.setAttribute('r', '8')
    }

    svg.appendChild(shape)
    const size = 0.5 + Math.random() * 0.8
    svg.style.fill = colors[Math.floor(Math.random() * colors.length)]
    document.body.appendChild(svg)

    const start = `translate(${cx - 9}px, ${cy - 9}px)`
    const anim = reduced
      ? svg.animate(
          [
            { transform: `${start} scale(1)`, opacity: 1 },
            { transform: `${start} scale(1)`, opacity: 0 },
          ],
          { duration: 700, easing: 'linear' },
        )
      : (() => {
          const angle = (Math.random() * Math.PI * 2)
          const dist = 60 + Math.random() * 120
          const dx = Math.cos(angle) * dist
          const dy = Math.sin(angle) * dist - 40
          const rot = (Math.random() - 0.5) * 360
          return svg.animate(
            [
              { transform: `${start} scale(0.2) rotate(0deg)`, opacity: 0 },
              { transform: `${start} translate(${dx * 0.7}px, ${dy * 0.7}px) scale(${size}) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.4 },
              { transform: `${start} translate(${dx}px, ${dy + 60}px) scale(${size * 0.8}) rotate(${rot}deg)`, opacity: 0 },
            ],
            { duration: 850 + Math.random() * 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
          )
        })()
    anim.onfinish = () => svg.remove()
    anim.oncancel = () => svg.remove()
  }
}

// Cœurs qui éclatent depuis le bouton : chaque clic lance sa propre gerbe, indépendante des autres.
function burstHearts(origin: HTMLElement) {
  const r = origin.getBoundingClientRect()
  const cx = r.left + r.width * 0.8
  const cy = r.top + r.height / 2
  const reduced = prefersReducedMotion()
  const count = reduced ? 1 : 12

  for (let i = 0; i < count; i++) {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('aria-hidden', 'true')
    svg.classList.add('heart-particle')
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', HEART_PATH)
    svg.appendChild(path)
    const size = 0.6 + Math.random() * 0.9
    if (i % 3 === 1) svg.style.fill = '#e0657a'
    if (i % 3 === 2) svg.style.fill = '#a3263d'
    document.body.appendChild(svg)

    const start = `translate(${cx - 9}px, ${cy - 9}px)`
    const anim = reduced
      ? svg.animate(
          [
            { transform: `${start} scale(1)`, opacity: 1 },
            { transform: `${start} scale(1)`, opacity: 0 },
          ],
          { duration: 700, easing: 'linear' },
        )
      : (() => {
          // Gerbe orientée vers le haut, puis légère retombée
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1
          const dist = 60 + Math.random() * 90
          const dx = Math.cos(angle) * dist
          const dy = Math.sin(angle) * dist
          const rot = (Math.random() - 0.5) * 70
          return svg.animate(
            [
              { transform: `${start} scale(0.2) rotate(0deg)`, opacity: 0 },
              { transform: `${start} translate(${dx * 0.7}px, ${dy * 0.7}px) scale(${size}) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.4 },
              { transform: `${start} translate(${dx}px, ${dy + 34}px) scale(${size * 0.8}) rotate(${rot}deg)`, opacity: 0 },
            ],
            { duration: 850 + Math.random() * 350, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
          )
        })()
    anim.onfinish = () => svg.remove()
    anim.oncancel = () => svg.remove()
  }
}

export const burst: Record<ParticleEffect, (origin: HTMLElement) => void> = {
  embers: burstEmbers,
  confetti: burstConfetti,
  hearts: burstHearts,
}
