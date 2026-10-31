import { useState, type FormEvent } from 'react'
import { supabase, type Room } from './supabase'

/** Bereiche als Tabs. Im Bearbeitungsmodus erscheint rechts daneben ein „+“ für neue Bereiche. */
export function RoomTabs({ teamId, rooms, roomId, onSelect, showAdd, onAdded }: {
  teamId: string; rooms: Room[]; roomId: string; onSelect: (id: string) => void; showAdd: boolean; onAdded: (r: Room) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [outdoor, setOutdoor] = useState(false)
  const [err, setErr] = useState('')
  async function add(e: FormEvent) {
    e.preventDefault(); setErr('')
    const sort = Math.max(-1, ...rooms.map(r => r.sort)) + 1
    const { data, error } = await supabase.from('rooms').insert({ team_id: teamId, name: name.trim(), sort, outdoor }).select().single()
    if (error) return setErr(error.message)
    onAdded(data as Room); setName(''); setOutdoor(false); setAdding(false)
  }
  return (
    <>
      <div className="tabs" role="tablist">
        {rooms.map(r => <button key={r.id} role="tab" aria-selected={r.id === roomId} className={r.id === roomId ? 'on' : ''} onClick={() => onSelect(r.id)}>{r.name}</button>)}
        {showAdd && <button className="plus" aria-label="Bereich hinzufügen" aria-expanded={adding} onClick={() => setAdding(!adding)}>+</button>}
      </div>
      {showAdd && adding && (
        <form className="pp" onSubmit={add}>
          <label>Name des Bereichs<input required autoFocus value={name} maxLength={30} placeholder="z. B. Lounge" onChange={e => setName(e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={outdoor} onChange={e => setOutdoor(e.target.checked)} />Draußen (Wetter-Reserve)</label>
          <button type="submit">Bereich anlegen</button>
          {err && <p className="err" role="alert">{err}</p>}
        </form>
      )}
    </>
  )
}

/** Name, Draußen, Maße und Löschen eines Bereichs. Änderungen werden sofort gespeichert. */
export function RoomSettings({ room, showSize, onChange, onDeleted }: { room: Room; showSize: boolean; onChange: (r: Room) => void; onDeleted: (id: string) => void }) {
  const [err, setErr] = useState('')
  async function patch(p: Partial<Room>) {
    setErr('')
    const next = { ...room, ...p }
    onChange(next)
    const { error } = await supabase.from('rooms').update(p).eq('id', room.id)
    if (error) setErr(error.message)
  }
  async function del() {
    setErr('')
    const { count } = await supabase.from('tables').select('id', { count: 'exact', head: true }).eq('room_id', room.id)
    if (!window.confirm(`Bereich „${room.name}“ mit ${count ?? 0} Tischen wirklich löschen? Reservierungen an diesen Tischen verlieren ihren Tisch.`)) return
    const { error } = await supabase.from('rooms').delete().eq('id', room.id)
    if (error) return setErr(error.message)
    onDeleted(room.id)
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
      <button className="danger" type="button" onClick={del}>Bereich löschen</button>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  )
}
