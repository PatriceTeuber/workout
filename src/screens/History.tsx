import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { TYPES } from '../lib/exerciseTypes'
import { relativeDay } from '../lib/date'
import type { WorkoutSet } from '../lib/types'

export function History() {
  const { status, exercises, sets } = useStore()

  const days = useMemo(() => {
    const byDate = new Map<string, WorkoutSet[]>()
    for (const set of sets) {
      const day = byDate.get(set.performed_on)
      if (day) day.push(set)
      else byDate.set(set.performed_on, [set])
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, daySets]) => {
        // Group a day's sets by exercise, keeping the order they were logged in.
        const byExercise = new Map<string, WorkoutSet[]>()
        for (const set of [...daySets].sort((a, b) => a.set_no - b.set_no)) {
          const group = byExercise.get(set.exercise_id)
          if (group) group.push(set)
          else byExercise.set(set.exercise_id, [set])
        }
        return { date, total: daySets.length, byExercise }
      })
  }, [sets])

  return (
    <main className="screen">
      <header className="topbar">
        <Link className="label" to="/">
          ← Back
        </Link>
      </header>
      <div className="dots" />

      <h1 className="title">History</h1>

      {status === 'loading' && <p className="label">Loading</p>}

      {status === 'ready' && days.length === 0 && <p className="empty">Nothing logged yet.</p>}

      <ul className="list">
        {days.map((day) => (
          <li key={day.date}>
            <details className="day">
              <summary>
                <span className="row-main">{relativeDay(day.date)}</span>
                <span className="label">
                  {day.byExercise.size} exercises · {day.total} sets
                </span>
              </summary>

              {[...day.byExercise.entries()].map(([exerciseId, group]) => {
                const exercise = exercises.find((e) => e.id === exerciseId)
                if (!exercise) return null

                return (
                  <div className="row" key={exerciseId}>
                    <span className="row-main">{exercise.name}</span>
                    <span className="sets">
                      {group.map((set) => (
                        <span key={set.id}>{TYPES[exercise.type].summary(set)}</span>
                      ))}
                    </span>
                  </div>
                )
              })}
            </details>
          </li>
        ))}
      </ul>
    </main>
  )
}
