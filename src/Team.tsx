import { useState } from 'react'
import type { Team as TeamT } from './supabase'
import Plan from './Plan'
import Timeline from './Timeline'

export default function Team({ team, onBack }: { team: TeamT; onBack: () => void }) {
  const [view, setView] = useState<'tl' | 'plan'>('tl')
  return (
    <main className="wide">
      <p><button className="ghost" onClick={onBack}>← Teams</button></p>
      <div className="head"><h1>{team.name}</h1>
        <div className="seg" role="group" aria-label="Ansicht">
          <button aria-pressed={view === 'tl'} onClick={() => setView('tl')}>Zeitleiste</button>
          <button aria-pressed={view === 'plan'} onClick={() => setView('plan')}>Raumplan</button>
        </div>
      </div>
      {view === 'tl' ? <Timeline team={team} /> : <Plan team={team} />}
    </main>
  )
}
