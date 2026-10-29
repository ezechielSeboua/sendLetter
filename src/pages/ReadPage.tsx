import { useEffect, useState } from 'react'
import { LetterExperience } from '../components/LetterExperience'
import { openLetter, type LetterFields } from '../lib/letters'
import { applyTheme, themes, type Theme } from '../lib/themes'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; theme: Theme; fields: LetterFields; expiresAt: string }
  | { kind: 'gone' }
  | { kind: 'error' }

export function ReadPage({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    openLetter(slug)
      .then((res) => {
        if (cancelled) return
        if (res.status !== 'ok' || !(res.theme in themes)) return setState({ kind: 'gone' })
        const theme = themes[res.theme]
        // Palette posée avant le montage de la scène 3D, qui la lit à son initialisation
        applyTheme(theme)
        setState({ kind: 'ready', theme, fields: res.fields, expiresAt: res.expires_at })
      })
      .catch(() => !cancelled && setState({ kind: 'error' }))
    return () => {
      cancelled = true
    }
  }, [slug])

  if (state.kind === 'ready') {
    return <LetterExperience theme={state.theme} fields={state.fields} expiresAt={state.expiresAt} />
  }

  if (state.kind === 'loading') {
    return (
      <div className="loader" data-done="false" aria-label="Chargement de la lettre">
        <div className="loader-seal" />
      </div>
    )
  }

  // Lien expiré et lien inconnu se confondent : une lettre expirée est supprimée peu après.
  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <main className="notice">
        <div className="notice-seal" aria-hidden="true" />
        {state.kind === 'gone' ? (
          <>
            <h1>Cette lettre n’est plus disponible</h1>
            <p>Elle s’efface quelques minutes après avoir été ouverte, ou si personne ne l’ouvre à temps.</p>
          </>
        ) : (
          <>
            <h1>La lettre n’a pas pu être chargée</h1>
            <p>Vérifie ta connexion puis recharge la page.</p>
          </>
        )}
      </main>
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  )
}
