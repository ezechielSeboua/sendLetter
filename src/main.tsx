import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LetterExperience } from './components/LetterExperience'
import { applyTheme, themes, type ThemeId } from './lib/themes'
import { ComposePage, Dashboard } from './pages/ComposePage'
import { ReadPage } from './pages/ReadPage'

const params = new URLSearchParams(window.location.search)
const demo = params.get('demo')
const demoTheme = (params.get('theme') as ThemeId) || 'invitation'
const slug = window.location.pathname.match(/^\/l\/([a-z0-9]+)\/?$/)?.[1]

if (demo === 'read') {
  const theme = themes[demoTheme] || themes.invitation
  applyTheme(theme)
  const fields = {
    recipient: 'Marie',
    title: theme.defaultTitle,
    message: theme.defaultMessage,
    date: '2026-11-15T20:00',
    place: 'Le Grand Salon, 12 rue des Lys',
    signature: 'Le Cabinet Royal',
  }
  const expiresAt = new Date(Date.now() + 270000).toISOString()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LetterExperience theme={theme} fields={fields} expiresAt={expiresAt} />
    </StrictMode>,
  )
} else if (demo === 'compose') {
  applyTheme(themes.invitation)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <div className="backdrop" aria-hidden="true" />
      <div className="compose">
        <Dashboard email="admin@example.com" isAdmin={true} />
      </div>
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </StrictMode>,
  )
} else {
  applyTheme(themes.invitation)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>{slug ? <ReadPage slug={slug} /> : <ComposePage />}</StrictMode>,
  )
}
