import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Team } from './supabase'
import TeamView from './Team'

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function Login() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [signup, setSignup] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setMsg('')
    const { error, data } = signup
      ? await supabase.auth.signUp({ email, password: pw })
      : await supabase.auth.signInWithPassword({ email, password: pw })
    setBusy(false)
    if (error) setMsg(error.message)
    else if (signup && !data.session) setMsg('Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.')
  }
  return (
    <main>
      <h1>Platzhirsch</h1>
      <form onSubmit={submit}>
        <label>E-Mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Passwort<input type="password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)} /></label>
        <button type="submit" disabled={busy}>{signup ? 'Konto anlegen' : 'Anmelden'}</button>
        <button type="button" className="ghost" onClick={() => setSignup(!signup)}>
          {signup ? 'Ich habe schon ein Konto' : 'Neues Konto anlegen'}
        </button>
        {msg && <p className="err" role="alert">{msg}</p>}
      </form>
    </main>
  )
}

function Teams({ session }: { session: Session }) {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<Team | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('memberships')
      .select('role, teams(id, slug, name)')
      .eq('user_id', session.user.id)
    if (error) return setErr(error.message)
    setTeams(
      (data as unknown as { role: Team['role']; teams: Omit<Team, 'role'> }[]).map(m => ({ ...m.teams, role: m.role })),
    )
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function create(e: FormEvent) {
    e.preventDefault()
    setErr('')
    const { error } = await supabase.rpc('create_team', { p_name: name.trim(), p_slug: slugify(name) })
    if (error) return setErr(error.code === '23505' ? 'Dieser Name ist schon vergeben.' : error.message)
    setName('')
    load()
  }

  if (open) return <TeamView team={open} onBack={() => setOpen(null)} />

  return (
    <main>
      <h1>Deine Teams</h1>
      {teams === null ? <p>Lade …</p> : (
        <ul>{teams.map(t => <li key={t.id}><button className="ghost" onClick={() => setOpen(t)}><b>{t.name}</b></button><span>{t.role}</span></li>)}</ul>
      )}
      <h2>Neues Team</h2>
      <form onSubmit={create}>
        <label>Name des Restaurants<input required minLength={2} value={name} onChange={e => setName(e.target.value)} /></label>
        <button type="submit">Team anlegen</button>
        {err && <p className="err" role="alert">{err}</p>}
      </form>
      <p><button className="ghost" onClick={() => supabase.auth.signOut()}>Abmelden</button></p>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return null
  return session ? <Teams session={session} /> : <Login />
}
