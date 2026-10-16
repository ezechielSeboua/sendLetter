import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { prefersReducedMotion } from '../lib/tokens'

export interface Point {
  x: number
  y: number
}

export interface HammerHandle {
  /** Va jusqu'à la cible (depuis `from` ou la position du curseur), frappe, et se résout à l'impact. */
  strike: (target: Point, from?: Point) => Promise<void>
}

interface Props {
  ref?: Ref<HammerHandle>
  active: boolean // l'enveloppe est fermée : le marteau sert de curseur
  ready: boolean // survol de l'enveloppe : le marteau se lève légèrement
}

// Point de frappe (face inférieure de la tête) dans la boîte de 64 px du marteau
const HOT = { x: 19, y: 39 } // (15.7, 32.5) dans le viewBox 80, rendu à 96 px
const SWING_MS = 440
const IMPACT_AT = 0.68 // part de la frappe où la tête touche le sceau

export function Hammer({ ref, active, ready }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const swingRef = useRef<SVGSVGElement>(null)
  const pos = useRef<Point>({ x: -200, y: -200 })
  const busy = useRef(false)
  const [striking, setStriking] = useState(false)
  const [finePointer] = useState(() => window.matchMedia('(pointer: fine)').matches)

  const place = (p: Point) => {
    pos.current = p
    if (rootRef.current) rootRef.current.style.transform = `translate(${p.x - HOT.x}px, ${p.y - HOT.y}px)`
  }

  // Le marteau suit le pointeur (souris uniquement)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || busy.current) return
      place({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  // Masque le curseur système tant que le marteau le remplace
  const visible = (active && finePointer) || striking
  useEffect(() => {
    document.body.dataset.hammer = String(active && finePointer)
  }, [active, finePointer])

  useImperativeHandle(ref, () => ({
    strike: (target, from) =>
      new Promise<void>((resolve) => {
        const root = rootRef.current
        const swing = swingRef.current
        if (!root || !swing || prefersReducedMotion()) {
          place(target)
          return resolve()
        }
        busy.current = true
        setStriking(true)
        const start = from ?? pos.current
        const dist = Math.hypot(target.x - start.x, target.y - start.y)

        const doSwing = () => {
          place(target)
          // Élan (la tête se lève), puis frappe sèche vers le bas, puis léger rebond
          const anim = swing.animate(
            [
              { transform: 'rotate(0deg)' },
              { transform: 'rotate(55deg)', offset: 0.45, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
              { transform: 'rotate(-9deg)', offset: IMPACT_AT, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
              { transform: 'rotate(4deg)', offset: 0.85 },
              { transform: 'rotate(0deg)' },
            ],
            { duration: SWING_MS, easing: 'cubic-bezier(0.33, 0, 0.2, 1)' },
          )
          window.setTimeout(() => {
            impactRing(target)
            resolve()
          }, SWING_MS * IMPACT_AT)
          anim.onfinish = () => {
            busy.current = false
            setStriking(false)
          }
        }

        if (dist < 6) return doSwing()
        // Trajet en arc jusqu'au sceau
        const mid = { x: (start.x + target.x) / 2, y: Math.min(start.y, target.y) - Math.min(90, dist * 0.3) }
        const tf = (p: Point) => `translate(${p.x - HOT.x}px, ${p.y - HOT.y}px)`
        const glide = root.animate(
          [
            { transform: tf(start), opacity: from ? 0 : 1 },
            { transform: tf(mid), opacity: 1, offset: 0.5 },
            { transform: tf(target), opacity: 1 },
          ],
          { duration: Math.min(620, 320 + dist * 0.5), easing: 'cubic-bezier(0.65, 0, 0.35, 1)' },
        )
        glide.onfinish = doSwing
      }),
  }))

  return (
    <div
      ref={rootRef}
      className="hammer"
      data-visible={visible}
      data-ready={ready && !striking}
      aria-hidden="true"
    >
      <svg ref={swingRef} className="hammer-swing" viewBox="0 0 80 80" width="96" height="96">
        <defs>
          <linearGradient id="hm-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a8714c" />
            <stop offset="1" stopColor="#5e3a25" />
          </linearGradient>
          <linearGradient id="hm-steel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e9e2da" />
            <stop offset="0.5" stopColor="#a39b94" />
            <stop offset="1" stopColor="#5f5853" />
          </linearGradient>
        </defs>
        <g transform="rotate(18 72 34)">
          {/* manche */}
          <rect x="24" y="30" width="52" height="8" rx="4" fill="url(#hm-wood)" />
          {/* poignée gainée, couleur cire */}
          <rect x="56" y="29" width="20" height="10" rx="5" fill="#8e1f33" />
          <path d="M60 29v10M65 29v10M70 29v10" stroke="#6a1526" strokeWidth="1.2" />
          {/* tête en acier, face de frappe en bas */}
          <rect x="9" y="12" width="18" height="37" rx="3" fill="url(#hm-steel)" stroke="#3b3532" strokeWidth="1.2" />
          <rect x="8" y="44" width="20" height="6" rx="2" fill="#4a4440" />
          <rect x="12" y="15" width="3" height="26" rx="1.5" fill="#fff" opacity="0.45" />
        </g>
      </svg>
    </div>
  )
}

function impactRing(p: Point) {
  const el = document.createElement('div')
  el.className = 'impact-ring'
  el.setAttribute('aria-hidden', 'true')
  el.style.left = `${p.x}px`
  el.style.top = `${p.y}px`
  document.body.appendChild(el)
  const a = el.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0.9 },
      { transform: 'translate(-50%, -50%) scale(1.7)', opacity: 0 },
    ],
    { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  )
  a.onfinish = a.oncancel = () => el.remove()
}
