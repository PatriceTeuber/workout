import { describe, expect, it } from 'vitest'
import { lastTrainingDay, personalRecordIds, toTrainingDays } from './progress'
import type { WorkoutSet } from './types'

const set = (over: Partial<WorkoutSet> & { id: string }): WorkoutSet => ({
  exercise_id: 'e1',
  performed_on: '2026-08-01',
  set_no: 1,
  reps: null,
  weight: null,
  duration_s: null,
  created_at: '',
  ...over,
})

describe('toTrainingDays', () => {
  it('groups sets by day, newest first, and takes the day’s best as the point', () => {
    const days = toTrainingDays(
      [
        set({ id: 'a', performed_on: '2026-08-01', set_no: 1, reps: 12, weight: 60 }),
        set({ id: 'b', performed_on: '2026-08-01', set_no: 2, reps: 10, weight: 70 }),
        set({ id: 'c', performed_on: '2026-08-08', set_no: 1, reps: 12, weight: 65 }),
      ],
      'strength',
    )

    expect(days.map((d) => d.date)).toEqual(['2026-08-08', '2026-08-01'])
    expect(days[0]!.best).toBe(65)
    expect(days[1]!.best).toBe(70)
  })

  it('orders the sets inside a day by set number, not by arrival', () => {
    const days = toTrainingDays(
      [
        set({ id: 'second', set_no: 2, reps: 10, weight: 70 }),
        set({ id: 'first', set_no: 1, reps: 12, weight: 60 }),
      ],
      'strength',
    )

    expect(days[0]!.sets.map((s) => s.id)).toEqual(['first', 'second'])
  })

  it('measures bodyweight exercises by reps, since there is no load to grow', () => {
    const days = toTrainingDays(
      [
        set({ id: 'a', performed_on: '2026-08-01', reps: 8 }),
        set({ id: 'b', performed_on: '2026-08-08', reps: 11 }),
      ],
      'strength',
    )

    expect(days[0]!.best).toBe(11)
  })

  it('reports no value for a day it cannot measure', () => {
    const days = toTrainingDays([set({ id: 'a', duration_s: 60 })], 'strength')

    expect(days[0]!.best).toBeNull()
  })

  it('measures time exercises by duration', () => {
    const days = toTrainingDays([set({ id: 'a', duration_s: 90, weight: 10 })], 'time')

    expect(days[0]!.best).toBe(90)
  })
})

describe('lastTrainingDay', () => {
  it('returns the most recent day', () => {
    const last = lastTrainingDay(
      [
        set({ id: 'old', performed_on: '2026-08-01', reps: 12, weight: 60 }),
        set({ id: 'new', performed_on: '2026-08-08', reps: 12, weight: 65 }),
      ],
      'strength',
    )

    expect(last?.date).toBe('2026-08-08')
  })

  it('returns nothing for an exercise that has never been trained', () => {
    expect(lastTrainingDay([], 'strength')).toBeNull()
  })
})

describe('personalRecordIds', () => {
  it('marks nothing on the first day — there is no old best to beat yet', () => {
    const records = personalRecordIds(
      [
        set({ id: 'a', set_no: 1, reps: 12, weight: 60 }),
        set({ id: 'b', set_no: 2, reps: 10, weight: 65 }),
        set({ id: 'c', set_no: 3, reps: 8, weight: 70 }),
      ],
      'strength',
    )

    expect([...records]).toEqual([])
  })

  it('marks a set that beats the best of every earlier day', () => {
    const records = personalRecordIds(
      [
        set({ id: 'a', performed_on: '2026-08-01', reps: 12, weight: 60 }),
        set({ id: 'b', performed_on: '2026-08-08', reps: 12, weight: 65 }),
        set({ id: 'c', performed_on: '2026-08-15', reps: 12, weight: 62.5 }),
      ],
      'strength',
    )

    // 65 beat 60; 62.5 did not beat 65
    expect([...records]).toEqual(['b'])
  })

  it('does not treat matching the old best as a record', () => {
    const records = personalRecordIds(
      [
        set({ id: 'a', performed_on: '2026-08-01', reps: 12, weight: 60 }),
        set({ id: 'b', performed_on: '2026-08-08', reps: 12, weight: 60 }),
      ],
      'strength',
    )

    expect([...records]).toEqual([])
  })

  it('marks every set of a day that clears the old best', () => {
    const records = personalRecordIds(
      [
        set({ id: 'old', performed_on: '2026-08-01', reps: 12, weight: 60 }),
        set({ id: 'a', performed_on: '2026-08-08', set_no: 1, reps: 12, weight: 62.5 }),
        set({ id: 'b', performed_on: '2026-08-08', set_no: 2, reps: 10, weight: 65 }),
      ],
      'strength',
    )

    expect([...records]).toEqual(['a', 'b'])
  })

  it('ignores sets it cannot measure', () => {
    const records = personalRecordIds(
      [
        set({ id: 'old', performed_on: '2026-08-01', reps: 5, weight: 40 }),
        set({ id: 'a', performed_on: '2026-08-08', duration_s: 60 }),
        set({ id: 'b', performed_on: '2026-08-08', reps: 5, weight: 45 }),
      ],
      'strength',
    )

    expect([...records]).toEqual(['b'])
  })
})
