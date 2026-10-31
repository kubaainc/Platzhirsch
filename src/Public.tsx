import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from './supabase'
import { addDays, dayLabel, hm, isoDay } from './booking'

type Info = { name: string; rooms: { id: string; name: string }[] }
type Slot = { start_min: number; free: boolean; pct: number }
type Done = { day: string; start: number; party: number; name: string; room: string; token: string }

const OCCASIONS = ['Geburtstag', 'Jahrestag', 'Geschäftlich', 'Date']
const DAYS = 14

/** Einbettung: ?transparent=1 entfernt den Hintergrund, ?theme=dark ist für dunkle Seiten. */
const params = new URLSearchParams(location.search)
const clear = params.get('transparent') === '1'
const dark = params.get('theme') === 'dark'

function dayParts(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return {
    wd: d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', ''),
    n: d.getDate(),
    mon: d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', ''),
  }
}

export default function Public({ slug }: { slug: string }) {
  const [info, setInfo] = useState<Info | null | undefined>(undefined)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [day, setDay] = useState(isoDay(new Date()))
  const [party, setParty] = useState(2)
  const [room, setRoom] = useState('')
  const [all, setAll] = useState<Record<string, Slot[]> | null>(null)
  const picked = useRef(false)
  const [start, setStart] = useState<number | null>(null)
  const [full, setFull] = useState<number | null>(null)
  const [occasion, setOccasion] = useState('')
  const [f, setF] = useState({ name: '', phone: '', email: '', note: '', hp: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<Done | null>(null)

  useEffect(() => {
    const c = document.documentElement.classList
    c.toggle('g-clear', clear); c.toggle('g-dark', clear && dark)
  }, [])
  useEffect(() => {
    supabase.rpc('public_info', { p_slug: slug }).then(({ data }) => setInfo((data as Info | null) ?? null))
  }, [slug])
  useEffect(() => {
    setStart(null); setFull(null); setAll(null)
    const days = Array.from({ length: DAYS }, (_, i) => addDays(isoDay(new Date()), i))
    let live = true
    Promise.all(days.map(d => supabase.rpc('public_slots', { p_slug: slug, p_day: d, p_party: party, p_room: room || null })
      .then(({ data }) => [d, (data as Slot[] | null) ?? []] as const))).then(rows => {
      if (!live) return
      const m = Object.fromEntries(rows)
      setAll(m)
      // Ohne eigene Wahl springt die Seite auf den ersten Tag mit freien Zeiten (24 h Vorlauf: heute ist meist zu).
      if (!picked.current) {
        const first = days.find(d => m[d].some(x => x.free))
        if (first) setDay(first)
      }
    })
    return () => { live = false }
  }, [slug, party, room])
  useEffect(() => { setStart(null); setFull(null) }, [day])

  async function book(e: FormEvent) {
    e.preventDefault()
    if (start === null || f.hp) return
    if (!f.phone.trim() && !f.email.trim()) return setErr('Bitte Telefon oder E-Mail angeben, damit wir dich erreichen.')
    setBusy(true); setErr('')
    const note = [occasion && `Anlass: ${occasion}`, f.note.trim()].filter(Boolean).join(' · ')
    const { data, error } = await supabase.rpc('public_book', {
      p_slug: slug, p_day: day, p_start: start, p_party: party, p_room: room || null,
      p_name: f.name, p_phone: f.phone, p_email: f.email, p_note: note,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setDone({ day, start, party, name: f.name.trim(), room: info?.rooms.find(r => r.id === room)?.name ?? '', token: (data as { token: string }).token })
    setStep(3)
  }
  function again() {
    setDone(null); setStep(1); setStart(null); setOccasion(''); setF({ name: '', phone: '', email: '', note: '', hp: '' })
  }

  const cls = `gast${clear ? ' clear' : ''}`
  if (info === undefined) return <main className={cls}><p>Lade …</p></main>
  if (info === null) return <main className={cls}><p>Dieses Restaurant gibt es nicht.</p></main>

  const persons = (n: number) => `${n} ${n === 1 ? 'Person' : 'Personen'}`
  const today = isoDay(new Date())
  const slots = all ? (all[day] ?? []) : null
  const hasFree = (d: string) => !!all?.[d]?.some(x => x.free)
  const free = (slots ?? []).filter(s => s.free)
  const alts = full === null ? [] : [...free].sort((a, b) => Math.abs(a.start_min - full) - Math.abs(b.start_min - full)).slice(0, 3).sort((a, b) => a.start_min - b.start_min)
  const stepNo = step

  return (
    <main className={cls}>
      <div className="g-card">
        <div className="g-head">
          <div><p className="kicker">{info.name}</p><h1>{step === 3 ? 'Reserviert' : 'Tisch reservieren'}</h1></div>
          <div className="g-steps" aria-label={`Schritt ${stepNo} von 3`}>
            <i className="on" /><i className={stepNo >= 2 ? 'on' : ''} /><i className={stepNo >= 3 ? 'on' : ''} />
          </div>
        </div>

        {step === 1 && (
          <div className="g-body">
            <div className="g-field"><span className="g-l">Personen</span>
              <div className="g-opts" role="group" aria-label="Personen">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <button type="button" className="g-n" key={n} aria-pressed={party === n} onClick={() => setParty(n)}>{n}</button>)}
                <button type="button" className="g-n" aria-pressed={party > 8} onClick={() => setParty(9)}>9+</button>
              </div>
              {party > 8 && <label className="g-inline">Genaue Zahl<input type="number" min={9} max={30} value={party} onChange={e => setParty(Math.max(9, Math.min(30, Number(e.target.value) || 9)))} /></label>}
            </div>
            {info.rooms.length > 1 && (
              <div className="g-field"><span className="g-l">Bereich</span>
                <div className="g-opts" role="group" aria-label="Bereich">
                  <button type="button" className="g-chip" aria-pressed={room === ''} onClick={() => setRoom('')}>Egal</button>
                  {info.rooms.map(r => <button type="button" className="g-chip" key={r.id} aria-pressed={room === r.id} onClick={() => setRoom(r.id)}>{r.name}</button>)}
                </div>
              </div>
            )}
            <div className="g-field"><span className="g-l">Tag</span>
              <div className="g-days" role="group" aria-label="Tag">
                {Array.from({ length: DAYS }, (_, i) => addDays(today, i)).map((d, i) => {
                  const p = dayParts(d)
                  return (
                    <button type="button" key={d} className={all && !hasFree(d) ? 'none' : ''} aria-pressed={day === d} aria-label={`${dayLabel(d)}${all && !hasFree(d) ? ', keine freien Zeiten online' : ''}`} onClick={() => { picked.current = true; setDay(d) }}>
                      <small>{i === 0 ? 'heute' : p.wd}</small><b>{p.n}.</b><small>{p.mon}</small>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="g-field"><span className="g-l">Uhrzeit · {dayLabel(day)}</span>
              {slots === null ? <p className="g-soft">Lade freie Zeiten …</p> : slots.length === 0 || free.length === 0 ? (
                <p className="g-note warn">An diesem Tag ist online nichts frei. Online buchst du mindestens 24 Stunden vorher, kurzfristig bitte telefonisch oder wähle einen anderen Tag.</p>
              ) : (
                <>
                  <div className="g-slots" role="group" aria-label="Uhrzeit">
                    {slots.map(s => {
                      const few = s.free && s.pct >= 80
                      return (
                        <button type="button" key={s.start_min} className={`g-slot${few ? ' few' : ''}${s.free ? '' : ' full'}`} aria-pressed={start === s.start_min}
                          aria-label={`${hm(s.start_min)} Uhr, ${!s.free ? 'ausgebucht' : few ? 'nur noch wenige Tische' : 'frei'}`}
                          onClick={() => { if (s.free) { setStart(s.start_min); setFull(null) } else { setStart(null); setFull(s.start_min) } }}>
                          {hm(s.start_min)}
                        </button>
                      )
                    })}
                  </div>
                  <p className="g-legend"><span className="d" />nur noch wenige Tische · <s>durchgestrichen</s> = ausgebucht</p>
                  {full !== null && (
                    <p className="g-note warn" role="status">{hm(full)} Uhr ist für {persons(party)} ausgebucht. {alts.length ? <>Frei wäre: {alts.map(a => <button type="button" className="g-alt" key={a.start_min} onClick={() => { setStart(a.start_min); setFull(null) }}>{hm(a.start_min)}</button>)}</> : 'An diesem Tag ist nichts mehr frei.'}</p>
                  )}
                </>
              )}
            </div>
            <div className="g-foot">
              <span className="g-soft">{start === null ? 'Wähle eine Uhrzeit.' : `${dayLabel(day)}, ${hm(start)} Uhr`}</span>
              <button type="button" disabled={start === null} onClick={() => setStep(2)}>Weiter</button>
            </div>
          </div>
        )}

        {step === 2 && start !== null && (
          <form className="g-body" onSubmit={book}>
            <p className="g-note">{dayLabel(day)}, {hm(start)} Uhr · {persons(party)}{room && ` · ${info.rooms.find(r => r.id === room)?.name}`}
              <button type="button" className="g-alt" onClick={() => setStep(1)}>ändern</button></p>
            <label className="g-field">Name<input required minLength={2} maxLength={80} autoComplete="name" placeholder="Vor- und Nachname" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
            <div className="g-two">
              <label className="g-field">E-Mail<input type="email" maxLength={120} autoComplete="email" spellCheck={false} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
              <label className="g-field">Handy<input type="tel" maxLength={30} autoComplete="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
            </div>
            <p className="g-soft">E-Mail oder Handy genügt.</p>
            <div className="g-field"><span className="g-l">Anlass (optional)</span>
              <div className="g-opts" role="group" aria-label="Anlass">
                {OCCASIONS.map(o => <button type="button" className="g-chip" key={o} aria-pressed={occasion === o} onClick={() => setOccasion(occasion === o ? '' : o)}>{o}</button>)}
              </div>
            </div>
            <label className="g-field">Allergien, Hinweise (optional)<textarea rows={2} maxLength={450} placeholder="z. B. eine Person glutenfrei, Kinderstuhl" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></label>
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.hp} onChange={e => setF({ ...f, hp: e.target.value })} />
            {err && <p className="g-note warn" role="alert">{err}</p>}
            <div className="g-foot">
              <button type="button" className="ghost" onClick={() => setStep(1)}>Zurück</button>
              <button type="submit" disabled={busy}>{busy ? 'Reserviere …' : 'Reservieren'}</button>
            </div>
          </form>
        )}

        {step === 3 && done && (
          <div className="g-body">
            <p className="g-note good" role="status"><b>Danke, {done.name.split(' ')[0]}. Wir haben deine Reservierung.</b></p>
            <dl className="g-sum">
              <dt>Wann</dt><dd>{dayLabel(done.day)}, {hm(done.start)} Uhr</dd>
              <dt>Personen</dt><dd>{done.party}</dd>
              {done.room && <><dt>Bereich</dt><dd>{done.room}</dd></>}
              <dt>Auf den Namen</dt><dd>{done.name}</dd>
            </dl>
            <p className="g-soft">Dein Tisch ist 2 Stunden für dich reserviert. Stornieren geht bis 24 Stunden vorher über <a href={`/s/${done.token}`} target="_blank" rel="noreferrer">diesen Link</a>. Bitte speichere ihn. Sonst bitte direkt im Restaurant melden.</p>
            <div className="g-foot"><span /><button type="button" className="ghost" onClick={again}>Weitere Reservierung</button></div>
          </div>
        )}
      </div>
    </main>
  )
}
