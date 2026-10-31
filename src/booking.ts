import type { Reservation, Room, TableRow } from './supabase'

export const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const overlaps = (aStart: number, aDur: number, bStart: number, bDur: number) => aStart < bStart + bDur && bStart < aStart + aDur

/** Reservierung nutzt den Tisch: direkt, als zusammengestellter Tisch oder als Wetter-Reserve (alt). */
export const usesTable = (r: Reservation, id: string) => r.table_id === id || r.alt_table_id === id || (r.extra_table_ids ?? []).includes(id)

/** Ein Tisch ist belegt, wenn eine Reservierung ihn nutzt. */
export function tableBusy(id: string, start: number, dur: number, res: Reservation[], ignore?: string) {
  return res.some(r => r.id !== ignore && usesTable(r, id) && overlaps(start, dur, r.start_min, r.duration_min))
}

/** Tische, deren Kanten höchstens so weit (Planeinheiten) auseinanderliegen, gelten als zusammengestellt. */
export const JOIN_GAP = 12
type P = { x: number; y: number }
export const corners = (t: TableRow): P[] => {
  const a = (t.rot * Math.PI) / 180, c = Math.cos(a), n = Math.sin(a), w = (t.w ?? 0) / 2, h = (t.h ?? 0) / 2
  return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([dx, dy]) => ({ x: (t.x ?? 0) + dx * c - dy * n, y: (t.y ?? 0) + dx * n + dy * c }))
}
const nearOnSeg = (p: P, a: P, b: P): P => {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy
  const k = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0
  return { x: a.x + k * dx, y: a.y + k * dy }
}
/** Abstand zweier gedrehter Rechtecke (0 bei Überlappung) und ein Punkt dazwischen (für die Verbindungsmarke). */
export function tableGap(a: TableRow, b: TableRow): { d: number; mid: P } {
  const A = corners(a), B = corners(b)
  let separated = false
  for (const poly of [A, B]) for (let i = 0; i < 4 && !separated; i++) {
    const e = { x: poly[(i + 1) % 4].x - poly[i].x, y: poly[(i + 1) % 4].y - poly[i].y }
    const proj = (q: P[]) => q.map(v => v.x * -e.y + v.y * e.x)
    const pa = proj(A), pb = proj(B)
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) separated = true
  }
  const centre = { x: ((a.x ?? 0) + (b.x ?? 0)) / 2, y: ((a.y ?? 0) + (b.y ?? 0)) / 2 }
  if (!separated) return { d: 0, mid: centre }
  let best = Infinity, mid = centre
  for (const [P1, P2] of [[A, B], [B, A]]) for (const v of P1) for (let i = 0; i < 4; i++) {
    const q = nearOnSeg(v, P2[i], P2[(i + 1) % 4]), d = Math.hypot(v.x - q.x, v.y - q.y)
    if (d < best) { best = d; mid = { x: (v.x + q.x) / 2, y: (v.y + q.y) / 2 } }
  }
  return { d: best, mid }
}
/** Zusammenliegende Tische eines Bereichs: Gruppen (ab 2 Tischen) mit Rahmen und die Verbindungspunkte. */
export function joinedGroups(tables: TableRow[]) {
  const ts = tables.filter(t => t.placed), parent = ts.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const links: P[] = []
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
    if (!joined(ts[i], ts[j])) continue
    parent[find(i)] = find(j); links.push(tableGap(ts[i], ts[j]).mid)
  }
  const by = new Map<number, TableRow[]>()
  ts.forEach((t, i) => by.set(find(i), [...(by.get(find(i)) ?? []), t]))
  const frames = [...by.values()].filter(g => g.length > 1).map(g => {
    const pts = g.flatMap(corners)
    const x0 = Math.min(...pts.map(q => q.x)), x1 = Math.max(...pts.map(q => q.x)), y0 = Math.min(...pts.map(q => q.y)), y1 = Math.max(...pts.map(q => q.y))
    return { x0, y0, x1, y1 }
  })
  return { frames, links }
}
export const joined = (a: TableRow, b: TableRow) => a.id !== b.id && a.placed && b.placed && a.room_id === b.room_id && tableGap(a, b).d <= JOIN_GAP

