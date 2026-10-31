import { useEffect, useState, type CSSProperties } from 'react'
import { DEFAULT_COLORS, supabase, type Colors, type Team as TeamT } from './supabase'
import Plan from './Plan'
import Timeline from './Timeline'

export default function Team({ team, onBack }: { team: TeamT; onBack: () => void }) {
  const [view, setView] = useState<'tl' | 'plan'>('tl')
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [colors, setColors] = useState<Colors>(DEFAULT_COLORS)
  const [picking, setPicking] = useState(false)
  const [err, setErr] = useState('')

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

  const vars = { '--c-free': colors.free, '--c-busy': colors.busy, '--c-res': colors.reserve } as CSSProperties
  const field = (k: keyof Colors, label: string) => (
    <label className="color">{label}<input type="color" value={colors[k]} onChange={e => setColors({ ...colors, [k]: e.target.value })} onBlur={() => saveColors(colors)} /></label>
  )
  return (
    <main className="wide" style={vars}>
      <p><button className="ghost" onClick={onBack}>← Teams</button></p>
      <div className="head"><h1>{team.name}</h1>
        <div className="acts">
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
      {view === 'tl' ? <Timeline team={team} /> : <Plan team={team} />}
    </main>
  )
}
