import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { DEFAULT_COLORS, supabase, type Colors, type Team as TeamT } from './supabase'
import Plan from './Plan'
import Timeline from './Timeline'
import Members from './Members'
import { isoDay } from './booking'

export default function Team({ team, onBack }: { team: TeamT; onBack: () => void }) {
  const [view, setView] = useState<'tl' | 'plan'>('tl')
  const [day, setDay] = useState(isoDay(new Date()))
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [colors, setColors] = useState<Colors>(DEFAULT_COLORS)
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [people, setPeople] = useState(false)
  const [embedBg, setEmbedBg] = useState('')
  const [err, setErr] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    supabase.from('teams').select('settings').eq('id', team.id).single().then(({ data }) => {
      const st = (data?.settings ?? {}) as Record<string, unknown>
      setSettings(st); setColors({ ...DEFAULT_COLORS, ...(st.colors as Partial<Colors> | undefined) })
    })
  }, [team.id])

  async function saveColors(c: Colors) {
    setErr('')
    const next = { ...settings, colors: c }
    const { error } = await supabase.from('teams').update({ settings: next }).eq('id', team.id)
    if (error) return setErr(error.message)
    setSettings(next); setColors(c)
  }

  const num = (k: string, d: number) => (typeof settings[k] === 'number' ? (settings[k] as number) : d)
  const hmIn = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const toMin = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + (m || 0) }
  async function saveSetting(k: string, v: number | number[]) {
    if (typeof v === 'number' && !Number.isFinite(v)) return
    setErr('')
    const next = { ...settings, [k]: v }
    setSettings(next)
    const { error } = await supabase.from('teams').update({ settings: next }).eq('id', team.id)
    if (error) setErr(error.message)
  }
  const openDays = Array.isArray(settings.open_days) ? (settings.open_days as number[]) : [1, 2, 3, 4, 5, 6, 7]
  const toggleDay = (d: number) => {
    const next = openDays.includes(d) ? openDays.filter(x => x !== d) : [...openDays, d].sort()
    if (next.length) saveSetting('open_days', next)
  }
  const vars = { '--c-free': colors.free, '--c-busy': colors.busy, '--c-res': colors.reserve } as CSSProperties
  const field = (k: keyof Colors, label: string) => (
    <label className="color">{label}<input type="color" value={colors[k]} onChange={e => { const c = { ...colors, [k]: e.target.value }; setColors(c); clearTimeout(timer.current); timer.current = setTimeout(() => saveColors(c), 600) }} /></label>
  )
  return (
    <main className="wide" style={vars}>
      <p><button className="ghost" onClick={onBack}>← Teams</button></p>
      <div className="head"><h1>{team.name}</h1>
        <div className="acts">
          {team.role === 'admin' && <button className="ghost" aria-expanded={people} onClick={() => setPeople(!people)}>Stammdaten</button>}
          {team.role === 'admin' && editing && <button className="ghost" aria-expanded={picking} onClick={() => setPicking(!picking)}>Farben</button>}
          <div className="seg" role="group" aria-label="Ansicht">
            <button aria-pressed={view === 'tl'} onClick={() => setView('tl')}>Zeitleiste</button>
            <button aria-pressed={view === 'plan'} onClick={() => setView('plan')}>Raumplan</button>
          </div>
        </div>
      </div>
      {picking && editing && (
        <div className="pp">
          {field('free', 'Frei')}{field('busy', 'Belegt')}{field('reserve', 'Wetter-Reserve')}
          <button className="ghost" onClick={() => saveColors(DEFAULT_COLORS)}>Zurücksetzen</button>
          {err && <p className="err" role="alert">{err}</p>}
        </div>
      )}
      {people && (
        <div className="stamm">
          <section aria-label="Öffnungstage und Online-Regeln">
            <h2>Öffnungstage und Online-Regeln</h2>
            <div className="wdays" role="group" aria-label="Öffnungstage">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((t, i) => (
                <button key={t} aria-pressed={openDays.includes(i + 1)} onClick={() => toggleDay(i + 1)}>{t}</button>
              ))}
            </div>
            <p><small>Ausgeschaltete Tage sind online nicht buchbar. Telefonisch und im Team geht weiterhin alles.</small></p>
            <div className="rules">
              <label>Erste Startzeit<input type="time" step={3600} value={hmIn(num('open_from', 1080))} onChange={e => saveSetting('open_from', toMin(e.target.value))} /></label>
              <label>Letzte Startzeit<input type="time" step={3600} value={hmIn(num('open_to', 1200))} onChange={e => saveSetting('open_to', toMin(e.target.value))} /></label>
              <label>Zeitraster in der Zeitleiste
                <select value={num('slot_minutes', 30)} onChange={e => saveSetting('slot_minutes', Number(e.target.value))}>
                  <option value={60}>Stündlich</option><option value={30}>Halbstündlich</option><option value={15}>Viertelstündlich</option>
                </select>
              </label>
              <label>Vorlauf in Stunden<input type="number" min={0} max={720} value={num('online_lead_hours', 24)} onChange={e => saveSetting('online_lead_hours', Number(e.target.value))} /></label>
              <label>Aufenthalt in Minuten<input type="number" min={30} max={480} step={15} value={num('stay_minutes', 120)} onChange={e => saveSetting('stay_minutes', Number(e.target.value))} /></label>
            </div>
            {err && <p className="err" role="alert">{err}</p>}
          </section>
          <section aria-label="Einbinden">
            <h2>Reservierungsseite einbinden</h2>
            <p>Link: <a href={`${location.origin}/b/${team.slug}`} target="_blank" rel="noreferrer">{`${location.origin}/b/${team.slug}`}</a></p>
            <label>Hintergrund
              <select value={embedBg} onChange={e => setEmbedBg(e.target.value)}>
                <option value="">Mit Hintergrund</option>
                <option value="?transparent=1">Transparent, helle Seite</option>
                <option value="?transparent=1&theme=dark">Transparent, dunkle Seite</option>
              </select>
            </label>
            <p>Zum Einfügen in die Seite des Restaurants (HTML):</p>
            <textarea readOnly rows={3} value={`<iframe src="${location.origin}/b/${team.slug}${embedBg}" title="Tisch reservieren" style="width:100%;max-width:560px;height:820px;border:0" allowtransparency="true"></iframe>`} onFocus={e => e.target.select()} />
          </section>
          <Members team={team} />
        </div>
      )}
      {view === 'tl' ? <Timeline team={team} onEditing={setEditing} day={day} setDay={setDay} slot={num('slot_minutes', 30)} /> : <Plan team={team} onEditing={setEditing} day={day} setDay={setDay} />}
    </main>
  )
}
