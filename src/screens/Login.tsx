import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    // On success the auth listener swaps this screen out, so only the failure
    // path has to clean up after itself.
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <header>
        <h1 className="wordmark">Workout</h1>
        <div className="dots" />
      </header>

      <form onSubmit={onSubmit}>
        <div className="field">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="error">{error}</p>}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Signing in' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
