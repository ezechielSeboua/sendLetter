import { useCallback, useEffect, useState } from 'react'
import { deleteMyLetter, letterUrl, listMyLetters, type LetterStatus, type LetterSummary } from '../../lib/letters'
import { themes } from '../../lib/themes'

const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
const time = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' })
const fmt = (iso: string) => dateTime.format(new Date(iso))

const statusLabel: Record<LetterStatus, string> = {
  sent: 'Envoyée',
  opened: 'Ouverte',
  expired: 'Expirée',
}

function detail(l: LetterSummary) {
  if (l.status === 'sent') return `Créée le ${fmt(l.created_at)} · lien valable jusqu’au ${fmt(l.expires_at)}`
  if (l.status === 'expired') return `Créée le ${fmt(l.created_at)} · jamais ouverte`
  const stillReadable = new Date(l.expires_at) > new Date()
  return `Ouverte le ${fmt(l.opened_at!)} · ${stillReadable ? `lisible jusqu’à ${time.format(new Date(l.expires_at))}` : 'lien expiré'}`
}

// Onglet « Historique » : les lettres de l'expéditeur connecté, de la plus récente à la plus ancienne.
export function History() {
  const [letters, setLetters] = useState<LetterSummary[] | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(() => {
    listMyLetters()
      .then((list) => {
        setLetters(list)
        setError('')
      })
      .catch(() => setError('L’historique n’a pas pu être chargé.'))
  }, [])

  useEffect(load, [load])

  const copy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(letterUrl(slug))
      setCopied(slug)
      setTimeout(() => setCopied((c) => (c === slug ? null : c)), 2000)
    } catch {
      /* presse-papier indisponible */
    }
  }

  const remove = async (l: LetterSummary) => {
    const question =
      l.status === 'sent'
        ? 'Annuler cette lettre ? Le lien ne fonctionnera plus.'
        : 'Retirer cette lettre de l’historique ?'
    if (!window.confirm(question)) return
    try {
      await deleteMyLetter(l.slug)
      setLetters((list) => list?.filter((x) => x.slug !== l.slug) ?? null)
    } catch {
      setError('La lettre n’a pas pu être supprimée.')
    }
  }

  const counts = (letters ?? []).reduce<Record<LetterStatus, number>>(
    (acc, l) => ({ ...acc, [l.status]: acc[l.status] + 1 }),
    { sent: 0, opened: 0, expired: 0 },
  )

  return (
    <section className="panel panel-wide" aria-labelledby="history-title">
      <div className="panel-head">
        <h2 id="history-title">Historique</h2>
        <button type="button" className="link-btn" onClick={load}>
          Actualiser
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {letters === null && !error && <p className="muted">Chargement…</p>}

      {letters?.length === 0 && <p className="muted">Aucune lettre pour le moment.</p>}

      {letters && letters.length > 0 && (
        <>
          <p className="muted">
            {counts.sent} envoyée{counts.sent > 1 ? 's' : ''} · {counts.opened} ouverte{counts.opened > 1 ? 's' : ''} ·{' '}
            {counts.expired} expirée{counts.expired > 1 ? 's' : ''}
          </p>
          <ul className="history-list">
            {letters.map((l) => {
              const theme = themes[l.theme]
              return (
                <li key={l.slug} className="history-item">
                  <span
                    className="history-type"
                    style={{ '--chip-wax': theme.colors['--wax'], '--chip-envelope': theme.colors['--envelope'] } as React.CSSProperties}
                  >
                    {theme.label}
                  </span>
                  <div className="history-main">
                    <p className="history-title">
                      {l.title || 'Sans titre'}
                      {l.recipient && <span> · pour {l.recipient}</span>}
                    </p>
                    <p className="history-detail">{detail(l)}</p>
                  </div>
                  <span className="status" data-status={l.status}>
                    {statusLabel[l.status]}
                  </span>
                  <div className="history-actions">
                    {l.status === 'sent' && (
                      <button type="button" className="link-btn" onClick={() => copy(l.slug)}>
                        {copied === l.slug ? 'Copié !' : 'Copier le lien'}
                      </button>
                    )}
                    <button type="button" className="link-btn link-danger" onClick={() => remove(l)}>
                      {l.status === 'sent' ? 'Annuler' : 'Retirer'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
