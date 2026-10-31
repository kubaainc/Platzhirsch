import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { supabase, type DayRule, type Guest, type Reservation, type Room, type TableRow, type Team } from './supabase'
import { RoomSettings, RoomTabs } from './RoomTabs'
import { addDays, dayLabel, findReserve, findTable, guestsAt, hm, isoDay, matchGuest, suggest, tableBusy } from './booking'

const DEFAULT_HOURS = { from: 1080, to: 1380 }
const STAY = 120
const natural = (a: string, b: string) => a.localeCompare(b, 'de', { numeric: true })

type NewRes = { table?: string; start: number }

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return (
    <dialog ref={ref} onClose={onClose} onClick={e => { if (e.target === ref.current) ref.current?.close() }} aria-labelledby="dlg-t">
      <div className="dlg">
        <div className="dlg-h"><h2 id="dlg-t">{title}</h2><button type="button" className="ghost" onClick={() => ref.current?.close()} aria-label="Schließen">×</button></div>
        {children}
      </div>
    </dialog>
  )
}

export default function Timeline({ team, onEditing }: { team: Team; onEditing: (e: boolean) => void }) {
  const canWrite = team.role !== 'viewer'
  const canManage = team.role === 'admin' || team.role === 'editor'
  const [manage, setManage] = useState(false)
  useEffect(() => { onEditing(manage); return () => onEditing(false) }, [manage, onEditing])
  const [day, setDay] = useState(isoDay(new Date()))
  const [rooms, setRooms] = useState<Room[]>([])
  const [tables, setTables] = useState<TableRow[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [res, setRes] = useState<Reservation[]>([])
  const [rule, setRule] = useState<DayRule | null>(null)
  const [hours, setHours] = useState(DEFAULT_HOURS)
  const [roomId, setRoomId] = useState('')
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [dlg, setDlg] = useState<null | { kind: 'new'; v: NewRes } | { kind: 'res'; id: string } | { kind: 'guests' } | { kind: 'tables' }>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    (async () => {
      const [r, t, g, tm] = await Promise.all([
        supabase.from('rooms').select('*').eq('team_id', team.id).order('sort'),
        supabase.from('tables').select('*').eq('team_id', team.id),
        supabase.from('guests').select('*').eq('team_id', team.id).order('name'),
        supabase.from('teams').select('settings').eq('id', team.id).single(),
      ])
      const e = r.error || t.error || g.error
      if (e) return setErr(e.message)
      setRooms(r.data as Room[]); setTables(t.data as TableRow[]); setGuests(g.data as Guest[])
      const h = (tm.data?.settings as { hours?: { from: number; to: number } } | undefined)?.hours
      if (h) setHours(h)
      setRoomId((r.data as Room[])[0]?.id ?? ''); setReady(true)
    })()
  }, [team.id])

  const loadDay = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('reservations').select('*').eq('team_id', team.id).eq('day', day),
      supabase.from('day_rules').select('*').eq('team_id', team.id).eq('day', day).maybeSingle(),
    ])
    if (a.error || b.error) return setErr((a.error || b.error)!.message)
    setRes(a.data as Reservation[]); setRule(b.data as DayRule | null); setNote((b.data as DayRule | null)?.note ?? '')
  }, [team.id, day])
  useEffect(() => { if (ready) loadDay() }, [ready, loadDay])

  const guestById = useMemo(() => new Map(guests.map(g => [g.id, g])), [guests])
  const room = rooms.find(r => r.id === roomId)
  const rows = useMemo(() => tables.filter(t => t.room_id === roomId).sort((a, b) => natural(a.label, b.label)), [tables, roomId])
  const span = hours.to - hours.from
  const seats = rows.reduce((s, t) => s + t.max_seats, 0)
  const blocked = !!rule?.blocked
  const open = (v: NewRes) => { if (blocked) return setMsg('Dieser Tag ist gesperrt. Entsperre ihn, um zu reservieren.'); setDlg({ kind: 'new', v }) }

  async function saveRule(patch: Partial<DayRule>) {
    const next = { team_id: team.id, day, blocked: rule?.blocked ?? false, note: rule?.note ?? null, ...patch }
    const { error } = await supabase.from('day_rules').upsert(next)
    if (error) return setErr(error.message)
    setRule(next)
  }

  if (err && !ready) return <p className="err" role="alert">{err}</p>
  if (!ready) return <p>Lade …</p>

  const hourCells: number[] = []
  for (let m = hours.from; m < hours.to; m += 60) hourCells.push(m)
  const total = res.filter(r => rows.some(t => t.id === r.table_id)).reduce((s, r) => s + r.party, 0)

  return (
    <>
      <div className="daybar">
        <button className="ghost" onClick={() => setDay(addDays(day, -1))} aria-label="Vorheriger Tag">‹</button>
        <div className="daytitle"><b>{dayLabel(day)}</b><span className="soft">{res.length} Reservierungen · {res.reduce((s, r) => s + r.party, 0)} Gäste</span></div>
        <button className="ghost" onClick={() => setDay(addDays(day, 1))} aria-label="Nächster Tag">›</button>
        <input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)} aria-label="Datum" />
        <button className="ghost" onClick={() => setDay(isoDay(new Date()))}>Heute</button>
        <span className="grow" />
        <button className="ghost" onClick={() => setDlg({ kind: 'guests' })}>Gäste suchen</button>
        {canManage && <button className="ghost" aria-pressed={manage} onClick={() => setManage(!manage)}>{manage ? 'Bearbeiten beenden' : 'Bearbeiten'}</button>}
        {canWrite && <button className="ghost" aria-pressed={blocked} onClick={() => saveRule({ blocked: !blocked })}>{blocked ? 'Tag entsperren' : 'Tag sperren'}</button>}
        {canWrite && <button onClick={() => open({ start: 1140 })}>Neue Reservierung</button>}
      </div>
      {blocked && <p className="banner" role="status">Gesperrt: An diesem Tag sind keine Reservierungen möglich (z. B. Urlaub).</p>}
      <label className="daynote">Hinweis für den Tag
        <input value={note} disabled={!canWrite} placeholder="Große Reservierungen, Besonderes …" onChange={e => setNote(e.target.value)} onBlur={() => note !== (rule?.note ?? '') && saveRule({ note: note.trim() || null })} />
      </label>

      <RoomTabs teamId={team.id} rooms={rooms} roomId={roomId} showAdd={manage} onSelect={setRoomId} onAdded={r => { setRooms(rs => [...rs, r]); setRoomId(r.id) }} onDeleted={id => { const rest = rooms.filter(r => r.id !== id); setRooms(rest); setRoomId(rest[0]?.id ?? '') }} />
      {manage && room && (
        <>
          <RoomSettings room={room} showSize={false} onChange={r => setRooms(rs => rs.map(x => (x.id === r.id ? r : x)))} />
          <p><button onClick={() => setDlg({ kind: 'tables' })}>Tische verwalten</button> <span className="soft">Neue Tische erscheinen im Raumplan oberhalb des Plans unter „Noch nicht im Plan“.</span></p>
        </>
      )}

      <div className="tl" role="table" aria-label={`Zeitleiste ${room?.name ?? ''}`}>
        <div className="tl-row tl-head" role="row">
          <div className="tl-lab"><b>Auslastung</b><span className="soft">{total} Gäste · {seats} Plätze</span></div>
          <div className="tl-track util">
            {hourCells.map(m => {
              const g = guestsAt(res, tables, roomId, m + 30), pct = seats ? Math.min(100, Math.round((g / seats) * 100)) : 0
              return <div key={m} className="ucell" style={{ width: `${(60 / span) * 100}%` }} title={`${hm(m)} Uhr: ${g} von ${seats} Plätzen`}>
                <span className="ulab">{hm(m)}</span>
                <i className={pct >= 90 ? 'hi' : pct >= 60 ? 'mid' : 'lo'} style={{ width: `${pct}%` }} /><b>{pct}%</b>
              </div>
            })}
          </div>
        </div>
        {rows.map(t => (
          <div className="tl-row" role="row" key={t.id}>
            <div className="tl-lab" role="rowheader"><b>{t.label}</b><span className="soft">{t.min_seats}–{t.max_seats}p{!t.online_bookable && <i className="sw black" title="Nur Team" />}</span></div>
            <div className="tl-track" onClick={e => {
              if (!canWrite || (e.target as HTMLElement).closest('.rbar')) return
              const rc = e.currentTarget.getBoundingClientRect()
              const m = hours.from + Math.floor(((e.clientX - rc.left) / rc.width) * span / 30) * 30
              open({ table: t.id, start: Math.max(hours.from, Math.min(hours.to - 30, m)) })
            }}>
              {hourCells.map(m => <i key={m} className="grid" style={{ left: `${((m - hours.from) / span) * 100}%` }} />)}
              {res.filter(r => r.table_id === t.id || r.alt_table_id === t.id).map(r => {
                const reserve = r.table_id !== t.id
                return <button key={r.id} className={`rbar${reserve ? ' reserve' : ''}`} onClick={() => setDlg({ kind: 'res', id: r.id })}
                  style={{ left: `${((r.start_min - hours.from) / span) * 100}%`, width: `${(r.duration_min / span) * 100}%` }}
                  aria-label={`${guestById.get(r.guest_id ?? '')?.name ?? 'Gast'}, ${r.party} Personen, ${hm(r.start_min)} Uhr${reserve ? ', Wetter-Reserve' : ''}`}>
                  {reserve ? 'Reserve' : `${r.party}p · ${guestById.get(r.guest_id ?? '')?.name ?? 'Gast'}`}
                </button>
              })}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="soft pad">Noch keine Tische in diesem Bereich.</p>}
      </div>
      <p className="legend"><span><i className="swb" />Reservierung</span><span><i className="swb dashed" />Wetter-Reserve (Tisch draußen reserviert für Regen)</span><span><i className="sw black" />Nur Team</span></p>

      {dlg?.kind === 'new' && room && (
        <NewReservation team={team} day={day} rooms={rooms} tables={tables} guests={guests} res={res} hours={hours} initial={dlg.v} roomId={roomId}
          onClose={() => setDlg(null)} onSaved={async (g?: Guest) => { if (g) setGuests(gs => gs.some(x => x.id === g.id) ? gs : [...gs, g].sort((a, b) => a.name.localeCompare(b.name))); setDlg(null); setMsg('Reservierung gespeichert'); await loadDay() }} />
      )}
      {dlg?.kind === 'res' && (() => {
        const r = res.find(x => x.id === dlg.id); if (!r) return null
        return <ResDetail r={r} guest={guestById.get(r.guest_id ?? '')} tables={tables} rooms={rooms} res={res} canWrite={canWrite} onClose={() => setDlg(null)}
          onSaved={async () => { setDlg(null); setMsg('Reservierung geändert'); await loadDay() }}
          onDelete={async () => { const { error } = await supabase.from('reservations').delete().eq('id', r.id); if (error) return setErr(error.message); setDlg(null); setMsg('Reservierung storniert'); loadDay() }} />
      })()}
      {dlg?.kind === 'tables' && room && <TableManager team={team} room={room} tables={tables} onClose={() => setDlg(null)} onSaved={t => { setTables(t); setDlg(null); setMsg('Tische gespeichert') }} />}
      {dlg?.kind === 'guests' && <GuestSearch team={team} guests={guests} onClose={() => setDlg(null)} />}
      <div aria-live="polite">{msg && <p className="toast">{msg}</p>}{err && <p className="err" role="alert">{err}</p>}</div>
    </>
  )
}

