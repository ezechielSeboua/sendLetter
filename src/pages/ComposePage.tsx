import type { Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { ActionButton } from '../components/Letter'
import { LetterContent } from '../components/LetterContent'
import { ShareLinks } from '../components/ShareLinks'
import { canSend, createLetter, letterUrl, type LetterFields } from '../lib/letters'
import { burst } from '../lib/particles'
import { supabase } from '../lib/supabase'
import { applyTheme, themeIds, themes, type FieldDef, type ThemeId } from '../lib/themes'

type Access = 'loading' | 'signed-out' | 'checking' | 'denied' | 'allowed'

const defaultFields = (id: ThemeId): LetterFields => ({
  title: themes[id].defaultTitle,
  message: themes[id].defaultMessage,
})

// Interface de l'expéditeur : réservée aux comptes Google autorisés (vérifié côté serveur).
export function ComposePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<Access>('loading')
  const [deniedEmail, setDeniedEmail] = useState('')

  useEffect(() => {
    document.title = 'Écrire une lettre'
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setAccess('signed-out')
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setAccess((a) => (s ? (a === 'allowed' ? a : 'checking') : a === 'denied' ? a : 'signed-out'))
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Une session ne suffit pas : l'adresse doit figurer dans la liste des expéditeurs autorisés.
  const userId = session?.user.id
  const userEmail = session?.user.email ?? ''
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    canSend()
      .then(async (ok) => {
        if (cancelled) return
        if (ok) return setAccess('allowed')
        setDeniedEmail(userEmail)
        setAccess('denied')
        await supabase.auth.signOut()
      })
      .catch(() => !cancelled && setAccess('signed-out'))
    return () => {
      cancelled = true
    }
  }, [userId, userEmail])

  // select_account : Google propose toujours le choix du compte, sinon il reprend
  // automatiquement le dernier utilisé et on ne peut pas en changer.
  const signIn = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/`, queryParams: { prompt: 'select_account' } },
    })

  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <div className="compose">
        {access === 'allowed' && session ? (
          <Composer email={session.user.email ?? ''} />
        ) : (
          <main className="notice">
            <div className="notice-seal" aria-hidden="true" />
            <h1>Écrire une lettre</h1>
            {access === 'loading' || access === 'checking' ? (
              <p>Vérification de l’accès…</p>
            ) : (
              <>
                {access === 'denied' ? (
                  <p role="alert">
                    Le compte {deniedEmail || 'Google'} n’est pas autorisé à envoyer des lettres.
                  </p>
                ) : (
                  <p>Espace réservé. Connecte-toi pour préparer une lettre.</p>
                )}
                <button type="button" className="btn-seal" onClick={signIn}>
                  Se connecter avec Google
                </button>
              </>
            )}
          </main>
        )}
      </div>
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  )
}

function Composer({ email }: { email: string }) {
  const [themeId, setThemeId] = useState<ThemeId>('invitation')
  const [fields, setFields] = useState<LetterFields>(() => defaultFields('invitation'))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [slug, setSlug] = useState<string | null>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const theme = themes[themeId]

  useEffect(() => applyTheme(theme), [theme])

  // Le destinataire et la signature suivent ; titre et message par défaut changent avec le type.
  const pickTheme = (id: ThemeId) => {
    const prev = themes[themeId]
    const next: LetterFields = {}
    for (const f of themes[id].fields) next[f.key] = fields[f.key]
    if (!fields.title || fields.title === prev.defaultTitle) next.title = themes[id].defaultTitle
    if (!fields.message || fields.message === prev.defaultMessage) next.message = themes[id].defaultMessage
    setThemeId(id)
    setFields(next)
    setError('')
  }

  const setField = (key: FieldDef['key'], value: string) => setFields((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean: LetterFields = {}
    for (const f of theme.fields) {
      const v = fields[f.key]?.trim()
      if (v) clean[f.key] = v
    }
    setSending(true)
    setError('')
    try {
      setSlug(await createLetter(themeId, clean))
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(code === '42501' ? 'Ce compte n’est pas autorisé à envoyer des lettres.' : 'La lettre n’a pas pu être enregistrée. Réessaie.')
    } finally {
      setSending(false)
    }
  }

  const restart = () => {
    setSlug(null)
    setFields(defaultFields(themeId))
  }

  return (
    <div className="composer">
      <header className="composer-header">
        <h1>Écrire une lettre</h1>
        <div className="composer-account">
          <span>{email}</span>
          <button type="button" className="link-btn" onClick={() => supabase.auth.signOut()}>
            Se déconnecter
          </button>
        </div>
      </header>

      <div className="composer-grid">
        {slug ? (
          <section className="panel" aria-labelledby="ready-title">
            <h2 id="ready-title">Ta lettre est prête</h2>
            <ShareLinks url={letterUrl(slug)} />
            <p className="panel-warning">
              N’ouvre pas ce lien toi-même : la lettre ne reste lisible que quelques minutes après sa
              première ouverture. Sans ouverture, elle expire au bout d’une semaine.
            </p>
            <button type="button" className="btn-seal" onClick={restart}>
              Écrire une autre lettre
            </button>
          </section>
        ) : (
          <form className="panel" onSubmit={submit}>
            <fieldset className="type-picker">
              <legend>Type de lettre</legend>
              {themeIds.map((id) => (
                <label
                  key={id}
                  className="type-option"
                  style={{ '--chip-wax': themes[id].colors['--wax'], '--chip-envelope': themes[id].colors['--envelope'] } as React.CSSProperties}
                >
                  <input type="radio" name="type" value={id} checked={id === themeId} onChange={() => pickTheme(id)} />
                  <span>{themes[id].label}</span>
                </label>
              ))}
            </fieldset>

            {theme.fields.map((f) => (
              <Field key={`${themeId}-${f.key}`} def={f} value={fields[f.key] ?? ''} onChange={(v) => setField(f.key, v)} />
            ))}

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn-seal" disabled={sending}>
              {sending ? 'Enregistrement…' : 'Générer le lien'}
            </button>
          </form>
        )}

        <section className="compose-preview" aria-label="Aperçu de la lettre">
          <p className="preview-label">Aperçu</p>
          <article className="letter" data-visible="true" data-ink="true">
            <LetterContent theme={theme} fields={fields} />
            <div className="letter-footer">
              <ActionButton theme={theme} buttonRef={actionRef} onClick={() => actionRef.current && burst[theme.particles](actionRef.current)} />
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}

function Field({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  const id = `field-${def.key}`
  const common = {
    id,
    value,
    required: def.required,
    placeholder: def.placeholder,
    maxLength: def.maxLength,
  }
  return (
    <div className="field">
      <label htmlFor={id}>
        {def.label}
        {def.required && <span aria-hidden="true"> *</span>}
      </label>
      {def.kind === 'textarea' ? (
        <textarea {...common} rows={7} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          {...common}
          type={def.kind === 'datetime' ? 'datetime-local' : def.kind === 'number' ? 'number' : 'text'}
          min={def.kind === 'number' ? 1 : undefined}
          max={def.kind === 'number' ? 150 : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {def.maxLength && def.kind === 'textarea' && (
        <span className="field-count">
          {value.length} / {def.maxLength}
        </span>
      )}
    </div>
  )
}
