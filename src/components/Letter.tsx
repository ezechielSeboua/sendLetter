import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/tokens'




// Mots qui sortent du flou l'un après l'autre (adaptation maison du "BlurText" de React Bits,
// en CSS pur : pas de dépendance d'animation en plus). Le texte complet reste lisible
// par les lecteurs d'écran grâce au span .sr-only ; les mots animés sont aria-hidden.
function BlurWords({ text }: { text: string }) {
  const words = text.split(' ')
  return (
    <p className="letter-body">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <span key={i} className="word" style={{ '--d': `${80 + i * 22}ms` } as React.CSSProperties}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    </p>
  )
}

// Étincelles dramatiques
function burstEmbers(origin: HTMLElement) {
  const r = origin.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const reduced = prefersReducedMotion()
  const count = reduced ? 5 : 40
  const colors = ['#ff4500', '#ff8c00', '#ffd700', '#990000', '#ff0000']
  
  for (let i = 0; i < count; i++) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('aria-hidden', 'true')
    svg.classList.add('heart-particle') 
    
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
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

interface Props {
  visible: boolean
  ink: boolean
  dim: boolean
  onClose: () => void
  announce: (msg: string) => void
  title: string
  message: string
  shareUrl: string
  onUpdateLetter: (title: string, msg: string) => void
}

export function Letter({ visible, ink, dim, onClose, announce, title, message, shareUrl, onUpdateLetter }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const loveRef = useRef<HTMLButtonElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(message)
  const [draftTitle, setDraftTitle] = useState(title)
  const [hasJustGenerated, setHasJustGenerated] = useState(false)

  useEffect(() => {
    if (!visible) return
    titleRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, onClose])

  const confirmReading = () => {
    const btn = loveRef.current
    if (btn) {
      burstEmbers(btn)
      btn.classList.remove('is-beating')
      void btn.offsetWidth
      btn.classList.add('is-beating')
    }
    announce('Vœu exaucé.')
  }

  const handleSave = () => {
    onUpdateLetter(draftTitle, draft)
    setIsEditing(false)
    setHasJustGenerated(true)
    announce('Nouvelle lettre générée. Le lien est prêt à être partagé.')
  }

  const handleForward = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Une lettre pour toi',
          text: draftTitle,
          url: shareUrl,
        })
      } catch (e) {
        // user cancelled
      }
    } else {
      navigator.clipboard.writeText(shareUrl)
      announce('Lien copié dans le presse-papier.')
      alert('Lien copié dans le presse-papier !')
    }
  }

  return (
    <section className="letter-layer" aria-label="La lettre" data-visible={visible} data-dim={dim} inert={!visible}>
      <article className="letter" data-visible={visible} data-ink={ink} aria-labelledby="letter-title">
        {isEditing ? (
          <input
            className="letter-title-edit"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            aria-label="Titre de la lettre"
          />
        ) : (
          <h2 id="letter-title" ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
        )}
        
        {isEditing ? (
          <textarea
            className="letter-body letter-edit-area"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            autoFocus
          />
        ) : (
          <BlurWords text={message} />
        )}

        <div className="letter-footer">
          {isEditing ? (
            <>
              <button type="button" className="btn-close" onClick={() => setIsEditing(false)}>
                Annuler
              </button>
              <button type="button" className="btn-close" style={{ fontWeight: 'bold' }} onClick={handleSave}>
                Générer mon lien
              </button>
            </>
          ) : hasJustGenerated ? (
            <>
              <button type="button" className="btn-close" style={{ fontWeight: 'bold', color: 'var(--rose-ink)' }} onClick={handleForward}>
                Transférer à une autre personne
              </button>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button type="button" className="btn-close" onClick={() => setIsEditing(true)}>
                  Modifier encore
                </button>
                <button type="button" className="btn-close" onClick={onClose}>
                  Refermer
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                ref={loveRef}
                type="button"
                className="btn-love"
                onClick={confirmReading}
              >
                Votre humble serviteur 📜
              </button>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button type="button" className="btn-close" onClick={() => { setIsEditing(true); setDraft(message); setDraftTitle(title); setHasJustGenerated(false); }}>
                  Transmettre des ordres
                </button>
                <button type="button" className="btn-close" onClick={onClose}>
                  Refermer
                </button>
              </div>
            </>
          )}
        </div>
      </article>
    </section>
  )
}
