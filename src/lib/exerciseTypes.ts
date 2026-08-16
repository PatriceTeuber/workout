import type { ExerciseType, SetValues, WorkoutSet } from './types'

export type FieldKey = 'reps' | 'weight' | 'duration_s'

type Field = {
  key: FieldKey
  label: string
  unit: string
  step: number
  /** optional fields may stay empty — bodyweight pull-ups, unweighted planks */
  optional: boolean
}

type TypeConfig = {
  label: string
  fields: Field[]
  /** the single number this type is judged by, drawn as the progress line */
  metric: (set: SetValues) => number | null
  metricUnit: string
  /** one line summarising a set, e.g. "12 × 60 kg" */
  summary: (set: SetValues) => string
}

const REPS: Field = { key: 'reps', label: 'Reps', unit: '', step: 1, optional: false }
const WEIGHT: Field = { key: 'weight', label: 'Weight', unit: 'kg', step: 2.5, optional: true }
const DURATION: Field = { key: 'duration_s', label: 'Time', unit: 's', step: 5, optional: false }

/* Everything type-specific lives in this table. Screens read from it instead of
   branching on the type, so adding e.g. cardio later is one more entry here. */
export const TYPES: Record<ExerciseType, TypeConfig> = {
  strength: {
    label: 'Strength',
    fields: [REPS, WEIGHT],
    // Without added weight the reps are the progress — bodyweight exercises get
    // harder by doing more of them, not by loading more.
    metric: (s) => s.weight ?? s.reps,
    metricUnit: 'kg',
    summary: (s) => (s.weight == null ? `${s.reps ?? 0} reps` : `${s.reps ?? 0} × ${fmt(s.weight)} kg`),
  },
  time: {
    label: 'Time',
    fields: [DURATION, WEIGHT],
    metric: (s) => s.duration_s,
    metricUnit: 's',
    summary: (s) =>
      s.weight == null ? `${s.duration_s ?? 0}s` : `${s.duration_s ?? 0}s × ${fmt(s.weight)} kg`,
  },
}

/** Trailing zeros are noise: 60 not 60.00, but 62.5 stays 62.5. */
export function fmt(value: number): string {
  return String(Number(value.toFixed(2)))
}

export function summarise(set: WorkoutSet, type: ExerciseType): string {
  return TYPES[type].summary(set)
}
