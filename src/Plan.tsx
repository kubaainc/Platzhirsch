import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { supabase, type Layout, type Room, type RoomElement, type TableRow, type Team } from './supabase'

const FORMS: [string, string, number, number, boolean][] = [
  ['quadrat', 'Quadrat', 70, 70, false],
  ['rechteck', 'Rechteck', 110, 62, false],
  ['lang', 'Lang', 200, 56, false],
  ['klein', 'Rund klein', 60, 60, true],
  ['gross', 'Rund groß', 100, 100, true],
  ['oval', 'Oval breit', 556, 80, true],
]
const SNAP_PX = 7
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

export default function Plan({ team, onBack }: { team: Team; onBack: () => void }) {
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
  const [guide, setGuide] = useState<Guide>({})
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [preName, setPreName] = useState('')
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
    setSel(t.id)
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

  if (err && !ready) return <main><p className="err" role="alert">{err}</p></main>
  if (!ready) return <main><p>Lade …</p></main>
  const unplaced = roomTables.filter(t => !t.placed)
  const knob = edit && selected && selected.placed && selected.room_id === roomId && room ? (() => {
    const r = Math.max(selected.w!, selected.h!) / 2 + 34
    const a = ((selected.rot - 90) * Math.PI) / 180
    return { left: ((selected.x! + Math.cos(a) * r) / room.width) * 100, top: ((selected.y! + Math.sin(a) * r) / room.height) * 100 }
  })() : null

  return (
    <main className="wide">
      <p><button className="ghost" onClick={onBack}>← Teams</button></p>
      <h1>{team.name}</h1>
      <div className="bar">
        <div className="tabs" role="tablist">
          {rooms.map(r => (
            <button key={r.id} role="tab" aria-selected={r.id === roomId} className={r.id === roomId ? 'on' : ''} onClick={() => { setRoomId(r.id); setSel(null) }}>{r.name}</button>
          ))}
        </div>
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
          {edit && !selected && <p className="soft">Tisch antippen, ziehen und am Kreis darüber drehen. Alt schaltet das Einrasten aus.</p>}
          <div className={`plan${edit ? ' edit' : ''}`} ref={planRef} style={{ aspectRatio: `${room.width}/${room.height}` }} onPointerDown={e => { if (edit && e.target === e.currentTarget) setSel(null) }}>
            <svg viewBox={`0 0 ${room.width} ${room.height}`} preserveAspectRatio="none" aria-hidden="true">
              {elements.filter(x => x.room_id === roomId && x.kind === 'wall' && x.path).map(x => (
                <path key={x.id} d={x.path!} fill="none" stroke="#9a9a8c" strokeWidth={3} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              ))}
              {elements.filter(x => x.room_id === roomId && x.kind !== 'wall' && x.x != null).map(x => (
                <rect key={x.id} x={x.x! - x.w! / 2} y={x.y! - x.h! / 2} width={x.w!} height={x.h!} fill="#e4e4d8" transform={`rotate(${x.rot} ${x.x} ${x.y})`} />
              ))}
              {guide.x != null && <line x1={guide.x} x2={guide.x} y1={0} y2={room.height} stroke="#9A3334" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
              {guide.y != null && <line y1={guide.y} y2={guide.y} x1={0} x2={room.width} stroke="#9A3334" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
            </svg>
            {roomTables.filter(t => t.placed).map(t => (
              <div
                key={t.id}
                className={`tb${t.round ? ' round' : ''}${t.online_bookable ? '' : ' black'}${t.id === sel && edit ? ' sel' : ''}`}
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
    </main>
  )
}
