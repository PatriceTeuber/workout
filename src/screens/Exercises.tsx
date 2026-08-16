import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { TYPES } from '../lib/exerciseTypes'
import { relativeDay } from '../lib/date'
import { toTrainingDays } from '../lib/progress'
import type { Exercise, ExerciseType } from '../lib/types'

export function Exercises() {
  const { status, error, exercises, sets, pending } = useStore()
  const [adding, setAdding] = useState(false)

  const active = useMemo(() => exercises.filter((e) => !e.archived), [exercises])

  /** Last training day per exercise, with that day's best set spelled out. */
  const lastSeen = useMemo(() => {
    const map = new Map<string, { date: string; summary: string }>()

    for (const exercise of active) {
      const mine = sets.filter((s) => s.exercise_id === exercise.id)
      const [latest] = toTrainingDays(mine, exercise.type)
      if (!latest) continue

      const config = TYPES[exercise.type]
      const top = latest.sets.reduce((best, set) =>
        (config.metric(set) ?? -Infinity) > (config.metric(best) ?? -Infinity) ? set : best,
      )
      map.set(exercise.id, { date: latest.date, summary: config.summary(top) })
    }
    return map
  }, [active, sets])

  // Whatever you trained most recently is what you are most likely to open.
  const ordered = useMemo(
    () =>
      [...active].sort((a, b) => {
        const dateA = lastSeen.get(a.id)?.date ?? ''
        const dateB = lastSeen.get(b.id)?.date ?? ''
        return dateA === dateB ? a.name.localeCompare(b.name) : dateA < dateB ? 1 : -1
      }),
    [active, lastSeen],
  )

  return (
    <main className="screen">
      <header className="topbar">
        <h1 className="wordmark">Workout</h1>
        <nav className="navlinks">
          <Link className="label" to="/history">
            History
          </Link>
          <Link className="label" to="/profile">
            Profile
          </Link>
        </nav>
      </header>
      <div className="dots" />

      {pending > 0 && <p className="label pending">{pending} unsynced</p>}
      {error && <p className="error">{error}</p>}

      {status === 'loading' && <p className="label">Loading</p>}

      {status === 'ready' && (
        <>
          {ordered.length === 0 && !adding && (
            <p className="empty">No exercises yet. Add the first machine you use.</p>
          )}

          <ul className="list">
            {ordered.map((exercise) => (
              <li key={exercise.id}>
                <Link className="row" to={`/exercise/${exercise.id}`}>
                  <span className="row-main">{exercise.name}</span>
                  <span className="row-meta">
                    {lastSeen.has(exercise.id) ? (
                      <>
                        <span>{lastSeen.get(exercise.id)!.summary}</span>
                        <span className="label">{relativeDay(lastSeen.get(exercise.id)!.date)}</span>
                      </>
                    ) : (
                      <span className="label">Never</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {adding ? (
            <NewExercise onDone={() => setAdding(false)} />
          ) : (
            <button className="btn" onClick={() => setAdding(true)}>
              New exercise
            </button>
          )}
        </>
      )}
    </main>
  )
}

function NewExercise({ onDone }: { onDone: () => void }) {
  const { addExercise, exercises } = useStore()
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [type, setType] = useState<ExerciseType>('strength')
  const [clash, setClash] = useState<Exercise | null>(null)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    // The database rejects duplicates, but that rejection would arrive minutes
    // later from the queue — catch it here where it can still be explained.
    const existing = exercises.find(
      (e) => !e.archived && e.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (existing) {
      setClash(existing)
      return
    }

    addExercise({ name: trimmed, note: note.trim() || null, type })
    onDone()
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <div className="field">
        <label className="label" htmlFor="name">
          Exercise
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setClash(null)
          }}
          placeholder="Leg press"
          autoFocus
          required
        />
      </div>

      <div className="field">
        <span className="label">Measured in</span>
        <div className="seg">
          {(Object.keys(TYPES) as ExerciseType[]).map((key) => (
            <button
              key={key}
              type="button"
              className={type === key ? 'seg-on' : ''}
              onClick={() => setType(key)}
            >
              {TYPES[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="note">
          Note — optional
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Seat 4, back rest 2"
        />
      </div>

      {clash && <p className="error">“{clash.name}” already exists.</p>}

      <div className="row-actions">
        <button className="btn btn-quiet" type="button" onClick={onDone}>
          Cancel
        </button>
        <button className="btn" type="submit">
          Add
        </button>
      </div>
    </form>
  )
}
