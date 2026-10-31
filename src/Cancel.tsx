import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { dayLabel, hm } from './booking'

type Info = { team: string; day: string; start_min: number; party: number; name: string | null; room: string | null; can_cancel: boolean; cancel_hours: number }

export default function Cancel({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null | undefined>(undefined)
  const [gone, setGone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.rpc('public_cancel_info', { p_token: token }).then(({ data }) => setInfo((data as Info | null) ?? null))
  }, [token])

  async function cancel() {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('public_cancel', { p_token: token })
    setBusy(false)
    if (error) return setErr(error.message)
    setGone(true)
  }

  if (info === undefined) return <main className="gast"><p>Lade …</p></main>
  if (info === null && !gone) return <main className="gast"><p className="g-note warn">Diese Reservierung gibt es nicht (mehr). Vielleicht wurde sie schon storniert.</p></main>
  if (gone) return <main className="gast"><p className="g-note good" role="status"><b>Deine Reservierung ist storniert.</b></p></main>
  const i = info!
  return (
    <main className="gast">
      <div className="g-card">
        <div className="g-body">
          <h1>{i.team}</h1>
          <dl className="g-sum">
            <dt>Wann</dt><dd>{dayLabel(i.day)}, {hm(i.start_min)} Uhr</dd>
            <dt>Personen</dt><dd>{i.party}</dd>
            {i.room && <><dt>Bereich</dt><dd>{i.room}</dd></>}
            {i.name && <><dt>Auf den Namen</dt><dd>{i.name}</dd></>}
          </dl>
          {i.can_cancel
            ? <button onClick={cancel} disabled={busy}>{busy ? 'Storniere …' : 'Reservierung stornieren'}</button>
            : <p className="g-note warn">Online stornieren geht nur bis {i.cancel_hours} Stunden vorher. Bitte ruf uns an.</p>}
          {err && <p className="g-note warn" role="alert">{err}</p>}
        </div>
      </div>
    </main>
  )
}
