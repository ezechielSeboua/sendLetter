import { supabase } from './supabase'
import type { ThemeId } from './themes'

export type FieldKey = 'recipient' | 'title' | 'message' | 'date' | 'place' | 'age' | 'signature'
export type LetterFields = Partial<Record<FieldKey, string>>

export type OpenResult =
  | { status: 'ok'; theme: ThemeId; fields: LetterFields; expires_at: string }
  | { status: 'expired' }
  | { status: 'not_found' }

export const letterUrl = (slug: string) => `${window.location.origin}/l/${slug}`

export type LetterStatus = 'sent' | 'opened' | 'expired'

export interface LetterSummary {
  slug: string
  theme: ThemeId
  recipient: string | null
  title: string | null
  created_at: string
  opened_at: string | null
  // Fin de lecture pour une lettre ouverte, fin de validité du lien sinon
  expires_at: string
  status: LetterStatus
}

export interface AllowedEmail {
  email: string
  is_admin: boolean
  added_at: string
}

async function call<T>(fn: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

// Droits du compte connecté : peut envoyer, peut gérer les comptes.
export const senderInfo = () => call<{ allowed: boolean; admin: boolean }>('sender_info')

export const listMyLetters = () => call<LetterSummary[]>('list_my_letters')

// Annule une lettre pas encore ouverte, ou la retire de l'historique.
export const deleteMyLetter = (slug: string) => call<boolean>('delete_my_letter', { p_slug: slug })

export const listAllowedEmails = () => call<AllowedEmail[]>('list_allowed_emails')

export const addAllowedEmail = (email: string, admin: boolean) =>
  call<null>('add_allowed_email', { p_email: email, p_admin: admin })

export const removeAllowedEmail = (email: string) => call<null>('remove_allowed_email', { p_email: email })

export async function createLetter(theme: ThemeId, fields: LetterFields) {
  const { data, error } = await supabase.rpc('create_letter', { p_theme: theme, p_fields: fields })
  if (error) throw error
  return data as string
}

// La première ouverture démarre le compte à rebours côté serveur.
export async function openLetter(slug: string) {
  const { data, error } = await supabase.rpc('open_letter', { p_slug: slug })
  if (error) throw error
  return data as OpenResult
}
