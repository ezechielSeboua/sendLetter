import { useEffect, useRef, useState } from 'react'
import type { LetterFields } from '../lib/letters'
import { HEART_PATH, burst } from '../lib/particles'
import type { Theme } from '../lib/themes'
import { LetterContent } from './LetterContent'

interface Props {
  theme: Theme
  fields: LetterFields
  visible: boolean
  ink: boolean
  dim: boolean
  expiresAt?: string
  onClose: () => void
  announce: (msg: string) => void
}

function EphemeralTimer({ expiresAt }: { expiresAt?: string }) {
  const [remaining, setRemaining] = useState<string | null>(null)
  const [critical, setCritical] = useState(false)

  useEffect(() => {
    if (!expiresAt) return
    const target = new Date(expiresAt).getTime()
    if (isNaN(target)) return

    const update = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000))
      const m = Math.floor(diff / 60)
      const s = diff % 60
      setRemaining(`${m} min ${s < 10 ? '0' : ''}${s} s`)
      setCritical(diff < 60)
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  if (!remaining) return null

  return (
    <div className={`ephemeral-pill ${critical ? 'is-critical' : ''}`} role="timer" aria-live="off">
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="ephemeral-icon"
      >
        <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
      </svg>
      <span>
        Cette lettre s’effacera dans <strong>{remaining}</strong>
      </span>
    </div>
  )
}

// La lettre telle que la lit le destinataire : pas d'édition ni de réponse.
export function Letter({ theme, fields, visible, ink, dim, expiresAt, onClose, announce }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const loveRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!visible) return
    titleRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, onClose])

  const sendLove = () => {
    const btn = loveRef.current
    if (btn) {
      burst[theme.particles](btn)
      // Relance le battement du bouton même en cas de clics rapprochés
      btn.classList.remove('is-beating')
      void btn.offsetWidth
      btn.classList.add('is-beating')
    }
    announce(theme.actionAnnounce)
  }

  return (
    <section className="letter-layer" aria-label="La lettre" data-visible={visible} data-dim={dim} inert={!visible}>
      <article className="letter" data-visible={visible} data-ink={ink} aria-labelledby="letter-title">
        <button
          type="button"
          className="letter-close-top"
          onClick={onClose}
          aria-label="Refermer la lettre"
          title="Refermer (Échap)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {expiresAt && <EphemeralTimer expiresAt={expiresAt} />}

        <LetterContent theme={theme} fields={fields} titleRef={titleRef} />
        <div className="letter-footer">
          <ActionButton theme={theme} buttonRef={loveRef} onClick={sendLove} />
          <button type="button" className="btn-close" onClick={onClose}>
            Refermer la lettre
          </button>
        </div>
      </article>
    </section>
  )
}

export function ActionButton({
  theme,
  buttonRef,
  onClick,
}: {
  theme: Theme
  buttonRef?: React.Ref<HTMLButtonElement>
  onClick?: () => void
}) {
  return (
    <button ref={buttonRef} type="button" className="btn-love" onClick={onClick}>
      {theme.actionLabel}
      {theme.actionHeart && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={HEART_PATH} />
        </svg>
      )}
    </button>
  )
}
