import { supabase } from './supabase'
import type { ThemeId } from './themes'

export type FieldKey = 'recipient' | 'title' | 'message' | 'date' | 'place' | 'age' | 'signature'
export type LetterFields = Partial<Record<FieldKey, string>>

export type OpenResult =
  | { status: 'ok'; theme: ThemeId; fields: LetterFields; expires_at: string }
  | { status: 'expired' }
  | { status: 'not_found' }

export const letterUrl = (slug: string) => `${window.location.origin}/l/${slug}`

export async function canSend() {
  const { data, error } = await supabase.rpc('can_send')
  if (error) throw error
  return data === true
}

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
