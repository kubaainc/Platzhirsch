import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY,
)

export type Role = 'admin' | 'editor' | 'reservations' | 'viewer'
export type Team = { id: string; slug: string; name: string; role: Role }
