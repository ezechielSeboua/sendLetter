import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    confirmBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onCancel} aria-hidden="true">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-seal-badge" aria-hidden="true" />
        <h3 id="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn-modal-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`btn-seal ${danger ? 'btn-danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

