import { useState, type FormEvent } from 'react'
import { supabase, type Room } from './supabase'

/** Bereiche als Tabs. Im Bearbeitungsmodus erscheint rechts daneben ein „+“ für neue Bereiche. */
export function RoomTabs({ teamId, rooms, roomId, onSelect, showAdd, onAdded, onDeleted }: {
  teamId: string; rooms: Room[]; roomId: string; onSelect: (id: string) => void; showAdd: boolean; onAdded: (r: Room) => void; onDeleted: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [outdoor, setOutdoor] = useState(false)
  const [w, setW] = useState(1200)
  const [h, setH] = useState(800)
  const [err, setErr] = useState('')
  const clamp = (v: number) => Math.max(300, Math.min(4000, Math.round(v) || 300))
  async function del(room: Room) {
    setErr('')
    const { count } = await supabase.from('tables').select('id', { count: 'exact', head: true }).eq('room_id', room.id)
    if (!window.confirm(`Bereich „${room.name}“ mit ${count ?? 0} Tischen wirklich löschen? Reservierungen an diesen Tischen verlieren ihren Tisch.`)) return
    const { error } = await supabase.from('rooms').delete().eq('id', room.id)
    if (error) return setErr(error.message)
    onDeleted(room.id)
  }
  async function add(e: FormEvent) {
    e.preventDefault(); setErr('')
    const sort = Math.max(-1, ...rooms.map(r => r.sort)) + 1
    const { data, error } = await supabase.from('rooms').insert({ team_id: teamId, name: name.trim(), sort, outdoor, width: clamp(w), height: clamp(h) }).select().single()
    if (error) return setErr(error.message)
    onAdded(data as Room); setName(''); setOutdoor(false); setW(1200); setH(800); setAdding(false)
  }
  return (
    <>
      <div className="tabs" role="tablist">
        {rooms.map(r => (
          <span key={r.id} className="tabwrap">
            <button role="tab" aria-selected={r.id === roomId} className={r.id === roomId ? 'on' : ''} onClick={() => onSelect(r.id)}>{r.name}</button>
            {showAdd && r.id === roomId && <button className="tabx" aria-label={`Bereich ${r.name} löschen`} title="Bereich löschen" onClick={() => del(r)}>×</button>}
          </span>
        ))}
        {showAdd && <button className="plus" aria-label="Bereich hinzufügen" aria-expanded={adding} onClick={() => setAdding(!adding)}>+</button>}
      </div>
      {err && !adding && <p className="err" role="alert">{err}</p>}
      {showAdd && adding && (
        <form className="pp" onSubmit={add}>
          <label>Name des Bereichs<input required autoFocus value={name} maxLength={30} placeholder="z. B. Lounge" onChange={e => setName(e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={outdoor} onChange={e => setOutdoor(e.target.checked)} />Draußen (Wetter-Reserve)</label>
          <label>Breite<input className="num" type="number" min={300} max={4000} step={10} required value={w} onChange={e => setW(Number(e.target.value))} /></label>
          <label>Höhe<input className="num" type="number" min={300} max={4000} step={10} required value={h} onChange={e => setH(Number(e.target.value))} /></label>
          <button type="submit">Bereich anlegen</button>
          {err && <p className="err" role="alert">{err}</p>}
        </form>
      )}
    </>
  )
}

/** Name, Draußen und Maße eines Bereichs. Änderungen werden sofort gespeichert. */
export function RoomSettings({ room, showSize, onChange }: { room: Room; showSize: boolean; onChange: (r: Room) => void }) {
  const [err, setErr] = useState('')
  async function patch(p: Partial<Room>) {
    setErr('')
    const next = { ...room, ...p }
    onChange(next)
    const { error } = await supabase.from('rooms').update(p).eq('id', room.id)
    if (error) setErr(error.message)
  }
  const num = (k: 'width' | 'height') => (
    <label>{k === 'width' ? 'Breite' : 'Höhe'}<input className="num" type="number" min={300} max={4000} step={10} defaultValue={room[k]} key={room.id + k + room[k]}
      onBlur={e => { const v = Math.max(300, Math.min(4000, Math.round(+e.target.value) || room[k])); if (v !== room[k]) patch({ [k]: v }) }} /></label>
  )
  return (
    <div className="pp">
      <label>Bereich<input defaultValue={room.name} key={room.id + 'n'} maxLength={30} onBlur={e => { const v = e.target.value.trim(); if (v && v !== room.name) patch({ name: v }) }} /></label>
      <label className="check"><input type="checkbox" checked={room.outdoor} onChange={e => patch({ outdoor: e.target.checked })} />Draußen</label>
      {showSize && <>{num('width')}{num('height')}</>}
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  )
}

/** Bereich sperren: dauerhaft oder für Zeiträume. Wird in der Zeitleiste neben „Tag sperren“ geöffnet. */
export function RoomLock({ room, onChange }: { room: Room; onChange: (r: Room) => void }) {
  const [err, setErr] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  async function patch(p: Partial<Room>) {
    setErr('')
    onChange({ ...room, ...p })
    const { error } = await supabase.from('rooms').update(p).eq('id', room.id)
    if (error) setErr(error.message)
  }
  return (
    <div className="pp">
      <b>{room.name}</b>
      <label className="check"><input type="checkbox" checked={room.closed} onChange={e => patch({ closed: e.target.checked })} />Gesperrt (online nicht buchbar)</label>
      <div className="ranges">
        {room.closed_ranges.map((x, i) => (
          <span key={i}>Gesperrt {x.from.split('-').reverse().join('.')} bis {x.to.split('-').reverse().join('.')}
            <button className="ghost" onClick={() => patch({ closed_ranges: room.closed_ranges.filter((_, j) => j !== i) })}>Entfernen</button></span>
        ))}
        <span>
          <label>Sperren von<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label>bis<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
          <button className="ghost" disabled={!from || !to || to < from} onClick={() => { patch({ closed_ranges: [...room.closed_ranges, { from, to }] }); setFrom(''); setTo('') }}>Zeitraum sperren</button>
        </span>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  )
}
