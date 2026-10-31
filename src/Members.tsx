import { useEffect, useState, type FormEvent } from 'react'
import { supabase, type Role, type Team } from './supabase'

const ROLES: [Role, string][] = [
  ['admin', 'Admin (alles, auch Team verwalten)'],
  ['editor', 'Bearbeiten (Plan, Tische und Reservierungen)'],
  ['reservations', 'Reservierungen (nur Reservierungen und Gäste)'],
  ['viewer', 'Nur lesen'],
]
type Member = { user_id: string; email: string; role: Role }
type Invite = { email: string; role: Role }

export default function Members({ team }: { team: Team }) {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('reservations')
  const [err, setErr] = useState('')

  async function load() {
    const m = await supabase.rpc('team_members', { p_team: team.id })
    const i = await supabase.from('invitations').select('email, role').eq('team_id', team.id).order('created_at')
    if (m.error || i.error) return setErr((m.error ?? i.error)!.message)
    setMembers(m.data as Member[]); setInvites(i.data as Invite[])
  }
  useEffect(() => { load() }, [team.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function invite(e: FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('invitations').upsert({ team_id: team.id, email: email.trim().toLowerCase(), role })
    if (error) return setErr(error.message)
    setEmail(''); load()
  }
  async function setRoleOf(m: Member, r: Role) {
    setErr('')
    const { error } = await supabase.from('memberships').update({ role: r }).eq('team_id', team.id).eq('user_id', m.user_id)
    if (error) setErr(error.message)
    load()
  }
  async function remove(m: Member) {
    if (!confirm(`${m.email} aus dem Team entfernen?`)) return
    setErr('')
    const { error } = await supabase.from('memberships').delete().eq('team_id', team.id).eq('user_id', m.user_id)
    if (error) setErr(error.message)
    load()
  }
  async function revoke(i: Invite) {
    await supabase.from('invitations').delete().eq('team_id', team.id).eq('email', i.email)
    load()
  }
  const select = (v: Role, on: (r: Role) => void, label: string) => (
    <select aria-label={label} value={v} onChange={e => on(e.target.value as Role)}>
      {ROLES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
    </select>
  )
  return (
    <section className="pp members" aria-label="Team verwalten">
      <h2>Mitglieder</h2>
      <ul>
        {members.map(m => (
          <li key={m.user_id}><span>{m.email}</span>
            {select(m.role, r => setRoleOf(m, r), `Rolle von ${m.email}`)}
            <button className="ghost" onClick={() => remove(m)}>Entfernen</button></li>
        ))}
        {invites.map(i => (
          <li key={i.email}><span>{i.email} <small>(eingeladen)</small></span><span>{ROLES.find(r => r[0] === i.role)![1]}</span>
            <button className="ghost" onClick={() => revoke(i)}>Zurückziehen</button></li>
        ))}
      </ul>
      <form onSubmit={invite}>
        <label>E-Mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Rolle{select(role, setRole, 'Rolle der Einladung')}</label>
        <button type="submit">Einladen</button>
      </form>
      <p><small>Es wird keine Mail verschickt. Gib der Person Bescheid: Sie legt ein Konto mit genau dieser Adresse an (oder meldet sich an) und ist dann automatisch im Team.</small></p>
      {err && <p className="err" role="alert">{err}</p>}
    </section>
  )
}
