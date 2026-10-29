import { useCallback, useEffect, useState } from 'react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { addAllowedEmail, listAllowedEmails, removeAllowedEmail, type AllowedEmail } from '../../lib/letters'

const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

// Messages des erreurs levées par les fonctions Supabase (raise exception '<code>').
const errorMessages: Record<string, string> = {
  invalid_email: 'Adresse e-mail invalide.',
  cannot_remove_self: 'Tu ne peux pas retirer ton propre compte.',
  cannot_demote_self: 'Tu ne peux pas retirer ton propre rôle d’administrateur.',
  not_admin: 'Ce compte n’est pas administrateur.',
}
const messageOf = (err: unknown, fallback: string) =>
  errorMessages[(err as { message?: string }).message ?? ''] ?? fallback

// Onglet « Comptes » (administrateurs) : qui peut se connecter et envoyer des lettres.
export function Accounts({ me }: { me: string }) {
  const [accounts, setAccounts] = useState<AllowedEmail[] | null>(null)
  const [email, setEmail] = useState('')
  const [admin, setAdmin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [targetRemove, setTargetRemove] = useState<AllowedEmail | null>(null)

  const load = useCallback(() => {
    listAllowedEmails()
      .then(setAccounts)
      .catch((err) => setError(messageOf(err, 'La liste n’a pas pu être chargée.')))
  }, [])

  useEffect(load, [load])

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true)
    setError('')
    try {
      await action()
      load()
      return true
    } catch (err) {
      setError(messageOf(err, fallback))
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await run(() => addAllowedEmail(email, admin), 'Le compte n’a pas pu être ajouté.')) {
      setEmail('')
      setAdmin(false)
    }
  }

  const confirmRemove = () => {
    if (!targetRemove) return
    const a = targetRemove
    setTargetRemove(null)
    run(() => removeAllowedEmail(a.email), 'Le compte n’a pas pu être retiré.')
  }

  const isMe = (a: AllowedEmail) => a.email === me.toLowerCase()

  return (
    <section className="panel panel-wide" aria-labelledby="accounts-title">
      <h2 id="accounts-title">Comptes autorisés</h2>
      <p className="muted">
        Seuls ces comptes Google peuvent se connecter et envoyer des lettres. Les administrateurs gèrent cette liste.
      </p>

      <form className="account-form" onSubmit={add}>
        <div className="field">
          <label htmlFor="account-email">Adresse Gmail</label>
          <input
            id="account-email"
            type="email"
            required
            placeholder="prenom.nom@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
          Administrateur
        </label>
        <button type="submit" className="btn-seal" disabled={busy}>
          Ajouter
        </button>
      </form>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {accounts === null && !error && (
        <div className="panel-loading">
          <div className="loader-seal" aria-hidden="true" />
          <p className="muted">Chargement des comptes…</p>
        </div>
      )}

      {accounts && (
        <ul className="account-list">
          {accounts.map((a) => (
            <li key={a.email} className="account-item">
              <div className="history-main">
                <p className="history-title">
                  {a.email}
                  {isMe(a) && <span> · toi</span>}
                </p>
                <p className="history-detail">Ajouté le {date.format(new Date(a.added_at))}</p>
              </div>
              {a.is_admin && (
                <span className="status" data-status="admin">
                  Admin
                </span>
              )}
              {!isMe(a) && (
                <div className="history-actions">
                  <button
                    type="button"
                    className="link-btn"
                    disabled={busy}
                    onClick={() =>
                      run(() => addAllowedEmail(a.email, !a.is_admin), 'Le rôle n’a pas pu être modifié.')
                    }
                  >
                    {a.is_admin ? 'Retirer admin' : 'Rendre admin'}
                  </button>
                  <button
                    type="button"
                    className="link-btn link-danger"
                    disabled={busy}
                    onClick={() => setTargetRemove(a)}
                  >
                    Retirer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={targetRemove !== null}
        title="Retirer ce compte ?"
        message={`Retirer ${targetRemove?.email} ? Ce compte ne pourra plus se connecter ni envoyer de lettres.`}
        confirmLabel="Retirer le compte"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setTargetRemove(null)}
      />
    </section>
  )
}
