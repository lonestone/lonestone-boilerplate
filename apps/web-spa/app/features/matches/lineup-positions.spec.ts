import { describe, expect, it } from 'vitest'
import { getLineupPositions, getPlayerFirstName, getPlayerInitials } from './lineup-positions'
import type { PitchPosition } from './lineup-positions'

function rowCountsFromBottom(positions: PitchPosition[]): number[] {
  const byY = new Map<number, number>()
  for (const position of positions) {
    byY.set(position.y, (byY.get(position.y) ?? 0) + 1)
  }
  return [...byY.entries()].sort((left, right) => right[0] - left[0]).map(([, count]) => count)
}

describe('getLineupPositions', () => {
  it('returns no spots when there are no players', () => {
    expect(getLineupPositions(0)).toEqual([])
    expect(getLineupPositions(-1)).toEqual([])
  })

  it('places one player in the center', () => {
    const actual = getLineupPositions(1)
    expect(actual).toHaveLength(1)
    expect(actual[0].x).toBe(50)
  })

  it('places two players side by side', () => {
    const actual = getLineupPositions(2)
    expect(actual).toHaveLength(2)
    expect(actual[0].y).toBe(actual[1].y)
    expect(actual[0].x).toBeLessThan(actual[1].x)
  })

  it('places three players in a triangle: one at the back, two above', () => {
    expect(rowCountsFromBottom(getLineupPositions(3))).toEqual([1, 2])
  })

  it('places four players in a 1-2-1 diamond', () => {
    expect(rowCountsFromBottom(getLineupPositions(4))).toEqual([1, 2, 1])
  })

  it('places five players with one at the back and a diamond above', () => {
    expect(rowCountsFromBottom(getLineupPositions(5))).toEqual([1, 1, 2, 1])
  })

  it('places six players as 1-2-2-1', () => {
    expect(rowCountsFromBottom(getLineupPositions(6))).toEqual([1, 2, 2, 1])
  })

  it('places seven players as 1-2-3-1', () => {
    expect(rowCountsFromBottom(getLineupPositions(7))).toEqual([1, 2, 3, 1])
  })

  it('places eight or more with one at the back then rows of three', () => {
    expect(rowCountsFromBottom(getLineupPositions(8))).toEqual([1, 3, 3, 1])
    expect(rowCountsFromBottom(getLineupPositions(9))).toEqual([1, 3, 3, 2])
    expect(rowCountsFromBottom(getLineupPositions(10))).toEqual([1, 3, 3, 3])
  })

  it('returns one position per player inside the court', () => {
    for (const count of [1, 4, 5, 11, 14]) {
      const actual = getLineupPositions(count)
      expect(actual).toHaveLength(count)
      for (const position of actual) {
        expect(position.x).toBeGreaterThanOrEqual(0)
        expect(position.x).toBeLessThanOrEqual(100)
        expect(position.y).toBeGreaterThanOrEqual(0)
        expect(position.y).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('player labels', () => {
  it('uses the first word as the first name', () => {
    expect(getPlayerFirstName('Alex Dupont')).toBe('Alex')
    expect(getPlayerFirstName('Pierre')).toBe('Pierre')
  })

  it('builds initials from first and last words', () => {
    expect(getPlayerInitials('Alex Dupont')).toBe('AD')
    expect(getPlayerInitials('Ian')).toBe('IA')
    expect(getPlayerInitials('')).toBe('?')
  })
})
