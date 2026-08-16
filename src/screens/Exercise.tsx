import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { TYPES, fmt } from '../lib/exerciseTypes'
import type { FieldKey } from '../lib/exerciseTypes'
import { relativeDay, today } from '../lib/date'
import { personalRecordIds, toTrainingDays } from '../lib/progress'
import { Sparkline } from '../components/Sparkline'
import type { Exercise as ExerciseModel, SetValues, WorkoutSet } from '../lib/types'

type Draft = Record<FieldKey, string>

/** Accepts "62,5" as well — the comma is what a German keyboard offers first. */
function toNumber(raw: string): number | null {
  const cleaned = raw.replace(',', '.').trim()
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

function draftFrom(source: WorkoutSet | undefined): Draft {
  return {
    reps: source?.reps != null ? String(source.reps) : '',
    weight: source?.weight != null ? fmt(source.weight) : '',
    duration_s: source?.duration_s != null ? String(source.duration_s) : '',
  }
}

export function Exercise() {
  const { id } = useParams()
  const { status, exercises, sets } = useStore()

  if (status === 'loading') {
    return (
      <main className="screen">
        <p className="label">Loading</p>
      </main>
    )
  }

  const exercise = exercises.find((e) => e.id === id)
  if (!exercise) return <Navigate to="/" replace />

  const mine = sets.filter((s) => s.exercise_id === exercise.id)

  // Remounting per exercise lets the draft initialise from that exercise's own
  // history instead of carrying values across from the previous screen.
  return <Detail key={exercise.id} exercise={exercise} sets={mine} />
}

function Detail({ exercise, sets }: { exercise: ExerciseModel; sets: WorkoutSet[] }) {
  const { addSet, updateSet, deleteSet } = useStore()
  const config = TYPES[exercise.type]

  const days = useMemo(() => toTrainingDays(sets, exercise.type), [sets, exercise.type])
  const records = useMemo(() => personalRecordIds(sets, exercise.type), [sets, exercise.type])

  const now = today()
  const todaysSets = days[0]?.date === now ? days[0].sets : []
  const previous = days.filter((day) => day.date !== now)

  // What the input starts from: the last set logged, today's if there is one.
  const lastLogged = (todaysSets.length ? todaysSets : (previous[0]?.sets ?? [])).at(-1)

  const [draft, setDraft] = useState<Draft>(() => draftFrom(lastLogged))
  const [editingSet, setEditingSet] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingExercise, setEditingExercise] = useState(false)

  const values: SetValues = {
    reps: toNumber(draft.reps),
    weight: toNumber(draft.weight),
    duration_s: toNumber(draft.duration_s),
  }

  const missing = config.fields.some((field) => !field.optional && values[field.key] == null)

  function nudge(key: FieldKey, step: number) {
    setDraft((prev) => {
      const next = (toNumber(prev[key]) ?? 0) + step
      return { ...prev, [key]: next > 0 ? fmt(next) : '' }
    })
  }

  function startEditing(set: WorkoutSet) {
    setEditingSet(set.id)
    setConfirmDelete(null)
    setDraft(draftFrom(set))
  }

  function stopEditing() {
    setEditingSet(null)
    setDraft(draftFrom(lastLogged))
  }

  function commit() {
    if (editingSet) {
      updateSet(editingSet, values)
      setEditingSet(null)
    } else {
      addSet(exercise.id, values)
    }
  }

  return (
    <main className="screen">
      <header className="topbar">
        <Link className="label" to="/">
          ← Back
        </Link>
        <button className="label link-plain" onClick={() => setEditingExercise((on) => !on)}>
          {editingExercise ? 'Close' : 'Edit'}
        </button>
      </header>
      <div className="dots" />

      <div className="titlerow">
        <div>
          <h1 className="title">{exercise.name}</h1>
          {exercise.note && <p className="label">{exercise.note}</p>}
        </div>
        {days.length > 1 && <Sparkline values={[...days].reverse().map((d) => d.best ?? 0)} />}
      </div>

      {editingExercise && (
        <EditExercise exercise={exercise} onDone={() => setEditingExercise(false)} />
      )}

      <section className={editingSet ? 'panel panel-editing' : 'panel'}>
        {editingSet && <p className="label">Editing a set</p>}

        <div className="inputs">
          {config.fields.map((field) => (
            <div className="field" key={field.key}>
              <label className="label" htmlFor={field.key}>
                {field.label}
                {field.unit && ` — ${field.unit}`}
              </label>
              <div className="stepper">
                <button type="button" onClick={() => nudge(field.key, -field.step)}>
                  −
                </button>
                <input
                  id={field.key}
                  value={draft[field.key]}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  inputMode={field.key === 'weight' ? 'decimal' : 'numeric'}
                  placeholder={field.optional ? '—' : ''}
                />
                <button type="button" onClick={() => nudge(field.key, field.step)}>
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="row-actions">
          {editingSet && (
            <button className="btn btn-quiet" onClick={stopEditing}>
              Cancel
            </button>
          )}
          <button className="btn" disabled={missing} onClick={commit}>
            {editingSet ? 'Save set' : 'Add set'}
          </button>
        </div>
      </section>

      <section>
        <p className="label">Today</p>
        {todaysSets.length === 0 ? (
          <p className="empty">No sets yet.</p>
        ) : (
          <ul className="list">
            {todaysSets.map((set, index) => (
              <li key={set.id} className={editingSet === set.id ? 'row row-active' : 'row'}>
                <button className="row-main link-plain" onClick={() => startEditing(set)}>
                  <span className="label">Set {index + 1}</span>{' '}
                  <span className={records.has(set.id) ? 'record' : undefined}>
                    {config.summary(set)}
                  </span>
                </button>
                {confirmDelete === set.id ? (
                  <button
                    className="link-danger"
                    onClick={() => {
                      if (editingSet === set.id) stopEditing()
                      deleteSet(set.id)
                    }}
                  >
                    Delete?
                  </button>
                ) : (
                  <button className="link-quiet" onClick={() => setConfirmDelete(set.id)}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="label">History</p>
        {previous.length === 0 ? (
          <p className="empty">Nothing logged before today.</p>
        ) : (
          <ul className="list">
            {previous.map((day) => (
              <li key={day.date} className="row">
                <span className="row-main label">{relativeDay(day.date)}</span>
                <span className="sets">
                  {day.sets.map((set) => (
                    <span key={set.id} className={records.has(set.id) ? 'record' : undefined}>
                      {config.summary(set)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function EditExercise({ exercise, onDone }: { exercise: ExerciseModel; onDone: () => void }) {
  const { exercises, updateExercise } = useStore()
  const navigate = useNavigate()

  const [name, setName] = useState(exercise.name)
  const [note, setNote] = useState(exercise.note ?? '')
  const [clash, setClash] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return

    const taken = exercises.some(
      (e) => e.id !== exercise.id && !e.archived && e.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (taken) {
      setClash(true)
      return
    }

    updateExercise(exercise.id, { name: trimmed, note: note.trim() || null })
    onDone()
  }

  function archive() {
    updateExercise(exercise.id, { archived: true })
    navigate('/', { replace: true })
  }

  return (
    <section className="panel">
      <div className="field">
        <label className="label" htmlFor="edit-name">
          Name
        </label>
        <input
          id="edit-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setClash(false)
          }}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="edit-note">
          Note — optional
        </label>
        <input id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {clash && <p className="error">Another exercise already has that name.</p>}

      <div className="row-actions">
        <button className="btn btn-quiet" onClick={onDone}>
          Cancel
        </button>
        <button className="btn" onClick={save}>
          Save
        </button>
      </div>

      {/* Archiving keeps the history but takes the exercise out of the list —
          the sets stay attached, so nothing you logged is ever lost. */}
      {confirmArchive ? (
        <button className="btn btn-danger" onClick={archive}>
          Archive — history is kept
        </button>
      ) : (
        <button className="btn btn-quiet" onClick={() => setConfirmArchive(true)}>
          Archive exercise
        </button>
      )}
    </section>
  )
}
