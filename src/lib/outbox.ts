import type { Exercise, WorkoutSet } from './types'

export type ExerciseInsert = Pick<Exercise, 'id' | 'name' | 'note' | 'type'>
export type ExercisePatch = Partial<Pick<Exercise, 'name' | 'note' | 'archived'>>
export type SetInsert = Omit<WorkoutSet, 'created_at'>
export type SetPatch = Partial<Pick<WorkoutSet, 'reps' | 'weight' | 'duration_s' | 'set_no'>>

/** A write that still has to reach the server. Every row carries an id the
 *  client generated, so replaying an op can never create a duplicate. */
export type Op =
  | { opId: string; kind: 'exercise.insert'; row: ExerciseInsert }
  | { opId: string; kind: 'exercise.update'; id: string; patch: ExercisePatch }
  | { opId: string; kind: 'set.insert'; row: SetInsert }
  | { opId: string; kind: 'set.update'; id: string; patch: SetPatch }
  | { opId: string; kind: 'set.delete'; id: string }

export type Outcome =
  /** reached the server (or was already there) */
  | 'done'
  /** could not reach the server — try again later, keep the order */
  | 'retry'
  /** the server refused it and always will; retrying would loop forever */
  | 'drop'

/**
 * Sends queued writes in order and returns what is left.
 *
 * Stops at the first `retry`: a set.update must never overtake the set.insert
 * it depends on, so a single unreachable write blocks everything behind it
 * rather than letting later ops jump the queue.
 */
export async function flush(
  queue: readonly Op[],
  perform: (op: Op) => Promise<Outcome>,
): Promise<{ remaining: Op[]; dropped: Op[] }> {
  const remaining = [...queue]
  const dropped: Op[] = []

  while (remaining.length > 0) {
    const op = remaining[0]!
    const outcome = await perform(op)

    if (outcome === 'retry') break

    remaining.shift()
    if (outcome === 'drop') dropped.push(op)
  }

  return { remaining, dropped }
}

const KEY = 'workout.outbox.v1'

export function loadQueue(storage: Storage = localStorage): Op[] {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Op[]) : []
  } catch {
    // Corrupt or unreadable storage must not brick the app on launch; the
    // server copy is the source of truth anyway.
    return []
  }
}

export function saveQueue(queue: readonly Op[], storage: Storage = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(queue))
  } catch {
    // Private mode or a full quota — the write already succeeded in memory and
    // will still be attempted this session.
  }
}
