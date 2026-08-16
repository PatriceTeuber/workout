import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { useStore } from '../lib/store'
import { today } from '../lib/date'

export function Profile() {
  const session = useSession()
  const { exercises, sets, pending } = useStore()

  const [name, setName] = useState<string>(
    typeof session?.user.user_metadata.name === 'string' ? session.user.user_metadata.name : '',
  )
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function saveName() {
    setMessage(null)
    setError(null)
    const { error } = await supabase.auth.updateUser({ data: { name: name.trim() } })
    if (error) setError(error.message)
    else setMessage('Name saved')
  }

  async function savePassword() {
    setMessage(null)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setPassword('')
      setMessage('Password changed')
    }
  }

  function exportJson() {
    const payload = JSON.stringify({ exportedOn: today(), exercises, sets }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))

    const link = document.createElement('a')
    link.href = url
    link.download = `workout-${today()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="screen">
      <header className="topbar">
        <Link className="label" to="/">
          ← Back
        </Link>
      </header>
      <div className="dots" />

      <h1 className="title">Profile</h1>

      <div className="field">
        <span className="label">Signed in as</span>
        <span>{session?.user.email}</span>
      </div>

      <section className="panel">
        <div className="field">
          <label className="label" htmlFor="name">
            Display name
          </label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn btn-quiet" onClick={saveName}>
          Save name
        </button>
      </section>

      <section className="panel">
        <div className="field">
          <label className="label" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <button className="btn btn-quiet" disabled={password.length < 6} onClick={savePassword}>
          Change password
        </button>
      </section>

      <section className="panel">
        <p className="label">
          {exercises.length} exercises · {sets.length} sets
          {pending > 0 && ` · ${pending} unsynced`}
        </p>
        <button className="btn btn-quiet" onClick={exportJson}>
          Export as JSON
        </button>
      </section>

      {message && <p className="label">{message}</p>}
      {error && <p className="error">{error}</p>}

      <button className="btn btn-quiet" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </main>
  )
}
