import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyTheme, themes } from './lib/themes'
import { ComposePage } from './pages/ComposePage'
import { ReadPage } from './pages/ReadPage'

// /l/<identifiant> : lecture par le destinataire ; tout le reste : configuration par l'expéditeur.
const slug = window.location.pathname.match(/^\/l\/([a-z0-9]+)\/?$/)?.[1]

applyTheme(themes.invitation)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{slug ? <ReadPage slug={slug} /> : <ComposePage />}</StrictMode>,
)
