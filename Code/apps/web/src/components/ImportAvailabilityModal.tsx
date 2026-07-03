import { useState, useEffect } from 'react'
import { X, Loader2, Calendar, Clock } from 'lucide-react'
import { apiClient } from '../lib/api-client'

interface PastAvailabilityEntry {
  calendar_id: string
  calendar_hash: string
  calendar_title: string
  username: string
  time_slots: string[]
  date_range: string
  entry_count: number
  updated_at: string
}

interface ImportAvailabilityModalProps {
  open: boolean
  onClose: () => void
  onImport: (timeSlots: string[], username: string) => void
  currentCalendarHash: string
  /** Monday of the currently displayed week */
  currentWeekStart: Date
  /** Calendar's custom start date (yyyy-MM-dd) if set */
  customStartDate?: string
  /** Calendar's custom end date (yyyy-MM-dd) if set */
  customEndDate?: string
}

/** Format "YYYY-MM-DD" to { dd, mm, yy } */
function parseDateParts(iso: string): { dd: string; mm: string; yy: string } {
  const [y, m, d] = iso.split('-')
  return { dd: d, mm: m, yy: y.slice(2) }
}

/** Format date range as dd.mm-dd.mm.yy or dd-dd.mm.yy (dd.mm.yy) */
function formatDateRange(minDate: string, maxDate: string): string {
  if (!minDate || !maxDate) return 'N/A'
  const from = parseDateParts(minDate)
  const to = parseDateParts(maxDate)

  if (minDate === maxDate) {
    return `${from.dd}.${from.mm}.${from.yy}`
  }
  if (from.mm === to.mm && from.yy === to.yy) {
    // Same month: dd-dd.mm.yy
    return `${from.dd}-${to.dd}.${to.mm}.${to.yy}`
  }
  // Different months: dd.mm-dd.mm.yy
  return `${from.dd}.${from.mm}-${to.dd}.${to.mm}.${to.yy}`
}

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Get weekday label for a date range, e.g. "Mon" or "Mon - Fri" */
function formatWeekdayRange(minDate: string, maxDate: string): string {
  if (!minDate) return ''
  const fromDay = SHORT_WEEKDAYS[new Date(minDate + 'T00:00:00').getDay()]
  if (!maxDate || minDate === maxDate) return fromDay
  const toDay = SHORT_WEEKDAYS[new Date(maxDate + 'T00:00:00').getDay()]
  if (fromDay === toDay) return fromDay
  return `${fromDay} - ${toDay}`
}

export default function ImportAvailabilityModal({
  open,
  onClose,
  onImport,
  currentCalendarHash,
  currentWeekStart,
  customStartDate,
  customEndDate,
}: ImportAvailabilityModalProps) {
  const [entries, setEntries] = useState<PastAvailabilityEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    apiClient
      .get(`/api/availability/user/past?exclude_hash=${encodeURIComponent(currentCalendarHash)}`)
      .then(res => {
        setEntries(res.data.entries || [])
      })
      .catch(() => {
        setError('Failed to load past availability')
      })
      .finally(() => setLoading(false))
  }, [open, currentCalendarHash])

  /** Map imported slots to the current calendar's week(s) by day-of-week + time */
  const handleRowClick = (entry: PastAvailabilityEntry) => {
    const slots = entry.time_slots
    if (!slots || slots.length === 0) return

    // Determine the source availability's first Monday (week start)
    // Slot format: "YYYY-MM-DD_HH:mm"
    const sourceDates = slots.map(s => s.split('_')[0]).sort()
    const firstSourceDate = new Date(sourceDates[0] + 'T00:00:00')
    // Find the Monday of the first source date's week
    const sourceDay = firstSourceDate.getDay() // 0=Sun
    const sourceMonday = new Date(firstSourceDate)
    sourceMonday.setDate(sourceMonday.getDate() - ((sourceDay + 6) % 7))

    // Calculate how many weeks the current calendar spans
    let calendarWeeks = 1
    if (customStartDate && customEndDate) {
      const calStart = new Date(customStartDate + 'T00:00:00')
      const calEnd = new Date(customEndDate + 'T00:00:00')
      const calStartDay = calStart.getDay()
      const calMonday = new Date(calStart)
      calMonday.setDate(calMonday.getDate() - ((calStartDay + 6) % 7))
      const diffDays = Math.floor((calEnd.getTime() - calMonday.getTime()) / (1000 * 60 * 60 * 24))
      calendarWeeks = Math.max(1, Math.floor(diffDays / 7) + 1)
    }

    // Map each source slot to the target calendar week
    const targetMonday = currentWeekStart
    const mappedSlots: string[] = []

    for (const slot of slots) {
      const [dateStr, timeStr] = slot.split('_')
      const slotDate = new Date(dateStr + 'T00:00:00')

      // Calculate which week offset and day-of-week this slot is from the source start
      const daysSinceSourceMonday = Math.floor(
        (slotDate.getTime() - sourceMonday.getTime()) / (1000 * 60 * 60 * 24)
      )
      const weekOffset = Math.floor(daysSinceSourceMonday / 7)
      const dayOfWeek = ((daysSinceSourceMonday % 7) + 7) % 7 // 0=Mon, 6=Sun

      // Only include if this week offset is within the calendar's range
      if (weekOffset >= calendarWeeks) continue

      // Calculate the target date
      const targetDate = new Date(targetMonday)
      targetDate.setDate(targetDate.getDate() + weekOffset * 7 + dayOfWeek)

      // Format as YYYY-MM-DD_HH:mm
      const yyyy = targetDate.getFullYear()
      const mmStr = String(targetDate.getMonth() + 1).padStart(2, '0')
      const ddStr = String(targetDate.getDate()).padStart(2, '0')
      mappedSlots.push(`${yyyy}-${mmStr}-${ddStr}_${timeStr}`)
    }

    onImport(mappedSlots, entry.username)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-card text-card-foreground rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl border border-border max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            Import Availability
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-1">
          Select a previous calendar to import your availability as the current selection.
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Date format: (dd.mm.yy)
        </p>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 py-4 text-center">{error}</div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No past availability found in other calendars.
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="overflow-y-auto flex-1 -ml-2">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left">
                  <th className="px-2 py-2 font-medium text-muted-foreground">Date Range</th>
                  <th className="px-2 py-2 font-medium text-muted-foreground">Calendar</th>
                  <th className="px-2 pr-4 py-2 font-medium text-muted-foreground text-right">Entries</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  // Compute formatted date range from raw min/max dates
                  const dates = entry.time_slots.map(s => s.split('_')[0]).sort()
                  const minDate = dates[0] || ''
                  const maxDate = dates[dates.length - 1] || ''
                  const displayRange = formatDateRange(minDate, maxDate)
                  const weekdayLabel = formatWeekdayRange(minDate, maxDate)

                  return (
                    <tr
                      key={`${entry.calendar_id}-${entry.username}-${idx}`}
                      onClick={() => handleRowClick(entry)}
                      className="border-b border-border/50 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                    >
                      <td className="px-2 py-2.5 whitespace-nowrap text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          {displayRange}
                        </div>
                        {weekdayLabel && (
                          <div className="text-xs text-muted-foreground ml-5">{weekdayLabel}</div>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-foreground">
                        <div className="truncate max-w-[280px]" title={entry.calendar_title}>
                          {entry.calendar_title}
                        </div>
                        <div className="text-xs text-muted-foreground">as {entry.username}</div>
                      </td>
                      <td className="px-2 pr-4 py-2.5 text-right font-medium text-foreground">
                        {entry.entry_count}h
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
