import { describe, it, expect } from 'vitest'
import { suggestTables, suggestForPlayer } from './pairing.js'

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

describe('suggestForPlayer', () => {
  const day = '2026-11-12'

  it('only offers free opponents the viewer has not faced', () => {
    const r = suggestForPlayer({
      viewerId: 1,
      days: free([1, 2, 3, 4, 5], [day]),
      gamesPlayed: {},
      met: { 1: [2], 2: [1] },
    })
    expect(r.options).toEqual([{ day, opponents: [3, 4, 5] }])
  })

  it('never seats two opponents who have already met', () => {
    const r = suggestForPlayer({
      viewerId: 1,
      days: free([1, 2, 3, 4, 5, 6], [day]),
      gamesPlayed: {},
      met: { 3: [4], 4: [3] },
    })
    expect(r.options.length).toBeGreaterThan(0)
    expect(r.options.every((o) => !(o.opponents.includes(3) && o.opponents.includes(4)))).toBe(true)
  })

  it('says so when the viewer has finished their games', () => {
    const r = suggestForPlayer({
      viewerId: 1,
      days: free([1, 2, 3, 4], [day]),
      gamesPlayed: { 1: 5 },
      met: {},
    })
    expect(r.options).toHaveLength(0)
    expect(r.reason).toContain('already')
  })
    it('offers up to 3 tables with completely different opponents', () => {
    const r = suggestForPlayer({
      viewerId: 1,
      days: free([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], [day]),
      gamesPlayed: {},
      met: {},
      seed: 7,
    })
    expect(r.options).toHaveLength(3)
    const everyone = r.options.flatMap((o) => o.opponents)
    expect(new Set(everyone).size).toBe(9)
  })

  it('offers fewer tables when there are not enough people left', () => {
    const r = suggestForPlayer({
      viewerId: 1,
      days: free([1, 2, 3, 4, 5, 6, 7, 8], [day]),
      gamesPlayed: {},
      met: {},
      seed: 7,
    })
    expect(r.options).toHaveLength(2)
  })

  it('gives the same suggestions for the same seed', () => {
    const input = {
      viewerId: 1,
      days: free([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [day]),
      gamesPlayed: {},
      met: {},
      seed: 42,
    }
    expect(suggestForPlayer(input)).toEqual(suggestForPlayer(input))
  })
})