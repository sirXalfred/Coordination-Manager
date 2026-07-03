import { useState, useEffect } from 'react'

const CALENDAR_HASH = '6tK6wGjFRg'
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.coordinationmanager.com'

interface Meeting {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  duration_minutes: number | null
  meeting_link: string | null
}

function formatDateUTC(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function formatTimeUTC(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

export function WorkshopsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/meetings/${CALENDAR_HASH}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load meetings')
        return res.json()
      })
      .then((data: Meeting[]) => {
        const now = new Date()
        const upcoming = data.filter(m => new Date(m.end_time) > now)
        setMeetings(upcoming)
      })
      .catch(() => setError('Could not load upcoming sessions.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="prose-docs">
      <h1>Workshops</h1>
      <p className="text-lg text-gray-400 mb-8">
        We're in the early stages of building Coordination Manager together. From time to time
        we'll organise a coordination meeting to align on next steps for the platform.
      </p>

      <h2>Active Coordination Calendar</h2>
      <p>
        We have an active coordination calendar where you can find upcoming meetings,
        submit your availability, and stay in sync with the community:
      </p>

      <div className="not-prose mb-6">
        <a
          href={`https://coordinationmanager.com/calendar/${CALENDAR_HASH}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-surface-700 bg-surface-850 hover:bg-surface-800 transition-colors"
        >
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-sm font-medium text-accent-400 hover:text-accent-300">
            coordinationmanager.com/calendar/{CALENDAR_HASH}
          </span>
        </a>
      </div>

      <h2>Upcoming Sessions</h2>

      {loading && (
        <div className="not-prose flex items-center gap-2 text-gray-400 text-sm py-4">
          <span className="inline-block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          Loading upcoming sessions...
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {!loading && !error && meetings.length === 0 && (
        <p className="text-gray-400 text-sm">
          No upcoming sessions scheduled right now. Check back soon or visit the calendar above.
        </p>
      )}

      {!loading && !error && meetings.length > 0 && (
        <div className="not-prose space-y-3 mb-8">
          {meetings.map(m => (
            <div
              key={m.id}
              className="rounded-lg border border-surface-700 bg-surface-850 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">{m.title}</h3>
                  <p className="text-sm text-gray-400">
                    {formatDateUTC(m.start_time)} &middot;{' '}
                    {formatTimeUTC(m.start_time)} &ndash; {formatTimeUTC(m.end_time)} UTC
                    {m.duration_minutes ? ` (${m.duration_minutes} min)` : ''}
                  </p>
                  {m.description && (
                    <p className="text-xs text-gray-500 mt-1">{m.description}</p>
                  )}
                </div>
                <a
                  href={`https://coordinationmanager.com/meeting/${m.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border border-accent-500 text-accent-400 hover:bg-accent-500/10 transition-colors"
                >
                  View &amp; Join
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Get Involved</h2>
      <p>
        These meetings are open to anyone interested in shaping the platform — whether you're a
        developer, coordinator, or simply curious. Join a meeting to share ideas, ask questions,
        or volunteer to work on a feature.
      </p>
    </div>
  )
}