function ResDetail({ r, guest, tables, rooms, res, canWrite, onClose, onDelete, onSaved }: { r: Reservation; guest?: Guest; tables: TableRow[]; rooms: Room[]; res: Reservation[]; canWrite: boolean; onClose: () => void; onDelete: () => void; onSaved: () => void }) {
  const t = tables.find(x => x.id === r.table_id), alt = tables.find(x => x.id === r.alt_table_id)
  const [edit, setEdit] = useState(false)
  const [start, setStart] = useState(hm(r.start_min))
  const [party, setParty] = useState(r.party)
  const [tid, setTid] = useState(r.table_id ?? '')
  const [note, setNote] = useState(r.note ?? '')
  const [err, setErr] = useState('')
  async function save(e: FormEvent) {
    e.preventDefault(); setErr('')
    const [h, m] = start.split(':').map(Number), s0 = h * 60 + m
    const nt = tables.find(x => x.id === tid)
    if (!nt) return setErr('Bitte einen Tisch wählen.')
    if (party < 1) return setErr('Mindestens 1 Person.')
    const o = { tables, rooms, res, roomId: nt.room_id, start: s0, dur: r.duration_min, party, manual: true, ignore: r.id }
    if (tableBusy(nt.id, s0, r.duration_min, res, r.id)) return setErr(`${nt.label} ist zu dieser Zeit belegt.`)
    const reserve = findReserve(o, nt)
    const { error } = await supabase.from('reservations').update({ table_id: nt.id, alt_table_id: reserve?.id ?? null, start_min: s0, party, note: note.trim() || null }).eq('id', r.id)
    if (error) return setErr(error.message)
    onSaved()
  }
  if (edit) return (
    <Modal title={`${guest?.name ?? 'Gast'} bearbeiten`} onClose={onClose}>
      <form onSubmit={save}>
        <label>Beginn<input type="time" step={900} required value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Personen<input type="number" min={1} max={60} required value={party} onChange={e => setParty(Number(e.target.value))} /></label>
        <label>Tisch
          <select value={tid} onChange={e => setTid(e.target.value)}>
            {rooms.map(ro => <optgroup key={ro.id} label={ro.name}>{tables.filter(x => x.room_id === ro.id).sort((a, b) => natural(a.label, b.label)).map(x => <option key={x.id} value={x.id}>{x.label} ({x.min_seats}–{x.max_seats}p)</option>)}</optgroup>)}
          </select>
        </label>
        <label>Notiz<input value={note} onChange={e => setNote(e.target.value)} /></label>
        <div className="acts"><button type="submit">Speichern</button><button type="button" className="ghost" onClick={() => setEdit(false)}>Abbrechen</button></div>
        {err && <p className="err" role="alert">{err}</p>}
      </form>
    </Modal>
  )
  return (
    <Modal title={guest?.name ?? 'Gast'} onClose={onClose}>
      <dl className="kv">
        <dt>Zeit</dt><dd>{hm(r.start_min)}–{hm(r.start_min + r.duration_min)} Uhr</dd>
        <dt>Personen</dt><dd>{r.party}</dd>
        <dt>Tisch</dt><dd>{t?.label ?? '–'}{alt && <span className="soft"> · Wetter-Reserve {alt.label}</span>}</dd>
        {guest?.phone && <><dt>Telefon</dt><dd>{guest.phone}</dd></>}
        {guest?.email && <><dt>E-Mail</dt><dd>{guest.email}</dd></>}
        {r.note && <><dt>Notiz</dt><dd>{r.note}</dd></>}
        <dt>Quelle</dt><dd>{r.source === 'team' ? 'Team' : 'Online'}</dd>
      </dl>
      {canWrite && <div className="acts"><button onClick={() => setEdit(true)}>Bearbeiten</button><button className="danger" onClick={onDelete}>Reservierung stornieren</button></div>}
    </Modal>
  )
}

