import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY,
)

export type Role = 'admin' | 'editor' | 'reservations' | 'viewer'
export type Team = { id: string; slug: string; name: string; role: Role }

export type Room = { id: string; name: string; sort: number; width: number; height: number; outdoor: boolean }
export type RoomElement = { id: string; room_id: string; kind: string; x: number | null; y: number | null; w: number | null; h: number | null; rot: number; path: string | null }
export type TableRow = {
  id: string; room_id: string; label: string; min_seats: number; max_seats: number
  online_bookable: boolean; placed: boolean
  x: number | null; y: number | null; w: number | null; h: number | null; rot: number; round: boolean
}
export type LayoutTable = Pick<TableRow, 'id' | 'label' | 'min_seats' | 'max_seats' | 'online_bookable' | 'placed' | 'x' | 'y' | 'w' | 'h' | 'rot' | 'round'>
export type Layout = { id: string; name: string; data: LayoutTable[] }
