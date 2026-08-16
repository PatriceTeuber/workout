import { TYPES } from './exerciseTypes'
import type { ExerciseType, WorkoutSet } from './types'

export type TrainingDay = {
  date: string
  sets: WorkoutSet[]
  /** best metric of that day — the point drawn on the progress line */
  best: number | null
}

/** Chronological order: older days first, and within a day by set number. */
function chronologically(a: WorkoutSet, b: WorkoutSet): number {
  return a.performed_on === b.performed_on
    ? a.set_no - b.set_no
    : a.performed_on < b.performed_on
      ? -1
      : 1
}

/** Groups one exercise's sets into training days, newest day first. */
export function toTrainingDays(sets: WorkoutSet[], type: ExerciseType): TrainingDay[] {
  const metric = TYPES[type].metric
  const byDate = new Map<string, WorkoutSet[]>()

  for (const set of sets) {
    const day = byDate.get(set.performed_on)
    if (day) day.push(set)
    else byDate.set(set.performed_on, [set])
  }

  return [...byDate.entries()]
    .map(([date, daySets]) => {
      const values = daySets.map(metric).filter((v): v is number => v != null)
      return {
        date,
        sets: [...daySets].sort(chronologically),
        best: values.length ? Math.max(...values) : null,
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** The sets of the most recent training day — what the input is prefilled from. */
export function lastTrainingDay(sets: WorkoutSet[], type: ExerciseType): TrainingDay | null {
  return toTrainingDays(sets, type)[0] ?? null
}

/**
 * Ids of the sets that beat the best of every *earlier* training day.
 *
 * Deliberately measured against earlier days rather than earlier sets: on the
 * first day of an exercise every set would otherwise be a record, which is
 * true and useless — it would paint a whole first session red and leave the
 * accent meaning nothing. Ties do not count; matching your old best is not
 * beating it.
 */
export function personalRecordIds(sets: WorkoutSet[], type: ExerciseType): Set<string> {
  const metric = TYPES[type].metric
  const records = new Set<string>()

  // oldest day first, so everything already seen is "before" the current day
  const days = toTrainingDays(sets, type).reverse()
  let baseline: number | null = null

  for (const day of days) {
    if (baseline !== null) {
      for (const set of day.sets) {
        const value = metric(set)
        if (value != null && value > baseline) records.add(set.id)
      }
    }
    if (day.best != null) baseline = baseline === null ? day.best : Math.max(baseline, day.best)
  }

  return records
}
