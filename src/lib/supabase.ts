import { createClient } from '@supabase/supabase-js'

// Projet partagé avec Slase Custom 3D : on n'y touche qu'aux fonctions can_send, create_letter et open_letter.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
