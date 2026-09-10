export type RecurrenceChoice = 'once' | 'weekly' | 'monthly_nth_weekday' | 'monthly'

export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const next = new Date(date)
  next.setHours(hours ?? 19, minutes ?? 0, 0, 0)
  return next
}

export function getNthWeekdayLabel(
  date: Date,
  t: (key: string, opts?: Record<string, unknown>) => string,
  keyPrefix: string,
): string {
  const nth = Math.floor((date.getDate() - 1) / 7) + 1
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long' })
  const ordinals = ['', '1ers', '2es', '3es', '4es', '5es']
  return t(`${keyPrefix}.everyNthWeekday`, {
    ordinal: ordinals[nth] ?? `${nth}es`,
    day,
  })
}

export function defaultNextMatchDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7))
  return d
}

export function timeFromDate(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = date.getMinutes() >= 30 ? '30' : '00'
  return `${h}:${m}`
}
