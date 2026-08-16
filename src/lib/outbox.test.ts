import { describe, expect, it } from 'vitest'
import { flush, loadQueue, saveQueue } from './outbox'
import type { Op, Outcome } from './outbox'

const op = (opId: string): Op => ({
  opId,
  kind: 'set.delete',
  id: `set-${opId}`,
})

/** Records what was attempted, answers from a scripted list of outcomes. */
function executor(outcomes: Outcome[]) {
  const attempted: string[] = []
  let i = 0
  return {
    attempted,
    perform: async (o: Op) => {
      attempted.push(o.opId)
      return outcomes[i++] ?? 'done'
    },
  }
}

describe('flush', () => {
  it('empties the queue when every write reaches the server', async () => {
    const { perform, attempted } = executor(['done', 'done', 'done'])

    const { remaining, dropped } = await flush([op('a'), op('b'), op('c')], perform)

    expect(attempted).toEqual(['a', 'b', 'c'])
    expect(remaining).toEqual([])
    expect(dropped).toEqual([])
  })

  it('stops at the first unreachable write and keeps the rest in order', async () => {
    const { perform, attempted } = executor(['done', 'retry'])

    const { remaining } = await flush([op('a'), op('b'), op('c')], perform)

    // 'c' must not overtake 'b' — it may depend on it
    expect(attempted).toEqual(['a', 'b'])
    expect(remaining.map((o) => o.opId)).toEqual(['b', 'c'])
  })

  it('drops a permanently rejected write instead of looping on it forever', async () => {
    const { perform, attempted } = executor(['drop', 'done'])

    const { remaining, dropped } = await flush([op('a'), op('b')], perform)

    expect(attempted).toEqual(['a', 'b'])
    expect(remaining).toEqual([])
    expect(dropped.map((o) => o.opId)).toEqual(['a'])
  })

  it('leaves an empty queue alone', async () => {
    const { perform, attempted } = executor([])

    const { remaining } = await flush([], perform)

    expect(attempted).toEqual([])
    expect(remaining).toEqual([])
  })
})

function fakeStorage(initial?: string): Storage {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set('workout.outbox.v1', initial)
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size
    },
  } as Storage
}

describe('queue persistence', () => {
  it('survives a round trip', () => {
    const storage = fakeStorage()
    saveQueue([op('a')], storage)

    expect(loadQueue(storage).map((o) => o.opId)).toEqual(['a'])
  })

  it('returns an empty queue rather than throwing on corrupt storage', () => {
    expect(loadQueue(fakeStorage('{not json'))).toEqual([])
    expect(loadQueue(fakeStorage('"a string"'))).toEqual([])
    expect(loadQueue(fakeStorage())).toEqual([])
  })
})
