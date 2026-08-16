export type ExerciseType = 'strength' | 'time'

export type Exercise = {
  id: string
  name: string
  note: string | null
  type: ExerciseType
  archived: boolean
  created_at: string
}

/** One set — the unit everything else is derived from. Named `WorkoutSet`
 *  because `Set` is taken by the language. */
export type WorkoutSet = {
  id: string
  exercise_id: string
  /** local calendar day, YYYY-MM-DD; every set sharing one is one session */
  performed_on: string
  set_no: number
  reps: number | null
  weight: number | null
  duration_s: number | null
  created_at: string
}

/** The measurable part of a set, without the bookkeeping. */
export type SetValues = Pick<WorkoutSet, 'reps' | 'weight' | 'duration_s'>
