import { useEffect, useRef, useState } from 'react'
import { ActionButton } from '../../components/Letter'
import { LetterContent } from '../../components/LetterContent'
import { ShareLinks } from '../../components/ShareLinks'
import { formatDuration } from '../../lib/durations'
import { createLetter, getSettings, letterUrl, type LetterFields, type Settings } from '../../lib/letters'
import { burst } from '../../lib/particles'
import { applyTheme, themeIds, themes, type FieldDef, type ThemeId } from '../../lib/themes'

const defaultFields = (id: ThemeId): LetterFields => ({
  title: themes[id].defaultTitle,
  message: themes[id].defaultMessage,
})

// Onglet « Nouvelle lettre » : type, champs, aperçu, puis lien à partager.
export function NewLetter() {
  const [themeId, setThemeId] = useState<ThemeId>('invitation')
  const [fields, setFields] = useState<LetterFields>(() => defaultFields('invitation'))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [slug, setSlug] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const theme = themes[themeId]

  useEffect(() => applyTheme(theme), [theme])

  // Relu à chaque lettre générée : les durées ont pu changer dans les réglages
  useEffect(() => {
    if (slug) getSettings().then(setSettings).catch(() => {})
  }, [slug])

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
    <div className="composer-grid">
      {slug ? (
        <section className="panel" aria-labelledby="ready-title">
          <h2 id="ready-title">Ta lettre est prête</h2>
          <ShareLinks url={letterUrl(slug)} />
          <p className="panel-warning">
            N’ouvre pas ce lien toi-même : la lettre ne reste lisible que{' '}
            {settings ? formatDuration(settings.read_window) : 'quelques minutes'} après sa première ouverture.
            Sans ouverture, elle expire au bout de {settings ? formatDuration(settings.unopened_ttl) : 'quelques jours'}.
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
