import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { DEFAULT_COLORS, supabase, type Colors, type Team as TeamT } from './supabase'
import Plan from './Plan'
import Timeline from './Timeline'
import Members from './Members'

export default function Team({ team, onBack }: { team: TeamT; onBack: () => void }) {
  const [view, setView] = useState<'tl' | 'plan'>('tl')
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [colors, setColors] = useState<Colors>(DEFAULT_COLORS)
  const [picking, setPicking] = useState(false)
  const [people, setPeople] = useState(false)
  const [embed, setEmbed] = useState(false)
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
  async function saveSetting(k: string, v: number) {
    if (!Number.isFinite(v)) return
    setErr('')
    const next = { ...settings, [k]: v }
    setSettings(next)
    const { error } = await supabase.from('teams').update({ settings: next }).eq('id', team.id)
    if (error) setErr(error.message)
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
          {team.role === 'admin' && <button className="ghost" aria-expanded={embed} onClick={() => setEmbed(!embed)}>Einbinden</button>}
          {team.role === 'admin' && <button className="ghost" aria-expanded={people} onClick={() => setPeople(!people)}>Team</button>}
          {team.role === 'admin' && <button className="ghost" aria-expanded={picking} onClick={() => setPicking(!picking)}>Farben</button>}
          <div className="seg" role="group" aria-label="Ansicht">
            <button aria-pressed={view === 'tl'} onClick={() => setView('tl')}>Zeitleiste</button>
            <button aria-pressed={view === 'plan'} onClick={() => setView('plan')}>Raumplan</button>
          </div>
        </div>
      </div>
      {picking && (
        <div className="pp">
          {field('free', 'Frei')}{field('busy', 'Belegt')}{field('reserve', 'Wetter-Reserve')}
          <button className="ghost" onClick={() => saveColors(DEFAULT_COLORS)}>Zurücksetzen</button>
          {err && <p className="err" role="alert">{err}</p>}
        </div>
      )}
      {embed && (
        <section className="pp" aria-label="Einbinden">
          <h2>Auf der Restaurant-Seite einbinden</h2>
          <p>Link zur Reservierungsseite: <a href={`${location.origin}/b/${team.slug}`} target="_blank" rel="noreferrer">{`${location.origin}/b/${team.slug}`}</a></p>
          <p>Zum Einfügen in die Seite des Restaurants (HTML):</p>
          <h2>Online-Regeln</h2>
          <div className="rules">
            <label>Erste Startzeit<input type="time" step={3600} value={hmIn(num('open_from', 1080))} onChange={e => saveSetting('open_from', toMin(e.target.value))} /></label>
            <label>Ende (Tisch frei bis)<input type="time" step={3600} value={hmIn(num('open_to', 1320))} onChange={e => saveSetting('open_to', toMin(e.target.value))} /></label>
            <label>Vorlauf in Stunden<input type="number" min={0} max={720} value={num('online_lead_hours', 24)} onChange={e => saveSetting('online_lead_hours', Number(e.target.value))} /></label>
            <label>Aufenthalt in Minuten<input type="number" min={30} max={480} step={15} value={num('stay_minutes', 120)} onChange={e => saveSetting('stay_minutes', Number(e.target.value))} /></label>
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <textarea readOnly rows={3} value={`<iframe src="${location.origin}/b/${team.slug}" title="Tisch reservieren" style="width:100%;max-width:560px;height:760px;border:0"></iframe>`} onFocus={e => e.target.select()} />
        </section>
      )}
      {people && <Members team={team} />}
      {view === 'tl' ? <Timeline team={team} /> : <Plan team={team} />}
    </main>
  )
}
