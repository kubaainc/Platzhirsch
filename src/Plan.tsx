import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { RoomSettings, RoomTabs } from './RoomTabs'
import { supabase, type Layout, type Reservation, type Room, type RoomElement, type TableRow, type Team } from './supabase'
import { isoDay, tableBusy } from './booking'

const FORMS: [string, string, number, number, boolean][] = [
  ['quadrat', 'Quadrat', 70, 70, false],
  ['rechteck', 'Rechteck', 110, 62, false],
  ['lang', 'Lang', 200, 56, false],
  ['klein', 'Rund klein', 60, 60, true],
  ['gross', 'Rund groß', 100, 100, true],
  ['oval', 'Oval breit', 556, 80, true],
]
const SNAP_PX = 7
type Pt = { x: number; y: number }
const parsePath = (d: string): Pt[] => {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number), pts: Pt[] = []
  for (let i = 0; i + 1 < n.length; i += 2) pts.push({ x: n[i], y: n[i + 1] })
  return pts
}
const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p.x)},${Math.round(p.y)}`).join(' ') + ' Z'
const normRot = (r: number) => ((Math.round(r) + 180) % 360 + 360) % 360 - 180
const tableKeys = ['label', 'min_seats', 'max_seats', 'online_bookable', 'placed', 'x', 'y', 'w', 'h', 'rot', 'round'] as const
const same = (a: TableRow, b: TableRow) => tableKeys.every(k => a[k] === b[k])

type Guide = { x?: number; y?: number }

/** Verschiebt x/y so, dass Kanten und Mitten an anderen Tischen einrasten. Nur bei Drehung 0°/90°. */
function snapTo(t: TableRow, x: number, y: number, others: TableRow[], th: number) {
  const swap = Math.abs(t.rot) % 180 === 90
  const hw = (swap ? t.h! : t.w!) / 2, hh = (swap ? t.w! : t.h!) / 2
  const gx: Guide = {}
  let bx = th, by = th
  for (const o of others) {
    if (o.id === t.id || !o.placed || Math.abs(o.rot) % 90 !== 0) continue
    const oswap = Math.abs(o.rot) % 180 === 90
    const ohw = (oswap ? o.h! : o.w!) / 2, ohh = (oswap ? o.w! : o.h!) / 2
    for (const [target, line] of [[o.x!, o.x!], [o.x! - ohw + hw, o.x! - ohw], [o.x! + ohw - hw, o.x! + ohw], [o.x! - ohw - hw, o.x! - ohw], [o.x! + ohw + hw, o.x! + ohw]]) {
      const d = Math.abs(x - target); if (d < bx) { bx = d; gx.x = line; x = target }
    }
    for (const [target, line] of [[o.y!, o.y!], [o.y! - ohh + hh, o.y! - ohh], [o.y! + ohh - hh, o.y! + ohh], [o.y! - ohh - hh, o.y! - ohh], [o.y! + ohh + hh, o.y! + ohh]]) {
      const d = Math.abs(y - target); if (d < by) { by = d; gx.y = line; y = target }
    }
  }
  return { x, y, guide: gx }
}

export default function Plan({ team }: { team: Team }) {
  const canEdit = team.role === 'admin' || team.role === 'editor'
  const [rooms, setRooms] = useState<Room[]>([])
  const [elements, setElements] = useState<RoomElement[]>([])
  const [tables, setTables] = useState<TableRow[]>([])
  const [orig, setOrig] = useState<TableRow[]>([])
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [ready, setReady] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [edit, setEdit] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [selEl, setSelEl] = useState<string | null>(null)
  const [guide, setGuide] = useState<Guide>({})
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [preName, setPreName] = useState('')
  const [shape, setShape] = useState(false)
  const [selVtx, setSelVtx] = useState<number | null>(null)
  useEffect(() => { if (!edit) setShape(false) }, [edit])
  const [occ, setOcc] = useState(false)
  const [occDay, setOccDay] = useState(isoDay(new Date()))
  const [occTime, setOccTime] = useState('19:00')
  const [onlyFree, setOnlyFree] = useState(false)
  const [dayRes, setDayRes] = useState<Reservation[]>([])
  useEffect(() => {
    if (!occ) return
    supabase.from('reservations').select('*').eq('team_id', team.id).eq('day', occDay).then(({ data }) => setDayRes((data as Reservation[] | null) ?? []))
  }, [occ, occDay, team.id])
  const planRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      const [r, e, t, l] = await Promise.all([
        supabase.from('rooms').select('*').eq('team_id', team.id).order('sort'),
        supabase.from('room_elements').select('*').eq('team_id', team.id),
        supabase.from('tables').select('*').eq('team_id', team.id),
        supabase.from('layouts').select('*').eq('team_id', team.id).order('name'),
      ])
      const error = r.error || e.error || t.error || l.error
      if (error) return setErr(error.message)
      setRooms(r.data as Room[]); setElements(e.data as RoomElement[])
      setTables(t.data as TableRow[]); setOrig(t.data as TableRow[]); setLayouts(l.data as Layout[])
      setRoomId((r.data as Room[])[0]?.id ?? ''); setReady(true)
    })()
  }, [team.id])

  const room = rooms.find(r => r.id === roomId)
  const roomTables = useMemo(() => tables.filter(t => t.room_id === roomId), [tables, roomId])
  const selected = tables.find(t => t.id === sel) ?? null
  const update = (id: string, patch: Partial<TableRow>) => setTables(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)))
  const dirty = tables.filter(t => { const o = orig.find(x => x.id === t.id); return o && !same(o, t) })

  function toRoom(e: { clientX: number; clientY: number }) {
    const rc = planRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - rc.left) / rc.width) * room!.width, y: ((e.clientY - rc.top) / rc.height) * room!.height, scale: room!.width / rc.width }
  }

  function startDrag(e: RPointerEvent, t: TableRow) {
    if (!edit) return
    setSel(t.id); setSelEl(null)
    e.currentTarget.setPointerCapture(e.pointerId)
    const p0 = toRoom(e), x0 = t.x!, y0 = t.y!
    const el = e.currentTarget as HTMLElement
    const move = (ev: PointerEvent) => {
      const p = toRoom(ev)
      let x = Math.max(0, Math.min(room!.width, x0 + p.x - p0.x))
      let y = Math.max(0, Math.min(room!.height, y0 + p.y - p0.y))
      if (!ev.altKey) { const s = snapTo(t, x, y, roomTables, SNAP_PX * p.scale); x = s.x; y = s.y; setGuide(s.guide) } else setGuide({})
      update(t.id, { x, y })
    }
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); setGuide({}) }
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up)
  }

  function startRotate(e: RPointerEvent, t: TableRow) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const el = e.currentTarget as HTMLElement
    const move = (ev: PointerEvent) => {
      const p = toRoom(ev)
      let deg = (Math.atan2(p.y - t.y!, p.x - t.x!) * 180) / Math.PI + 90
      deg = normRot(deg)
      if (!ev.altKey) { const n = Math.round(deg / 45) * 45; if (Math.abs(deg - n) <= 6) deg = n }
      update(t.id, { rot: normRot(deg) })
    }
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up) }
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up)
  }

  const center = () => ({ x: Math.round(room!.width / 2), y: Math.round(room!.height / 2) })
  const updEl = (id: string, patch: Partial<RoomElement>) => setElements(es => es.map(x => (x.id === id ? { ...x, ...patch } : x)))
  async function saveEl(id: string, patch: Partial<RoomElement>) {
    const { error } = await supabase.from('room_elements').update(patch).eq('id', id)
    if (error) setErr(error.message)
  }
  async function addElement() {
    setErr('')
    const { data, error } = await supabase.from('room_elements').insert({ team_id: team.id, room_id: roomId, kind: 'rect', ...center(), w: 120, h: 80, rot: 0 }).select().single()
    if (error) return setErr(error.message)
    setElements(es => [...es, data as RoomElement]); setSelEl((data as RoomElement).id); setSel(null)
  }
  const wall = elements.find(x => x.room_id === roomId && x.kind === 'wall' && x.path)
  const wallPts = wall ? parsePath(wall.path!) : []
  async function createWall() {
    setErr('')
    const m = 20, path = toPath([{ x: m, y: m }, { x: room!.width - m, y: m }, { x: room!.width - m, y: room!.height - m }, { x: m, y: room!.height - m }])
    const { data, error } = await supabase.from('room_elements').insert({ team_id: team.id, room_id: roomId, kind: 'wall', path }).select().single()
    if (error) return setErr(error.message)
    setElements(es => [...es, data as RoomElement]); setShape(true)
  }
  function setPts(pts: Pt[], save: boolean) {
    if (!wall) return
    const path = toPath(pts)
    updEl(wall.id, { path })
    if (save) saveEl(wall.id, { path })
  }
  function startDragVtx(e: RPointerEvent, i: number, pts: Pt[]) {
    e.stopPropagation(); e.preventDefault()
    setSelVtx(i)
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    let cur = pts
    const move = (ev: PointerEvent) => {
      const p = toRoom(ev)
      let x = Math.max(0, Math.min(room!.width, p.x)), y = Math.max(0, Math.min(room!.height, p.y))
      if (!ev.altKey) {
        const near = SNAP_PX * p.scale
        for (const o of cur.filter((_, j) => j !== i)) { if (Math.abs(o.x - x) <= near) x = o.x; if (Math.abs(o.y - y) <= near) y = o.y }
        if (Math.abs(x - 0) <= near) x = 0; if (Math.abs(y - 0) <= near) y = 0
      }
      cur = cur.map((q, j) => (j === i ? { x, y } : q)); setPts(cur, false)
    }
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); setPts(cur, true) }
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up)
  }
  function insertVtx(e: RPointerEvent, i: number, pts: Pt[]) {
    e.stopPropagation(); e.preventDefault()
    const a = pts[i], b = pts[(i + 1) % pts.length]
    const next = [...pts.slice(0, i + 1), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ...pts.slice(i + 1)]
    setPts(next, true); setSelVtx(i + 1)
  }
  function delVtx() {
    if (selVtx === null || wallPts.length <= 3) return
    setPts(wallPts.filter((_, j) => j !== selVtx), true); setSelVtx(null)
  }
  async function delElement(id: string) {
    const { error } = await supabase.from('room_elements').delete().eq('id', id)
    if (error) return setErr(error.message)
    setElements(es => es.filter(x => x.id !== id)); setSelEl(null)
  }
  function startDragEl(e: RPointerEvent, x0: RoomElement) {
    if (!edit) return
    setSelEl(x0.id); setSel(null)
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const p0 = toRoom(e)
    let last = { x: x0.x!, y: x0.y! }
    const move = (ev: PointerEvent) => {
      const p = toRoom(ev)
      last = { x: Math.max(0, Math.min(room!.width, Math.round(x0.x! + p.x - p0.x))), y: Math.max(0, Math.min(room!.height, Math.round(x0.y! + p.y - p0.y))) }
      updEl(x0.id, last)
    }
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); saveEl(x0.id, last) }
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up)
  }
  async function addTable() {
    setErr('')
    const n = tables.filter(t => t.room_id === roomId).length + 1
    const row = { team_id: team.id, room_id: roomId, label: `Tisch ${n}`, min_seats: 2, max_seats: 4, online_bookable: true, placed: true, ...center(), w: 110, h: 62, rot: 0, round: false }
    const { data, error } = await supabase.from('tables').insert(row).select().single()
    if (error) return setErr(error.message)
    setTables(ts => [...ts, data as TableRow]); setOrig(o => [...o, data as TableRow]); setSel((data as TableRow).id); setSelEl(null)
  }
  async function delTable(t: TableRow) {
    const { count } = await supabase.from('reservations').select('id', { count: 'exact', head: true }).or(`table_id.eq.${t.id},alt_table_id.eq.${t.id}`)
    if (count) return setErr(`Tisch ${t.label} hat Reservierungen. Bitte erst verschieben oder stornieren.`)
    const { error } = await supabase.from('tables').delete().eq('id', t.id)
    if (error) return setErr(error.message)
    setTables(ts => ts.filter(x => x.id !== t.id)); setOrig(o => o.filter(x => x.id !== t.id)); setSel(null)
  }

  async function persist(rows: TableRow[]) {
    if (!rows.length) return true
    const { error } = await supabase.from('tables').upsert(rows)
    if (error) { setErr(error.message); return false }
    setOrig(o => o.map(x => rows.find(r => r.id === x.id) ?? x))
    return true
  }

  async function done() {
    setErr('')
    if (await persist(dirty)) { setEdit(false); setSel(null); setMsg('Plan gespeichert') }
  }
  function cancel() { setTables(orig); setEdit(false); setSel(null); setMsg('') }

  async function saveLayout() {
    const name = preName.trim(); if (!name) return
    setErr('')
    if (!(await persist(dirty))) return
    const data = tables.map(t => ({ id: t.id, ...Object.fromEntries(tableKeys.map(k => [k, t[k]])) }))
    const { data: row, error } = await supabase.from('layouts').upsert({ team_id: team.id, name, data }, { onConflict: 'team_id,name' }).select().single()
    if (error) return setErr(error.message)
    setLayouts(ls => [...ls.filter(l => l.name !== name), row as Layout].sort((a, b) => a.name.localeCompare(b.name)))
    setMsg(`Anordnung „${name}“ gespeichert`); setPreName('')
  }
  async function loadLayout(l: Layout) {
    setErr('')
    const next = tables.map(t => { const d = l.data.find(x => x.id === t.id); return d ? ({ ...t, ...d } as TableRow) : t })
    const changed = next.filter(t => { const o = orig.find(x => x.id === t.id); return o && !same(o, t) })
    setTables(next); setSel(null)
    if (await persist(changed)) setMsg(`Anordnung „${l.name}“ geladen`)
  }
  async function deleteLayout(l: Layout) {
    const { error } = await supabase.from('layouts').delete().eq('id', l.id)
    if (error) return setErr(error.message)
    setLayouts(ls => ls.filter(x => x.id !== l.id)); setMsg(`„${l.name}“ gelöscht`)
  }

  if (err && !ready) return <p className="err" role="alert">{err}</p>
  if (!ready) return <p>Lade …</p>
  const unplaced = roomTables.filter(t => !t.placed)
  const occStart = (() => { const [h, m] = occTime.split(':').map(Number); return h * 60 + (m || 0) })()
  const busyNow = (id: string) => occ && !edit && tableBusy(id, occStart, 120, dayRes)
  const knob = edit && selected && selected.placed && selected.room_id === roomId && room ? (() => {
    const r = Math.max(selected.w!, selected.h!) / 2 + 34
    const a = ((selected.rot - 90) * Math.PI) / 180
    return { left: ((selected.x! + Math.cos(a) * r) / room.width) * 100, top: ((selected.y! + Math.sin(a) * r) / room.height) * 100 }
  })() : null

  return (
    <>
      <div className="bar">
        <RoomTabs teamId={team.id} rooms={rooms} roomId={roomId} showAdd={edit} onSelect={id => { setRoomId(id); setSel(null); setSelEl(null) }} onAdded={r => { setRooms(rs => [...rs, r]); setRoomId(r.id) }} />
        {canEdit && (edit
          ? <div className="acts"><button onClick={done}>Fertig</button><button className="ghost" onClick={cancel}>Abbrechen</button></div>
          : <button className="ghost" onClick={() => { setEdit(true); setMsg('') }}>Plan bearbeiten</button>)}
      </div>
      {!room ? <p>Noch kein Bereich angelegt.</p> : (
        <>
          <p className="legend">
            <span><i className="sw" />Online reservierbar</span>
            <span><i className="sw black" />Nicht online reservierbar, nur Team</span>
            <span>{roomTables.length} Tische · {roomTables.reduce((s, t) => s + t.max_seats, 0)} Plätze</span>
          </p>
          {!edit && (
            <div className="occ">
              <label className="inl"><input type="checkbox" checked={occ} onChange={e => setOcc(e.target.checked)} />Belegung anzeigen</label>
              {occ && (
                <>
                  <input type="date" value={occDay} aria-label="Datum" onChange={e => e.target.value && setOccDay(e.target.value)} />
                  <input type="time" step={1800} value={occTime} aria-label="Uhrzeit" onChange={e => e.target.value && setOccTime(e.target.value)} />
                  <label className="inl"><input type="checkbox" checked={onlyFree} onChange={e => setOnlyFree(e.target.checked)} />Nur freie Tische</label>
                  <span className="soft">{roomTables.filter(t => t.placed && !busyNow(t.id)).length} von {roomTables.filter(t => t.placed).length} frei</span>
                </>
              )}
            </div>
          )}
          <div className="presets" role="group" aria-label="Gespeicherte Anordnungen">
            <span className="lbl">Anordnungen</span>
            {layouts.length === 0 && <span className="soft">Noch keine gespeichert</span>}
            {layouts.map(l => (
              <span key={l.id} className="chip">
                {canEdit ? <button onClick={() => loadLayout(l)}>{l.name}</button> : <span className="soft">{l.name}</span>}
                {edit && <button className="x" aria-label={`${l.name} löschen`} onClick={() => deleteLayout(l)}>×</button>}
              </span>
            ))}
            {edit && (
              <span className="pre-new">
                <input value={preName} maxLength={24} placeholder="Name, z. B. Sommer" aria-label="Name der Anordnung" onChange={e => setPreName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveLayout()} />
                <button onClick={saveLayout}>Aktuelle speichern</button>
              </span>
            )}
          </div>
          {edit && selected && selected.room_id === roomId && (
            <div className="pp">
              <label>Name<input value={selected.label} onChange={e => update(selected.id, { label: e.target.value })} /></label>
              <label>Mindestens<input className="num" type="number" min={1} value={selected.min_seats} onChange={e => { const v = Math.max(1, +e.target.value || 1); update(selected.id, { min_seats: v, max_seats: Math.max(v, selected.max_seats) }) }} /></label>
              <label>Höchstens<input className="num" type="number" min={1} value={selected.max_seats} onChange={e => { const v = Math.max(1, +e.target.value || 1); update(selected.id, { max_seats: v, min_seats: Math.min(v, selected.min_seats) }) }} /></label>
              <div className="seg" role="group" aria-label="Form">
                {FORMS.map(([k, name, w, h, round]) => (
                  <button key={k} aria-pressed={selected.w === w && selected.h === h && selected.round === round} onClick={() => update(selected.id, { w, h, round })}>{name}</button>
                ))}
              </div>
              <div className="seg" role="group" aria-label="Online-Reservierung">
                <button aria-pressed={selected.online_bookable} onClick={() => update(selected.id, { online_bookable: true })}>Online reservierbar</button>
                <button aria-pressed={!selected.online_bookable} onClick={() => update(selected.id, { online_bookable: false })}><i className="sw black" />Nicht online reservierbar</button>
              </div>
            </div>
          )}
          {edit && (
            <div className="acts wrap">
              <button className="ghost" onClick={addTable}>+ Tisch</button>
              <button className="ghost" onClick={addElement}>+ Element (grau)</button>
              {selected && selected.room_id === roomId && <button className="danger" onClick={() => delTable(selected)}>Tisch löschen</button>}
            </div>
          )}
          {edit && unplaced.length > 0 && (
            <p className="unplaced">Noch nicht im Plan: {unplaced.map(t => <button key={t.id} className="chip-b" onClick={() => { update(t.id, { placed: true, ...center(), w: 110, h: 62, rot: 0, round: false }); setSel(t.id) }}>{t.label}</button>)}</p>
          )}
          {edit && !selected && selEl && (() => {
            const x = elements.find(y => y.id === selEl); if (!x) return null
            const num = (k: 'w' | 'h', label: string) => <label>{label}<input className="num" type="number" min={10} max={3000} value={x[k] ?? 0} onChange={e => updEl(x.id, { [k]: Math.max(10, +e.target.value || 10) })} onBlur={() => saveEl(x.id, { w: x.w, h: x.h })} /></label>
            return (
              <div className="pp">
                <b>Graues Element</b>{num('w', 'Breite')}{num('h', 'Höhe')}
                <button className="ghost" onClick={() => { const r = x.rot === 90 ? 0 : 90; updEl(x.id, { rot: r }); saveEl(x.id, { rot: r }) }}>Drehen (90°)</button>
                <button className="danger" onClick={() => delElement(x.id)}>Element löschen</button>
              </div>
            )
          })()}
          {edit && !selected && !selEl && room && (
            <>
              <RoomSettings room={room} showSize onChange={r => setRooms(rs => rs.map(x => (x.id === r.id ? r : x)))} onDeleted={id => { const rest = rooms.filter(r => r.id !== id); setRooms(rest); setRoomId(rest[0]?.id ?? '') }} />
              <div className="shape">
                {!wall
                  ? <button className="ghost" onClick={createWall}>Raumform anlegen (Wände)</button>
                  : <button className="ghost" aria-pressed={shape} onClick={() => { setShape(!shape); setSelVtx(null) }}>{shape ? 'Raumform fertig' : 'Raumform bearbeiten'}</button>}
                {shape && wall && (
                  <>
                    <button className="ghost" disabled={selVtx === null || wallPts.length <= 3} onClick={delVtx}>Ausgewählte Ecke löschen</button>
                    <span className="soft">Ecken ziehen, am „+“ zwischen zwei Ecken eine neue Ecke einfügen. Alt schaltet das Einrasten aus.</span>
                  </>
                )}
              </div>
              <p className="soft">Tisch oder graues Element antippen und ziehen, am Kreis drehen. Alt schaltet das Einrasten aus.</p>
            </>
          )}
          <div className={`plan${edit ? ' edit' : ''}`} ref={planRef} style={{ aspectRatio: `${room.width}/${room.height}` }} onPointerDown={e => { if (edit && e.target === e.currentTarget) { setSel(null); setSelEl(null) } }}>
            <svg viewBox={`0 0 ${room.width} ${room.height}`} preserveAspectRatio="none" aria-hidden="true">
              {elements.filter(x => x.room_id === roomId && x.kind === 'wall' && x.path).map(x => (
                <path key={x.id} d={x.path!} fill="none" stroke="#9a9a8c" strokeWidth={3} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              ))}
              {guide.x != null && <line x1={guide.x} x2={guide.x} y1={0} y2={room.height} stroke="#9A3334" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
              {guide.y != null && <line y1={guide.y} y2={guide.y} x1={0} x2={room.width} stroke="#9A3334" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
            </svg>
            {elements.filter(x => x.room_id === roomId && x.kind !== 'wall' && x.x != null).map(x => (
              <div key={x.id} className={`el${x.id === selEl && edit ? ' sel' : ''}`} onPointerDown={e => startDragEl(e, x)}
                style={{ left: `${(x.x! / room.width) * 100}%`, top: `${(x.y! / room.height) * 100}%`, width: `${(x.w! / room.width) * 100}%`, height: `${(x.h! / room.height) * 100}%`, transform: `translate(-50%,-50%) rotate(${x.rot}deg)` }} />
            ))}
            {roomTables.filter(t => t.placed).map(t => (
              <div
                key={t.id}
                className={`tb${t.round ? ' round' : ''}${t.online_bookable ? '' : ' black'}${busyNow(t.id) ? (onlyFree ? ' dim' : ' busy') : ''}${t.id === sel && edit ? ' sel' : ''}`}
                style={{
                  left: `${(t.x! / room.width) * 100}%`, top: `${(t.y! / room.height) * 100}%`,
                  width: `${(t.w! / room.width) * 100}%`, height: `${(t.h! / room.height) * 100}%`,
                  transform: `translate(-50%,-50%) rotate(${t.rot}deg)`,
                }}
                onPointerDown={e => startDrag(e, t)}
                role={edit ? 'button' : undefined}
                tabIndex={edit ? 0 : undefined}
                onKeyDown={edit ? e => { if (e.key === 'Enter' || e.key === ' ') setSel(t.id) } : undefined}
                aria-label={`Tisch ${t.label}, ${t.min_seats} bis ${t.max_seats} Personen${t.online_bookable ? '' : ', nur Team'}`}
              >
                <span style={{ transform: `rotate(${-t.rot}deg)` }}><b>{t.label}</b><small>{t.min_seats}–{t.max_seats}p</small></span>
              </div>
            ))}
            {edit && shape && wallPts.length > 0 && (
              <>
                {wallPts.map((p, i) => {
                  const q = wallPts[(i + 1) % wallPts.length]
                  return <button type="button" key={`m${i}`} className="mid" aria-label={`Punkt zwischen Ecke ${i + 1} und ${((i + 1) % wallPts.length) + 1} einfügen`}
                    style={{ left: `${(((p.x + q.x) / 2) / room.width) * 100}%`, top: `${(((p.y + q.y) / 2) / room.height) * 100}%` }} onPointerDown={e => insertVtx(e, i, wallPts)}>+</button>
                })}
                {wallPts.map((p, i) => (
                  <button type="button" key={`v${i}`} className={`vtx${i === selVtx ? ' sel' : ''}`} aria-label={`Ecke ${i + 1} verschieben`}
                    style={{ left: `${(p.x / room.width) * 100}%`, top: `${(p.y / room.height) * 100}%` }} onPointerDown={e => startDragVtx(e, i, wallPts)} />
                ))}
              </>
            )}
            {knob && selected && (
              <>
                <button
                  className="knob" style={{ left: `${knob.left}%`, top: `${knob.top}%` }}
                  aria-label="Tisch drehen. Pfeiltasten links und rechts drehen in 5-Grad-Schritten."
                  onPointerDown={e => startRotate(e, selected)}
                  onKeyDown={e => { if (e.key === 'ArrowLeft') update(selected.id, { rot: normRot(selected.rot - 5) }); if (e.key === 'ArrowRight') update(selected.id, { rot: normRot(selected.rot + 5) }) }}
                >↻</button>
                <span className="rdo" style={{ left: `${knob.left}%`, top: `${knob.top}%` }}>{selected.rot}°</span>
              </>
            )}
          </div>
          {unplaced.length > 0 && <p>Nicht platziert: {unplaced.map(t => t.label).join(', ')}</p>}
        </>
      )}
      <div aria-live="polite">{msg && <p className="toast">{msg}</p>}{err && <p className="err" role="alert">{err}</p>}</div>
    </>
  )
}
