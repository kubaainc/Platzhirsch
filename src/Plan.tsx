import { useEffect, useState } from 'react'
import { supabase, type Room, type RoomElement, type TableRow, type Team } from './supabase'

type Data = { rooms: Room[]; elements: RoomElement[]; tables: TableRow[] }

export default function Plan({ team, onBack }: { team: Team; onBack: () => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [roomId, setRoomId] = useState<string>('')
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      const [r, e, t] = await Promise.all([
        supabase.from('rooms').select('*').eq('team_id', team.id).order('sort'),
        supabase.from('room_elements').select('*').eq('team_id', team.id),
        supabase.from('tables').select('*').eq('team_id', team.id),
      ])
      const error = r.error || e.error || t.error
      if (error) return setErr(error.message)
      const rooms = r.data as Room[]
      setData({ rooms, elements: e.data as RoomElement[], tables: t.data as TableRow[] })
      setRoomId(rooms[0]?.id ?? '')
    })()
  }, [team.id])

  if (err) return <main><p className="err" role="alert">{err}</p></main>
  if (!data) return <main><p>Lade …</p></main>
  const room = data.rooms.find(r => r.id === roomId)
  const tables = data.tables.filter(t => t.room_id === roomId)
  const elements = data.elements.filter(x => x.room_id === roomId)
  const unplaced = tables.filter(t => !t.placed)

  return (
    <main className="wide">
      <p><button className="ghost" onClick={onBack}>← Teams</button></p>
      <h1>{team.name}</h1>
      <div className="tabs" role="tablist">
        {data.rooms.map(r => (
          <button key={r.id} role="tab" aria-selected={r.id === roomId} className={r.id === roomId ? 'on' : ''} onClick={() => setRoomId(r.id)}>
            {r.name}
          </button>
        ))}
      </div>
      {!room ? <p>Noch kein Bereich angelegt.</p> : (
        <>
          <p className="legend">
            <span><i className="sw" />Online reservierbar</span>
            <span><i className="sw black" />Nicht online reservierbar, nur Team</span>
            <span>{tables.length} Tische · {tables.reduce((s, t) => s + t.max_seats, 0)} Plätze</span>
          </p>
          <div className="plan" style={{ aspectRatio: `${room.width}/${room.height}` }}>
            <svg viewBox={`0 0 ${room.width} ${room.height}`} preserveAspectRatio="none" aria-hidden="true">
              {elements.filter(x => x.kind === 'wall' && x.path).map(x => (
                <path key={x.id} d={x.path!} fill="none" stroke="#9a9a8c" strokeWidth={3} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              ))}
              {elements.filter(x => x.kind !== 'wall' && x.x != null).map(x => (
                <rect key={x.id} x={x.x! - x.w! / 2} y={x.y! - x.h! / 2} width={x.w!} height={x.h!} fill="#e4e4d8" transform={`rotate(${x.rot} ${x.x} ${x.y})`} />
              ))}
            </svg>
            {tables.filter(t => t.placed).map(t => (
              <div
                key={t.id}
                className={`tb${t.round ? ' round' : ''}${t.online_bookable ? '' : ' black'}`}
                style={{
                  left: `${(t.x! / room.width) * 100}%`, top: `${(t.y! / room.height) * 100}%`,
                  width: `${(t.w! / room.width) * 100}%`, height: `${(t.h! / room.height) * 100}%`,
                  transform: `translate(-50%,-50%) rotate(${t.rot}deg)`,
                }}
                aria-label={`Tisch ${t.label}, ${t.min_seats} bis ${t.max_seats} Personen${t.online_bookable ? '' : ', nur Team'}`}
              >
                <span style={{ transform: `rotate(${-t.rot}deg)` }}><b>{t.label}</b><small>{t.min_seats}–{t.max_seats}p</small></span>
              </div>
            ))}
          </div>
          {unplaced.length > 0 && <p>Nicht platziert: {unplaced.map(t => t.label).join(', ')}</p>}
        </>
      )}
    </main>
  )
}
