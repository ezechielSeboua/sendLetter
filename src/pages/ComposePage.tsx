import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { senderInfo } from '../lib/letters'
import { supabase } from '../lib/supabase'
import { Accounts } from './compose/Accounts'
import { Durations } from './compose/Durations'
import { History } from './compose/History'
import { NewLetter } from './compose/NewLetter'

type Access = 'loading' | 'signed-out' | 'checking' | 'denied' | 'allowed'

// Interface de l'expéditeur : réservée aux comptes Google autorisés (vérifié côté serveur).
export function ComposePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<Access>('loading')
  const [isAdmin, setIsAdmin] = useState(false)
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
    senderInfo()
      .then(async ({ allowed, admin }) => {
        if (cancelled) return
        setIsAdmin(admin)
        if (allowed) return setAccess('allowed')
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
          <Dashboard email={userEmail} isAdmin={isAdmin} />
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

type Tab = 'new' | 'history' | 'settings'

const tabHash: Record<Tab, string> = { new: '', history: '#historique', settings: '#reglages' }

const tabFromHash = (): Tab =>
  window.location.hash === tabHash.history ? 'history' : window.location.hash === tabHash.settings ? 'settings' : 'new'

// Onglets dans l'adresse (#historique, #reglages) : un rechargement garde l'onglet ouvert.
export function Dashboard({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const [tab, setTab] = useState<Tab>(tabFromHash)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'new', label: 'Nouvelle lettre' },
    { id: 'history', label: 'Historique' },
    ...(isAdmin ? [{ id: 'settings' as const, label: 'Réglages' }] : []),
  ]
  const current = tab === 'settings' && !isAdmin ? 'new' : tab

  const open = (id: Tab) => {
    history.replaceState(null, '', `${window.location.pathname}${tabHash[id]}`)
    setTab(id)
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

      <nav className="tabs" aria-label="Sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tab"
            aria-current={current === t.id ? 'page' : undefined}
            onClick={() => open(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Toujours monté : une lettre en cours d'écriture survit au passage par l'historique */}
      <div hidden={current !== 'new'}>
        <NewLetter />
      </div>
      {current === 'history' && <History />}
      {current === 'settings' && (
        <div className="settings-stack">
          <Durations />
          <Accounts me={email} />
        </div>
      )}
    </div>
  )
}