function NewReservation(p: {
  team: Team; day: string; rooms: Room[]; tables: TableRow[]; guests: Guest[]; res: Reservation[]; hours: { from: number; to: number }
  initial: NewRes; roomId: string; onClose: () => void; onSaved: (g?: Guest) => void
}) {
  const initTable = p.tables.find(t => t.id === p.initial.table)
  const [rid, setRid] = useState(initTable?.room_id ?? p.roomId)
  const [tableId, setTableId] = useState(p.initial.table ?? 'auto')
  const [start, setStart] = useState(p.initial.start)
  const [party, setParty] = useState(2)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const matched = useMemo(() => matchGuest(p.guests, phone, email), [p.guests, phone, email])
  const opts = { tables: p.tables, rooms: p.rooms, res: p.res, roomId: rid, start, dur: STAY, party, manual: true }
  const auto = useMemo(() => findTable(opts), [p.tables, p.res, rid, start, party]) // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = tableId === 'auto' ? auto : p.tables.find(t => t.id === tableId) ?? null
  const reserve = chosen ? findReserve(opts, chosen) : null
  const hasRoom = chosen && chosen.min_seats <= party && party <= chosen.max_seats
  const alts = useMemo(() => (auto ? [] : suggest(opts, p.hours.from, p.hours.to)), [auto, start, party, rid, p.res]) // eslint-disable-line react-hooks/exhaustive-deps
  const times: number[] = []; for (let m = p.hours.from; m < p.hours.to; m += 30) times.push(m)
  const roomTables = p.tables.filter(t => t.room_id === rid).sort((a, b) => natural(a.label, b.label))

  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return
    setErr('')
    if (!chosen) return setErr('Kein passender Tisch frei. Wähle eine andere Zeit oder einen anderen Bereich.')
    if (!hasRoom) return setErr(`Tisch ${chosen.label} fasst ${chosen.min_seats}–${chosen.max_seats} Personen.`)
    if (tableId !== 'auto' && findTable({ ...opts, roomId: chosen.room_id })?.id !== chosen.id && p.res.some(r => (r.table_id === chosen.id || r.alt_table_id === chosen.id) && r.start_min < start + STAY && start < r.start_min + r.duration_min))
      return setErr(`Tisch ${chosen.label} ist zu dieser Zeit belegt.`)
    setBusy(true)
    let guest: Guest | undefined = matched ?? undefined
    if (!guest) {
      const { data, error } = await supabase.from('guests').insert({ team_id: p.team.id, name: name.trim(), phone: phone.trim() || null, email: email.trim() || null }).select().single()
      if (error) { setBusy(false); return setErr(error.code === '23505' ? 'Dieser Gast existiert schon (gleiche Telefonnummer oder E-Mail).' : error.message) }
      guest = data as Guest
    }
    const { error } = await supabase.from('reservations').insert({
      team_id: p.team.id, guest_id: guest.id, table_id: chosen.id, alt_table_id: reserve?.id ?? null,
      day: p.day, start_min: start, duration_min: STAY, party, source: 'team', note: note.trim() || null,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    p.onSaved(matched ? undefined : guest)
  }

  return (
    <Modal title="Neue Reservierung" onClose={p.onClose}>
      <form onSubmit={submit} className="grid2">
        <label>Name<input required value={name} onChange={e => setName(e.target.value)} placeholder={matched?.name} /></label>
        <label>Personen<input type="number" min={1} max={60} required value={party} onChange={e => setParty(Math.max(1, +e.target.value || 1))} /></label>
        <label>Telefon<input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
        <label>E-Mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        {matched && <p className="match" role="status" style={{ gridColumn: '1/-1' }}>Gast gefunden: <b>{matched.name}</b>. Die Reservierung wird diesem Gast zugeordnet.</p>}
        <label>Uhrzeit<select value={start} onChange={e => setStart(+e.target.value)}>{times.map(m => <option key={m} value={m}>{hm(m)} Uhr</option>)}</select></label>
        <label>Bereich<select value={rid} onChange={e => { setRid(e.target.value); setTableId('auto') }}>{p.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label style={{ gridColumn: '1/-1' }}>Tisch
          <select value={tableId} onChange={e => setTableId(e.target.value)}>
            <option value="auto">Automatisch{auto ? ` (${auto.label})` : ''}</option>
            {roomTables.map(t => <option key={t.id} value={t.id}>{t.label} · {t.min_seats}–{t.max_seats}p{t.online_bookable ? '' : ' · nur Team'}</option>)}
          </select>
        </label>
        <label style={{ gridColumn: '1/-1' }}>Notiz<input value={note} onChange={e => setNote(e.target.value)} /></label>
        <div style={{ gridColumn: '1/-1' }} aria-live="polite">
          {chosen && hasRoom && <p className="ok">Tisch {chosen.label}{reserve ? `, Wetter-Reserve draußen: ${reserve.label}` : p.rooms.find(r => r.id === chosen.room_id)?.outdoor ? '' : ', draußen ist gerade kein Tisch als Reserve frei'}.</p>}
          {!chosen && <p className="err">Zu dieser Zeit ist im Bereich kein passender Tisch frei.</p>}
          {!auto && alts.length > 0 && <p>Besser: {alts.map(a => <button type="button" className="ghost sm" key={a.start} onClick={() => setStart(a.start)}>{hm(a.start)} Uhr ({a.table.label})</button>)}</p>}
          {!auto && alts.length === 0 && <p className="soft">Keine freie Alternative in den Öffnungszeiten. Prüfe die anderen Bereiche; das Team kann auch schwarze Tische von Hand vergeben.</p>}
        </div>
        {err && <p className="err" role="alert" style={{ gridColumn: '1/-1' }}>{err}</p>}
        <div className="acts" style={{ gridColumn: '1/-1' }}><button type="submit" disabled={busy}>Reservieren</button><button type="button" className="ghost" onClick={p.onClose}>Abbrechen</button></div>
      </form>
    </Modal>
  )
}

function GuestSearch({ team, guests, onClose }: { team: Team; guests: Guest[]; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<Guest | null>(null)
  const [hist, setHist] = useState<Reservation[] | null>(null)
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase(), d = q.replace(/\D/g, '')
    if (!s) return []
    return guests.filter(g => g.name.toLowerCase().includes(s) || (g.email ?? '').toLowerCase().includes(s) || (d.length >= 3 && (g.phone ?? '').replace(/\D/g, '').includes(d))).slice(0, 8)
  }, [q, guests])
  useEffect(() => {
    if (!pick) return setHist(null)
    supabase.from('reservations').select('*').eq('team_id', team.id).eq('guest_id', pick.id).order('day', { ascending: false }).then(({ data }) => setHist((data ?? []) as Reservation[]))
  }, [pick, team.id])
  return (
    <Modal title="Gäste suchen" onClose={onClose}>
      <label>Name, Telefon oder E-Mail<input autoFocus value={q} onChange={e => { setQ(e.target.value); setPick(null) }} /></label>
      <ul className="hits">{hits.map(g => <li key={g.id}><button type="button" className="ghost" onClick={() => setPick(g)}><b>{g.name}</b><span className="soft">{g.phone ?? g.email ?? ''}</span></button></li>)}</ul>
      {q.trim() && hits.length === 0 && <p className="soft">Kein Gast gefunden.</p>}
      {pick && (
        <div className="hist">
          <h3>{pick.name}</h3>
          {hist === null ? <p>Lade …</p> : hist.length === 0 ? <p className="soft">Noch keine Reservierungen.</p> : (
            <>
              <p>{hist.length}× da gewesen oder reserviert, zuletzt am {new Date(hist[0].day).toLocaleDateString('de-DE')}.</p>
              <ul>{hist.slice(0, 10).map(r => <li key={r.id}>{new Date(r.day).toLocaleDateString('de-DE')} · {hm(r.start_min)} Uhr · {r.party} Personen</li>)}</ul>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

type Draft = { id?: string; label: string; min_seats: number; max_seats: number; online_bookable: boolean; del?: boolean }

function TableManager({ team, room, tables, onClose, onSaved }: { team: Team; room: Room; tables: TableRow[]; onClose: () => void; onSaved: (all: TableRow[]) => void }) {
  const [rows, setRows] = useState<Draft[]>(() => tables.filter(t => t.room_id === room.id).sort((a, b) => natural(a.label, b.label)).map(t => ({ id: t.id, label: t.label, min_seats: t.min_seats, max_seats: t.max_seats, online_bookable: t.online_bookable })))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (i: number, p: Partial<Draft>) => setRows(rs => rs.map((r, k) => (k === i ? { ...r, ...p } : r)))
  async function save() {
    if (busy) return
    setErr(''); setBusy(true)
    const live = rows.filter(r => !r.del)
    if (live.some(r => !r.label.trim() || r.min_seats > r.max_seats)) { setBusy(false); return setErr('Jeder Tisch braucht einen Namen, und „Mindestens“ darf nicht größer sein als „Höchstens“.') }
    for (const r of rows.filter(r => r.del && r.id)) {
      const { count } = await supabase.from('reservations').select('id', { count: 'exact', head: true }).or(`table_id.eq.${r.id},alt_table_id.eq.${r.id}`)
      if (count) { setBusy(false); return setErr(`Tisch ${r.label} hat Reservierungen. Bitte erst verschieben oder stornieren.`) }
    }
    const delIds = rows.filter(r => r.del && r.id).map(r => r.id!)
    if (delIds.length) { const { error } = await supabase.from('tables').delete().in('id', delIds); if (error) { setBusy(false); return setErr(error.message) } }
    const existing = live.filter(r => r.id).map(r => ({ id: r.id, team_id: team.id, room_id: room.id, label: r.label.trim(), min_seats: r.min_seats, max_seats: r.max_seats, online_bookable: r.online_bookable }))
    if (existing.length) { const { error } = await supabase.from('tables').upsert(existing); if (error) { setBusy(false); return setErr(error.message) } }
    const added = live.filter(r => !r.id).map(r => ({ team_id: team.id, room_id: room.id, label: r.label.trim(), min_seats: r.min_seats, max_seats: r.max_seats, online_bookable: r.online_bookable, placed: false }))
    if (added.length) { const { error } = await supabase.from('tables').insert(added); if (error) { setBusy(false); return setErr(error.message) } }
    const { data, error } = await supabase.from('tables').select('*').eq('team_id', team.id)
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved(data as TableRow[])
  }
  return (
    <Modal title={`Tische: ${room.name}`} onClose={onClose}>
      <table className="tm"><thead><tr><th>Name</th><th>Min.</th><th>Max.</th><th>Online</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => r.del ? null : (
            <tr key={r.id ?? `n${i}`}>
              <td><input aria-label="Name" value={r.label} onChange={e => set(i, { label: e.target.value })} /></td>
              <td><input aria-label="Mindestens" className="num" type="number" min={1} value={r.min_seats} onChange={e => set(i, { min_seats: Math.max(1, +e.target.value || 1) })} /></td>
              <td><input aria-label="Höchstens" className="num" type="number" min={1} value={r.max_seats} onChange={e => set(i, { max_seats: Math.max(1, +e.target.value || 1) })} /></td>
              <td><input aria-label="Online reservierbar" type="checkbox" checked={r.online_bookable} onChange={e => set(i, { online_bookable: e.target.checked })} /></td>
              <td><button type="button" className="ghost" aria-label={`${r.label} entfernen`} onClick={() => r.id ? set(i, { del: true }) : setRows(rs => rs.filter((_, k) => k !== i))}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><button type="button" className="ghost" onClick={() => setRows(rs => [...rs, { label: `Tisch ${rs.filter(r => !r.del).length + 1}`, min_seats: 2, max_seats: 4, online_bookable: true }])}>+ Tisch hinzufügen</button></p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="acts"><button onClick={save} disabled={busy}>Speichern</button><button className="ghost" onClick={onClose}>Abbrechen</button></div>
    </Modal>
  )
}
