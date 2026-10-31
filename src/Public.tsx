import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from './supabase'
import { addDays, dayLabel, hm, isoDay } from './booking'

type Info = { name: string; rooms: { id: string; name: string }[] }
type Slot = { start_min: number; free: boolean; pct: number }

export default function Public({ slug }: { slug: string }) {
  const [info, setInfo] = useState<Info | null | undefined>(undefined)
  const [day, setDay] = useState(isoDay(new Date()))
  const [party, setParty] = useState(2)
  const [room, setRoom] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [start, setStart] = useState<number | null>(null)
  const [f, setF] = useState({ name: '', phone: '', email: '', note: '', hp: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ day: string; start: number; party: number } | null>(null)

  useEffect(() => {
    supabase.rpc('public_info', { p_slug: slug }).then(({ data }) => setInfo((data as Info | null) ?? null))
  }, [slug])
  useEffect(() => {
    setStart(null)
    supabase.rpc('public_slots', { p_slug: slug, p_day: day, p_party: party, p_room: room || null })
      .then(({ data }) => setSlots((data as Slot[] | null) ?? []))
  }, [slug, day, party, room])

  async function book(e: FormEvent) {
    e.preventDefault()
    if (start === null || f.hp) return
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('public_book', {
      p_slug: slug, p_day: day, p_start: start, p_party: party, p_room: room || null,
      p_name: f.name, p_phone: f.phone, p_email: f.email, p_note: f.note,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setDone({ day, start, party })
  }

  if (info === undefined) return <main className="gast"><p>Lade …</p></main>
  if (info === null) return <main className="gast"><p>Dieses Restaurant gibt es nicht.</p></main>
  if (done) return (
    <main className="gast">
      <p className="kicker">Reservierung</p>
      <h1>{info.name}</h1>
      <p className="note good"><b>Danke, wir haben deine Reservierung.</b><br />{dayLabel(done.day)}, {hm(done.start)} Uhr, {done.party} {done.party === 1 ? 'Person' : 'Personen'}.</p>
    </main>
  )
  const anyFree = slots.some(s => s.free)
  return (
    <main className="gast">
      <p className="kicker">Reservieren</p>
      <h1>{info.name}</h1>
      <form onSubmit={book}>
        <section className="step">
          <div className="step-h"><h2><i>1</i>Datum und Personen</h2></div>
          <label>Datum<input type="date" value={day} min={isoDay(new Date())} max={addDays(isoDay(new Date()), 180)} onChange={e => e.target.value && setDay(e.target.value)} /></label>
          <div className="pers" role="group" aria-label="Personen">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <button type="button" key={n} aria-pressed={party === n} onClick={() => setParty(n)}>{n}</button>)}
          </div>
          <label>Andere Personenzahl<input type="number" min={1} max={30} value={party} onChange={e => setParty(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} /></label>
          {info.rooms.length > 1 && (
            <label>Bereich
              <select value={room} onChange={e => setRoom(e.target.value)}>
                <option value="">Egal</option>
                {info.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          )}
        </section>
        <section className="step">
          <div className="step-h"><h2><i>2</i>Uhrzeit</h2><span>{dayLabel(day)}</span></div>
          <div role="group" aria-label="Uhrzeit" className="slotlist">
            {slots.map(s => (
              <button type="button" key={s.start_min} className="slot" disabled={!s.free} aria-pressed={start === s.start_min} onClick={() => setStart(s.start_min)}>
                <b>{hm(s.start_min)}</b>
                <span className="meter"><i className={s.pct >= 80 ? 'hot' : ''} style={{ width: `${s.pct}%` }} /></span>
                <span className="st">{s.free ? `${s.pct} % belegt` : 'Nicht verfügbar'}</span>
              </button>
            ))}
          </div>
          {!anyFree && <p className="note warn">Online ist an diesem Tag nichts frei. Online buchst du mindestens 24 Stunden vorher, kurzfristig bitte telefonisch.</p>}
        </section>
        {start !== null && (
          <section className="step">
            <div className="step-h"><h2><i>3</i>Deine Daten</h2></div>
            <label>Name<input required minLength={2} maxLength={80} autoComplete="name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
            <label>Telefon<input type="tel" maxLength={30} autoComplete="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
            <label>E-Mail<input type="email" maxLength={120} autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
            <label>Anmerkung (optional)<input maxLength={500} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></label>
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.hp} onChange={e => setF({ ...f, hp: e.target.value })} />
            <p className="soft">Bitte Telefon oder E-Mail angeben.</p>
            <button type="submit" disabled={busy || (!f.phone.trim() && !f.email.trim())}>Reservieren</button>
          </section>
        )}
        {err && <p className="note warn" role="alert">{err}</p>}
      </form>
    </main>
  )
}
