export interface PitchPosition {
  x: number
  y: number
}

const NEAR_Y = 86
const FAR_Y = 46

function rowXs(count: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [50]
  if (count === 2) return [34, 66]
  if (count === 3) return [28, 50, 72]

  const left = 24
  const right = 76
  return Array.from(
    { length: count },
    (_unused, index) => left + (index * (right - left)) / (count - 1),
  )
}

function rowsAt(rowCounts: number[]): PitchPosition[] {
  const rowCount = rowCounts.length
  if (rowCount === 0) return []

  return rowCounts.flatMap((count, rowIndex) => {
    const y =
      rowCount === 1
        ? Math.round((NEAR_Y + FAR_Y) / 2)
        : Math.round(NEAR_Y - (rowIndex * (NEAR_Y - FAR_Y)) / (rowCount - 1))
    return rowXs(count).map((x) => ({ x, y }))
  })
}

/**
 * Places players on the near half of a portrait court.
 * x/y are percents (0–100). Higher y is closer to the viewer.
 */
export function getLineupPositions(count: number): PitchPosition[] {
  if (count <= 0) return []
  if (count === 1) return [{ x: 50, y: 72 }]
  if (count === 2)
    return [
      { x: 34, y: 72 },
      { x: 66, y: 72 },
    ]
  if (count === 3) {
    return [
      { x: 50, y: 82 },
      { x: 34, y: 62 },
      { x: 66, y: 62 },
    ]
  }
  if (count === 4) {
    return [
      { x: 50, y: 86 },
      { x: 34, y: 68 },
      { x: 66, y: 68 },
      { x: 50, y: 50 },
    ]
  }
  if (count === 5) {
    return [
      { x: 50, y: 88 },
      { x: 50, y: 72 },
      { x: 32, y: 58 },
      { x: 68, y: 58 },
      { x: 50, y: 44 },
    ]
  }
  if (count === 6) return rowsAt([1, 2, 2, 1])
  if (count === 7) return rowsAt([1, 2, 3, 1])

  const remaining = count - 1
  const fullRows = Math.floor(remaining / 3)
  const leftover = remaining % 3
  const rowCounts = [1, ...Array.from({ length: fullRows }, () => 3)]
  if (leftover > 0) rowCounts.push(leftover)
  return rowsAt(rowCounts)
}

export function getPlayerFirstName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) return name
  return trimmed.split(/\s+/)[0] ?? trimmed
}

export function getPlayerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const first = parts[0][0] ?? ''
  const last = parts[parts.length - 1][0] ?? ''
  return `${first}${last}`.toUpperCase()
}
