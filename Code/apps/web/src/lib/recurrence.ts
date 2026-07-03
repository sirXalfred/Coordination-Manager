export type RecurrenceType = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
export type RecurrenceUnit = 'day' | 'week' | 'month'
export type RecurrenceEndType = 'never' | 'on' | 'after'

export interface RecurrenceRule {
  type: RecurrenceType
  interval?: number
  unit?: RecurrenceUnit
  weekDays?: number[]
  endType?: RecurrenceEndType
  endDate?: string
  endCount?: number
  exceptions?: string[]
}

export function getWeekdayIndexFromIsoDate(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00Z`)
  const jsDay = d.getUTCDay() // 0=Sun..6=Sat
  return jsDay === 0 ? 6 : jsDay - 1 // 0=Mon..6=Sun
}

export function getWeekdayIndexFromDate(date: Date): number {
  const jsDay = date.getDay() // 0=Sun..6=Sat
  return jsDay === 0 ? 6 : jsDay - 1 // 0=Mon..6=Sun
}