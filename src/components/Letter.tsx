import { useEffect, useRef } from 'react'
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
  onClose: () => void
  announce: (msg: string) => void
}

// La lettre telle que la lit le destinataire : pas d'édition ni de réponse.
export function Letter({ theme, fields, visible, ink, dim, onClose, announce }: Props) {
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
        <LetterContent theme={theme} fields={fields} titleRef={titleRef} />
        <div className="letter-footer">
          <ActionButton theme={theme} buttonRef={loveRef} onClick={sendLove} />
          <button type="button" className="btn-close" onClick={onClose}>
            Refermer
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
