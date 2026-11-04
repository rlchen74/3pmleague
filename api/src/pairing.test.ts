import { describe, it, expect } from 'vitest'
import { suggestTables } from './pairing.js'

const free = (ids: number[], days: string[]) =>
  Object.fromEntries(ids.map((i) => [i, days]))

describe('suggestTables', () => {
  it('seats 8 free players at two tables', () => {
    const r = suggestTables({
      days: free([1, 2, 3, 4, 5, 6, 7, 8], ['2026-11-12']),
      gamesPlayed: {},
      met: {},
    })
    expect(r.tables).toHaveLength(2)
    expect(new Set(r.tables.flatMap((t) => t.players)).size).toBe(8)
  })

  it('never seats players who have already met', () => {
    const r = suggestTables({
      days: free([1, 2, 3, 4], ['2026-11-12']),
      gamesPlayed: {},
      met: { 1: [2], 2: [1] },
    })
    expect(r.tables).toHaveLength(0)
    expect(r.unplaced).toHaveLength(4)
  })

  it('leaves out the player with the most games when one must sit', () => {
    const r = suggestTables({
      days: free([1, 2, 3, 4, 5], ['2026-11-12']),
      gamesPlayed: { 1: 4, 2: 3, 3: 2, 4: 1, 5: 0 },
      met: {},
    })
    expect(r.tables[0].players).not.toContain(1)
    expect(r.unplaced.map((u) => u.playerId)).toEqual([1])
  })

  it('ignores players who already have 5 games', () => {
    const r = suggestTables({
      days: free([1, 2, 3, 4, 5], ['2026-11-12']),
      gamesPlayed: { 5: 5 },
      met: {},
    })
    expect(r.tables[0].players).not.toContain(5)
    expect(r.unplaced).toHaveLength(0)
  })
})