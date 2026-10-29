import { useEffect, useState } from 'react'
import { formatDuration, splitDuration, unitLabel, unitSeconds, type Unit } from '../../lib/durations'
import { getSettings, updateSettings, type Settings } from '../../lib/letters'

interface Row {
  key: keyof Settings
  label: string
  help: string
  units: Unit[]
  min: number
  max: number
}

// Mêmes bornes que la fonction update_settings côté serveur.
const rows: Row[] = [
  {
    key: 'read_window',
    label: 'Durée de lecture',
    help: 'Temps pendant lequel la lettre reste lisible après sa première ouverture.',
    units: ['minutes', 'hours'],
    min: 60,
    max: 86400,
  },
  {
    key: 'unopened_ttl',
    label: 'Validité d’un lien jamais ouvert',
    help: 'Au-delà, le lien expire sans avoir été lu.',
    units: ['minutes', 'hours', 'days'],
    min: 60,
    max: 90 * 86400,
  },
  {
    key: 'history_ttl',
    label: 'Conservation dans l’historique',
    help: 'Après ce délai, la trace de la lettre est supprimée définitivement.',
    units: ['days'],
    min: 86400,
    max: 365 * 86400,
  },
]

const errorMessages: Record<string, string> = {
  history_shorter_than_link: 'La conservation dans l’historique doit être au moins égale à la validité du lien.',
  not_admin: 'Ce compte n’est pas administrateur.',
}

type Draft = Record<keyof Settings, { value: string; unit: Unit }>

const toDraft = (s: Settings): Draft =>
  Object.fromEntries(
    rows.map((r) => {
      const { value, unit } = splitDuration(s[r.key], r.units)
      return [r.key, { value: String(value), unit }]
    }),
  ) as Draft

const seconds = (d: Draft[keyof Settings]) => Math.round(Number(d.value) * unitSeconds[d.unit])

// Panneau « Durées » (administrateurs) : s'applique aussi aux lettres déjà envoyées.
export function Durations() {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings()
      .then((s) => (s ? setDraft(toDraft(s)) : setError('Réglages indisponibles pour ce compte.')))
      .catch(() => setError('Les réglages n’ont pas pu être chargés.'))
  }, [])

  const set = (key: keyof Settings, patch: Partial<Draft[keyof Settings]>) => {
    setSaved(false)
    setDraft((d) => d && { ...d, [key]: { ...d[key], ...patch } })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const next = Object.fromEntries(rows.map((r) => [r.key, seconds(draft[r.key])])) as unknown as Settings
    for (const r of rows) {
      if (!(next[r.key] >= r.min && next[r.key] <= r.max)) {
        return setError(`${r.label} : entre ${formatDuration(r.min)} et ${formatDuration(r.max)}.`)
      }
    }
    if (next.history_ttl < next.unopened_ttl) return setError(errorMessages.history_shorter_than_link)
    setBusy(true)
    setError('')
    try {
      await updateSettings(next)
      setDraft(toDraft(next))
      setSaved(true)
    } catch (err) {
      setError(errorMessages[(err as { message?: string }).message ?? ''] ?? 'Les réglages n’ont pas pu être enregistrés.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel panel-wide" aria-labelledby="durations-title">
      <h2 id="durations-title">Durées</h2>
      <p className="muted">S’appliquent immédiatement, y compris aux lettres déjà envoyées.</p>

      {draft === null && !error && <p className="muted">Chargement…</p>}

      {draft && (
        <form className="durations" onSubmit={save}>
          {rows.map((r) => (
            <div key={r.key} className="duration-row">
              <div>
                <label htmlFor={`d-${r.key}`} className="duration-label">
                  {r.label}
                </label>
                <p className="history-detail">{r.help}</p>
              </div>
              <div className="duration-input">
                <input
                  id={`d-${r.key}`}
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={draft[r.key].value}
                  onChange={(e) => set(r.key, { value: e.target.value })}
                />
                {r.units.length > 1 ? (
                  <select
                    aria-label={`Unité : ${r.label}`}
                    value={draft[r.key].unit}
                    onChange={(e) => set(r.key, { unit: e.target.value as Unit })}
                  >
                    {r.units.map((u) => (
                      <option key={u} value={u}>
                        {unitLabel(u)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="duration-unit">{unitLabel(r.units[0])}</span>
                )}
              </div>
            </div>
          ))}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="durations-actions">
            <button type="submit" className="btn-seal" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {saved && <span role="status">Réglages enregistrés.</span>}
          </div>
        </form>
      )}

      {draft === null && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
