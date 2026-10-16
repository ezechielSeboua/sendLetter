import { useCallback, useEffect, useRef, useState } from 'react'
import { Hammer, type HammerHandle, type Point } from './components/Hammer'
import { Letter } from './components/Letter'
import { hasWebGL, prefersReducedMotion, readTokens } from './lib/tokens'
import type { EnvelopeScene } from './scene/EnvelopeScene'

import { ShareSidebar } from './components/ShareSidebar'

type Phase = 'loading' | 'closed' | 'striking' | 'opening' | 'open' | 'closing'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<EnvelopeScene | null>(null)
  const openBtnRef = useRef<HTMLButtonElement>(null)
  const [webgl, setWebgl] = useState(() => hasWebGL())
  const [phase, setPhase] = useState<Phase>(() => (hasWebGL() ? 'loading' : 'closed'))
  const [letterVisible, setLetterVisible] = useState(false)
  const [ink, setInk] = useState(false)
  const [liveMsg, setLiveMsg] = useState('')
  const [hoverEnvelope, setHoverEnvelope] = useState(false)
  const hammerRef = useRef<HammerHandle>(null)
  const returnFocus = useRef(false)

  const [shareUrl, setShareUrl] = useState(() => window.location.href)
  
  const defaultTitle = 'Strictement Confidentiel'
  const defaultMsg = "Votre présence est requise pour un événement d'une importance capitale. Les enjeux sont grands et le silence est d'or. Prenez connaissance des directives et préparez-vous en conséquence. Nous comptons sur vous."
  
  const [title, setTitle] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('t')
    if (t) {
      try { return decodeURIComponent(escape(atob(t))) } catch (e) { return defaultTitle }
    }
    return defaultTitle
  })
  
  const [message, setMessage] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const m = params.get('m')
    if (m) {
      try { return decodeURIComponent(escape(atob(m))) } catch (e) { return defaultMsg }
    }
    return defaultMsg
  })

  const updateLetter = useCallback((newTitle: string, newMsg: string) => {
    setTitle(newTitle)
    setMessage(newMsg)
    const encodedT = btoa(unescape(encodeURIComponent(newTitle)))
    const encodedM = btoa(unescape(encodeURIComponent(newMsg)))
    const url = new URL(window.location.href)
    url.searchParams.set('t', encodedT)
    url.searchParams.set('m', encodedM)
    window.history.pushState({}, '', url.toString())
    setShareUrl(url.toString())
  }, [])


  const announce = useCallback((msg: string) => {
    // Vider puis remplir pour que le même message soit relu
    setLiveMsg('')
    requestAnimationFrame(() => setLiveMsg(msg))
  }, [])

  const phaseRef = useRef(phase)
  useEffect(() => {
    phaseRef.current = phase
    // Rendre le focus au bouton une fois l'écran d'accueil de nouveau actif (plus inert)
    if (phase === 'closed' && returnFocus.current) {
      returnFocus.current = false
      openBtnRef.current?.focus({ preventScroll: true })
    }
  }, [phase])

  const sealPosition = (): Point => {
    const scene = sceneRef.current
    if (scene) return scene.sealScreenPosition()
    const r = document.querySelector('.css-envelope .s')?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 }
  }

  const openLetter = useCallback(() => {
    if (phaseRef.current !== 'striking') return
    setPhase('opening')
    const reveal = () => {
      setLetterVisible(true)
      // Le texte s'écrit une fois la carte en place
      window.setTimeout(() => setInk(true), 200)
      announce('La lettre est ouverte.')
    }
    const scene = sceneRef.current
    if (scene) {
      scene.open(reveal).then(() => setPhase('open'))
    } else {
      window.setTimeout(() => {
        reveal()
        setPhase('open')
      }, prefersReducedMotion() ? 0 : 450)
    }
  }, [announce])

  // Coup de marteau : le marteau rejoint le sceau, frappe, et l'ouverture part à l'impact.
  const breakSeal = useCallback(
    async (from?: Point) => {
      if (phaseRef.current !== 'closed') return
      phaseRef.current = 'striking'
      setPhase('striking')
      setHoverEnvelope(false)
      await hammerRef.current?.strike(sealPosition(), from)
      sceneRef.current?.impact()
      openLetter()
    },
    [openLetter],
  )

  const breakFromButton = () => {
    const r = openBtnRef.current?.getBoundingClientRect()
    breakSeal(r ? { x: r.left + r.width / 2, y: r.top } : undefined)
  }

  const closeLetter = useCallback(() => {
    if (phaseRef.current !== 'open') return
    setPhase('closing')
    // 1. l'encre s'efface, 2. la lettre 3D reprend la place de la carte, 3. le film se rejoue à l'envers
    setInk(false)
    document.querySelector('.letter')?.scrollTo({ top: 0 })
    const finish = () => {
      returnFocus.current = true
      setPhase('closed')
      announce('La lettre est refermée.')
    }
    window.setTimeout(() => {
      const scene = sceneRef.current
      if (scene) scene.close(() => setLetterVisible(false)).then(finish)
      else {
        setLetterVisible(false)
        window.setTimeout(finish, 300)
      }
    }, prefersReducedMotion() ? 0 : 240)
  }, [announce])

  // Scène 3D chargée en différé : le HTML s'affiche d'abord.
  useEffect(() => {
    if (!webgl || !canvasRef.current) return
    let cancelled = false
    let scene: EnvelopeScene | null = null
    const canvas = canvasRef.current
    import('./scene/EnvelopeScene')
      .then(async ({ EnvelopeScene }) => {
        if (cancelled) return
        scene = new EnvelopeScene(canvas, readTokens(), prefersReducedMotion(), {
          onEnvelopeClick: (x, y) => breakSeal(matchMedia('(pointer: fine)').matches ? undefined : { x, y }),
          onHover: (on) => setHoverEnvelope(on),
          onContextLost: () => setWebgl(false),
          getCard: () => document.querySelector<HTMLElement>('.letter'),
        })
        await scene.init()
        if (cancelled) return scene.dispose()
        sceneRef.current = scene
        setPhase('closed')
        scene.playIntro()
      })
      .catch(() => {
        if (!cancelled) {
          setWebgl(false)
          setPhase('closed')
        }
      })
    return () => {
      cancelled = true
      scene?.dispose()
      sceneRef.current = null
    }
  }, [webgl, breakSeal])

  const started = phase === 'opening' || phase === 'open' || phase === 'closing'

  return (
    <>
      <ShareSidebar shareUrl={shareUrl} />
      <div className="backdrop" aria-hidden="true" />
      {webgl ? (
        <canvas id="gl" ref={canvasRef} aria-hidden="true" />
      ) : (
        <button
          type="button"
          className="css-envelope"
          data-open={started}
          onClick={() => breakSeal()}
          tabIndex={-1}
          aria-hidden="true"
        >
          <i className="l" />
          <i className="r" />
          <i className="b" />
          <i className="t" />
          <i className="s" />
        </button>
      )}

      <main className="stage" data-hidden={started} inert={started}>
        <h1>
          Message De la plus haute importance <br />
          <span>Pour sa majesté</span>
        </h1>
        <div className="stage-actions">
          <button
            ref={openBtnRef}
            type="button"
            className="btn-seal"
            onClick={breakFromButton}
            disabled={phase === 'loading'}
          >
            Touchez le sceau royal
          </button>
          <p className="stage-hint">Pour ouvrir la lettre.</p>
        </div>
      </main>

      <Letter visible={letterVisible} ink={ink} dim={!webgl} onClose={closeLetter} announce={announce} title={title} message={message} onUpdateLetter={updateLetter} shareUrl={shareUrl} />

      <Hammer ref={hammerRef} active={phase === 'closed' || phase === 'striking'} ready={hoverEnvelope} />

      <div className="sr-only" aria-live="polite">
        {liveMsg}
      </div>
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="loader" data-done={phase !== 'loading'} aria-hidden="true">
        <div className="loader-seal" />
      </div>
    </>
  )
}
