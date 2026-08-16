import { createContext, use, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import { useSession } from './session'
import { today } from './date'
import { flush, loadQueue, saveQueue } from './outbox'
import type { Op, Outcome } from './outbox'
import type { Exercise, ExerciseType, SetValues, WorkoutSet } from './types'

type Status = 'loading' | 'ready' | 'error'

type Store = {
  status: Status
  error: string | null
  exercises: Exercise[]
  sets: WorkoutSet[]
  /** writes not yet acknowledged by the server */
  pending: number
  addExercise: (input: { name: string; note: string | null; type: ExerciseType }) => Exercise
  updateExercise: (id: string, patch: { name?: string; note?: string | null; archived?: boolean }) => void
  addSet: (exerciseId: string, values: SetValues) => void
  updateSet: (id: string, values: SetValues) => void
  deleteSet: (id: string) => void
}

const StoreContext = createContext<Store | null>(null)

/**
 * Decides what to do with a failed write.
 *
 * The distinction that matters: a reply from the server means the write is
 * wrong and will stay wrong, while no reply means we are offline and should
 * try again. Retrying a rejected write forever would block the whole queue.
 */
function classify(error: { code?: string; message?: string } | null): Outcome {
  if (!error) return 'done'

  const code = error.code ?? ''
  // Our own primary key came back — a replayed write that already landed.
  if (code === '23505') return 'done'
  // A Postgres SQLSTATE or a PostgREST code means the server answered.
  if (/^[0-9A-Z]{5}$/.test(code) || code.startsWith('PGRST')) return 'drop'

  return 'retry'
}

async function perform(op: Op): Promise<Outcome> {
  switch (op.kind) {
    case 'exercise.insert':
      return classify((await supabase.from('exercises').insert(op.row)).error)
    case 'exercise.update':
      return classify((await supabase.from('exercises').update(op.patch).eq('id', op.id)).error)
    case 'set.insert':
      return classify((await supabase.from('sets').insert(op.row)).error)
    case 'set.update':
      return classify((await supabase.from('sets').update(op.patch).eq('id', op.id)).error)
    case 'set.delete':
      return classify((await supabase.from('sets').delete().eq('id', op.id)).error)
  }
}

const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name)

export function StoreProvider({ children }: { children: ReactNode }) {
  const session = useSession()
  const userId = session?.user.id

  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [pending, setPending] = useState(0)

  // Mirrors of the state that stay correct between renders, so two taps in
  // quick succession cannot both read the same "previous" list.
  const exercisesRef = useRef<Exercise[]>([])
  const setsRef = useRef<WorkoutSet[]>([])
  const queue = useRef<Op[]>(loadQueue())
  const flushing = useRef(false)

  const applyExercises = useCallback((update: (prev: Exercise[]) => Exercise[]) => {
    exercisesRef.current = update(exercisesRef.current)
    setExercises(exercisesRef.current)
  }, [])

  const applySets = useCallback((update: (prev: WorkoutSet[]) => WorkoutSet[]) => {
    setsRef.current = update(setsRef.current)
    setSets(setsRef.current)
  }, [])

  const runFlush = useCallback(async () => {
    if (flushing.current || queue.current.length === 0) return
    flushing.current = true
    try {
      const { remaining, dropped } = await flush(queue.current, perform)
      queue.current = remaining
      saveQueue(remaining)
      setPending(remaining.length)
      if (dropped.length > 0) {
        setError(`${dropped.length} change${dropped.length > 1 ? 's were' : ' was'} rejected`)
      }
    } finally {
      flushing.current = false
    }
  }, [])

  const enqueue = useCallback(
    (op: Op) => {
      queue.current = [...queue.current, op]
      saveQueue(queue.current)
      setPending(queue.current.length)
      void runFlush()
    },
    [runFlush],
  )

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    void (async () => {
      setStatus('loading')
      const [ex, st] = await Promise.all([
        supabase.from('exercises').select('*'),
        supabase.from('sets').select('*'),
      ])
      if (cancelled) return

      const failure = ex.error ?? st.error
      if (failure) {
        setError(failure.message)
        setStatus('error')
        return
      }

      exercisesRef.current = (ex.data as Exercise[]).sort(byName)
      setsRef.current = st.data as WorkoutSet[]
      setExercises(exercisesRef.current)
      setSets(setsRef.current)
      setPending(queue.current.length)
      setStatus('ready')
      void runFlush()
    })()

    return () => {
      cancelled = true
    }
  }, [userId, runFlush])

  useEffect(() => {
    const retry = () => void runFlush()
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [runFlush])

  const addExercise: Store['addExercise'] = useCallback(
    (input) => {
      const row = { id: crypto.randomUUID(), ...input }
      const exercise: Exercise = { ...row, archived: false, created_at: new Date().toISOString() }

      applyExercises((prev) => [...prev, exercise].sort(byName))
      enqueue({ opId: crypto.randomUUID(), kind: 'exercise.insert', row })
      return exercise
    },
    [applyExercises, enqueue],
  )

  const updateExercise: Store['updateExercise'] = useCallback(
    (id, patch) => {
      applyExercises((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e)).sort(byName),
      )
      enqueue({ opId: crypto.randomUUID(), kind: 'exercise.update', id, patch })
    },
    [applyExercises, enqueue],
  )

  const addSet: Store['addSet'] = useCallback(
    (exerciseId, values) => {
      const performedOn = today()
      // Highest existing number plus one — never a gap-filling reuse, so a
      // deleted set cannot make two sets share a position.
      const setNo =
        setsRef.current
          .filter((s) => s.exercise_id === exerciseId && s.performed_on === performedOn)
          .reduce((max, s) => Math.max(max, s.set_no), 0) + 1

      const row = {
        id: crypto.randomUUID(),
        exercise_id: exerciseId,
        performed_on: performedOn,
        set_no: setNo,
        ...values,
      }

      applySets((prev) => [...prev, { ...row, created_at: new Date().toISOString() }])
      enqueue({ opId: crypto.randomUUID(), kind: 'set.insert', row })
    },
    [applySets, enqueue],
  )

  const updateSet: Store['updateSet'] = useCallback(
    (id, values) => {
      applySets((prev) => prev.map((s) => (s.id === id ? { ...s, ...values } : s)))
      enqueue({ opId: crypto.randomUUID(), kind: 'set.update', id, patch: values })
    },
    [applySets, enqueue],
  )

  const deleteSet: Store['deleteSet'] = useCallback(
    (id) => {
      applySets((prev) => prev.filter((s) => s.id !== id))
      enqueue({ opId: crypto.randomUUID(), kind: 'set.delete', id })
    },
    [applySets, enqueue],
  )

  const value: Store = {
    status,
    error,
    exercises,
    sets,
    pending,
    addExercise,
    updateExercise,
    addSet,
    updateSet,
    deleteSet,
  }

  return <StoreContext value={value}>{children}</StoreContext>
}

export function useStore(): Store {
  const store = use(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}
