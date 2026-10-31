import type { Reservation, Room, TableRow } from './supabase'

export const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const overlaps = (aStart: number, aDur: number, bStart: number, bDur: number) => aStart < bStart + bDur && bStart < aStart + aDur

/** Ein Tisch ist belegt, wenn eine Reservierung ihn direkt oder als Wetter-Reserve (alt) nutzt. */
export function tableBusy(id: string, start: number, dur: number, res: Reservation[], ignore?: string) {
  return res.some(r => r.id !== ignore && (r.table_id === id || r.alt_table_id === id) && overlaps(start, dur, r.start_min, r.duration_min))
}

export type FindOpts = {
  tables: TableRow[]; rooms: Room[]; res: Reservation[]
  roomId: string; start: number; dur: number; party: number
  /** true = Team vergibt von Hand: schwarze Tische erlaubt */
  manual: boolean; ignore?: string
}

/** Kleinster passender freier Tisch im Bereich. */
export function findTable(o: FindOpts): TableRow | null {
  const c = o.tables
    .filter(t => t.room_id === o.roomId && t.min_seats <= o.party && o.party <= t.max_seats && (o.manual || t.online_bookable) && !tableBusy(t.id, o.start, o.dur, o.res, o.ignore))
    .sort((a, b) => a.max_seats - b.max_seats || a.min_seats - b.min_seats)
  return c[0] ?? null
}

/** Wetter-Reserve: Ein Tisch drinnen blockiert zusätzlich einen freien Tisch draußen, der die Gruppe fasst. */
export function findReserve(o: FindOpts, chosen: TableRow): TableRow | null {
  const room = o.rooms.find(r => r.id === chosen.room_id)
  if (!room || room.outdoor) return null
  const outdoor = new Set(o.rooms.filter(r => r.outdoor).map(r => r.id))
  const c = o.tables
    .filter(t => outdoor.has(t.room_id) && t.placed && t.online_bookable && t.max_seats >= o.party && t.min_seats <= o.party && !tableBusy(t.id, o.start, o.dur, o.res, o.ignore))
    .sort((a, b) => a.max_seats - b.max_seats)
  return c[0] ?? null
}

/** Alternative Uhrzeiten, nach Abstand zur Wunschzeit sortiert. */
export function suggest(o: FindOpts, from: number, to: number, step = 30, max = 3) {
  const out: { start: number; table: TableRow }[] = []
  for (let d = step; d <= 240; d += step) {
    for (const s of [o.start - d, o.start + d]) {
      if (s < from || s + o.dur > to + 0) continue
      const t = findTable({ ...o, start: s })
      if (t) out.push({ start: s, table: t })
    }
    if (out.length >= max) break
  }
  return out.slice(0, max)
}

/** Gäste, die zu einer Minute im Bereich anwesend sind (Summe der Gruppen). */
export function guestsAt(res: Reservation[], tables: TableRow[], roomId: string | null, minute: number) {
  const ids = new Set(tables.filter(t => !roomId || t.room_id === roomId).map(t => t.id))
  return res.filter(r => r.table_id && ids.has(r.table_id) && r.start_min <= minute && minute < r.start_min + r.duration_min).reduce((s, r) => s + r.party, 0)
}

/** Online mindestens `hours` Stunden im Voraus. */
export function leadOk(day: string, start: number, now: Date, hours: number) {
  const [y, m, d] = day.split('-').map(Number)
  const at = new Date(y, m - 1, d, Math.floor(start / 60), start % 60)
  return at.getTime() - now.getTime() >= hours * 3600_000
}

export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); return isoDay(new Date(y, m - 1, d + n)) }
export const dayLabel = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }) }

/** Gast zu Telefon (nur Ziffern) oder E-Mail finden. */
export const digits = (s: string) => s.replace(/\D/g, '')
export function matchGuest<G extends { phone: string | null; email: string | null }>(guests: G[], phone: string, email: string): G | null {
  const p = digits(phone), e = email.trim().toLowerCase()
  return guests.find(g => (p.length >= 6 && g.phone && digits(g.phone) === p) || (e && g.email && g.email.toLowerCase() === e)) ?? null
}