/** Plätze einer Kombination: Summe, je Verbindung entfallen zwei Plätze an der Naht. */
export const groupSeats = (g: TableRow[]) => g.reduce((s, t) => s + t.max_seats, 0) - 2 * (g.length - 1)
export const groupLabel = (g: TableRow[]) => g.map(t => t.label).join(' + ')

export type FindOpts = {
  tables: TableRow[]; rooms: Room[]; res: Reservation[]
  roomId: string; start: number; dur: number; party: number
  /** true = Team vergibt von Hand: schwarze Tische erlaubt */
  manual: boolean; ignore?: string
  /** Tag der Reservierung: gesperrte Bereiche liefern keine Wetter-Reserve */
  day?: string
}

const GAP_CAP = 240

/** Minuten Leerlauf direkt vor oder nach der Reservierung am Tisch (0 = nahtlos, max. GAP_CAP). */
function slack(id: string, start: number, dur: number, res: Reservation[], ignore?: string) {
  let before = GAP_CAP, after = GAP_CAP
  for (const r of res) {
    if (r.id === ignore || !usesTable(r, id)) continue
    const end = r.start_min + r.duration_min
    if (end <= start) before = Math.min(before, start - end)
    else if (r.start_min >= start + dur) after = Math.min(after, r.start_min - (start + dur))
  }
  return Math.min(before, after)
}

/**
 * Freier, passender Tisch im Bereich: unter den Tischen bis zur doppelten Größe des kleinsten passenden
 * zuerst der mit Anschluss an eine andere Reservierung (wenig Leerlauf), dann der kleinste.
 */
export function findTable(o: FindOpts): TableRow | null {
  const c = o.tables
    .filter(t => t.room_id === o.roomId && t.min_seats <= o.party && o.party <= t.max_seats && (o.manual || t.online_bookable) && !tableBusy(t.id, o.start, o.dur, o.res, o.ignore))
  if (!c.length) return null
  const smallest = Math.min(...c.map(t => t.max_seats))
  return c.filter(t => t.max_seats <= 2 * smallest)
    .sort((a, b) => slack(a.id, o.start, o.dur, o.res, o.ignore) - slack(b.id, o.start, o.dur, o.res, o.ignore) || a.max_seats - b.max_seats || a.min_seats - b.min_seats)[0]
}

/**
 * Passt kein einzelner Tisch, werden bis zu drei zusammenliegende freie Tische kombiniert
 * (kleinste ausreichende Kombination, dann die mit den wenigsten Tischen).
 */
export function findCombo(o: FindOpts): TableRow[] | null {
  const free = o.tables.filter(t => t.room_id === o.roomId && t.placed && (o.manual || t.online_bookable) && !tableBusy(t.id, o.start, o.dur, o.res, o.ignore))
  const adj = (a: TableRow) => free.filter(b => joined(a, b))
  const seen = new Set<string>(), found: TableRow[][] = []
  const add = (g: TableRow[]) => {
    const k = g.map(t => t.id).sort().join()
    if (!seen.has(k)) { seen.add(k); if (groupSeats(g) >= o.party && o.party > Math.max(...g.map(t => t.max_seats))) found.push(g) }
  }
  for (const a of free) for (const b of adj(a)) {
    add([a, b])
    for (const c of [...adj(a), ...adj(b)]) if (c.id !== a.id && c.id !== b.id) add([a, b, c])
  }
  found.sort((x, y) => groupSeats(x) - groupSeats(y) || x.length - y.length)
  return found[0] ? [...found[0]].sort((p, q) => p.label.localeCompare(q.label, 'de', { numeric: true })) : null
}

/** Wetter-Reserve: Ein Tisch drinnen blockiert zusätzlich einen freien Tisch draußen, der die Gruppe fasst. */
export function findReserve(o: FindOpts, chosen: TableRow): TableRow | null {
  const room = o.rooms.find(r => r.id === chosen.room_id)
  if (!room || room.outdoor) return null
  const outdoor = new Set(o.rooms.filter(r => r.outdoor && !(o.day && roomClosed(r, o.day))).map(r => r.id))
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

/** Bereich an diesem Tag gesperrt (dauerhaft oder in einem Sperrzeitraum). */
export const roomClosed = (r: { closed: boolean; closed_ranges: { from: string; to: string }[] }, day: string) =>
  r.closed || (r.closed_ranges ?? []).some(x => x.from <= day && day <= x.to)
