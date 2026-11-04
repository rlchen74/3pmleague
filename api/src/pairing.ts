export const TARGET_GAMES = 5
const NODE_LIMIT = 300_000

export interface PairingInput {
  days: Record<number, string[]> // playerId -> free days this week
  gamesPlayed: Record<number, number> // counting games so far
  met: Record<number, number[]> // playerId -> opponents already faced
  target?: number
}
export interface Table {
  day: string
  players: number[]
}
export interface PairingResult {
  tables: Table[]
  unplaced: { playerId: number; reason: string }[]
  searchComplete: boolean
}

type Candidate = { day: string; members: number[] } // members are indexes into `eligible`

export function suggestTables(input: PairingInput): PairingResult {
  const target = input.target ?? TARGET_GAMES
  const gp = (p: number) => input.gamesPlayed[p] ?? 0
  const haveMet = (a: number, b: number) => input.met[a]?.includes(b) ?? false

  const needGames = Object.keys(input.days).map(Number).filter((p) => gp(p) < target)

  // Most-behind players first, then the most constrained (fewest free days)
  const eligible = needGames
    .filter((p) => input.days[p].length > 0)
    .sort(
      (a, b) =>
        gp(a) - gp(b) || input.days[a].length - input.days[b].length || a - b,
    )
  const weight = eligible.map((p) => target - gp(p))

  // Step 1: list every valid table, filed under its lowest-numbered member
  const lowest: Candidate[][] = eligible.map(() => [])
  const allDays = [...new Set(eligible.flatMap((p) => input.days[p]))].sort()
  for (const day of allDays) {
    const free = eligible
      .map((_, i) => i)
      .filter((i) => input.days[eligible[i]].includes(day))
    const chosen: number[] = []
    const pick = (start: number): void => {
      if (chosen.length === 4) {
        lowest[chosen[0]].push({ day, members: [...chosen] })
        return
      }
      for (let k = start; k < free.length; k++) {
        const c = free[k]
        if (chosen.every((m) => !haveMet(eligible[m], eligible[c]))) {
          chosen.push(c)
          pick(k + 1)
          chosen.pop()
        }
      }
    }
    pick(0)
  }

  // Step 2: backtracking search for the best set of non-overlapping tables
  const suffix = new Array<number>(eligible.length + 1).fill(0)
  for (let i = eligible.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + weight[i]

  const used = new Array<boolean>(eligible.length).fill(false)
  const current: Candidate[] = []
  let best: Candidate[] = []
  let bestScore = 0
  let nodes = 0
  let searchComplete = true

  const go = (i: number, score: number): void => {
    if (nodes++ > NODE_LIMIT) {
      searchComplete = false
      return
    }
    if (score > bestScore) {
      bestScore = score
      best = [...current]
    }
    // Stop if even seating everyone left couldn't beat the best so far
    if (i >= eligible.length || score + suffix[i] <= bestScore) return
    if (used[i]) {
      go(i + 1, score)
      return
    }
    for (const t of lowest[i]) {
      if (t.members.some((m) => used[m])) continue
      t.members.forEach((m) => (used[m] = true))
      current.push(t)
      go(i + 1, score + t.members.reduce((s, m) => s + weight[m], 0))
      current.pop()
      t.members.forEach((m) => (used[m] = false))
    }
    go(i + 1, score) // option: this player sits out this week
  }
  go(0, 0)

  const tables: Table[] = best
    .map((t) => ({ day: t.day, players: t.members.map((m) => eligible[m]) }))
    .sort((a, b) => a.day.localeCompare(b.day))

  const seated = new Set(tables.flatMap((t) => t.players))
  const unplaced = needGames
    .filter((p) => !seated.has(p))
    .map((p) => ({
      playerId: p,
      reason:
        input.days[p].length === 0
          ? 'No availability marked this week'
          : 'No open table: needs 3 other free players they have not faced on the same day',
    }))

  return { tables, unplaced, searchComplete }
}