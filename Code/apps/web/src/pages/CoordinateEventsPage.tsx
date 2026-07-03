import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { format, startOfWeek, addDays, addWeeks, subWeeks, addMonths, isSameDay, parse } from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar, Plus, Trash2, X, Download, Eye, EyeOff, Check, ExternalLink, Loader2, Search, Bell, BellOff, Network, CalendarPlus, Copy, RefreshCw, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { apiClient } from '../lib/api-client'
import { useAuth } from '../contexts/AuthContext'
import { computeDayLayout } from '../lib/calendarOverlapLayout'
import TimezoneSelector from '../components/TimezoneSelector'
import { LeftPanelPortal } from '../contexts/LayoutContext'
import { useTimezones } from '../lib/use-timezones'
import { findTimezone, convertUtcTimeToTimezone, convertUtcTimeToTimezoneOnDate, getCurrentTimeInTimezone, detectDstTransitions, type DstTransition } from '../lib/timezone-data'

/** Strip HTML tags from text and render URLs as clickable links with copy buttons */
function LinkifyText({ text }: { text: string }) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const stripped = text.replace(/<[^>]*>/g, '')
  const parts = stripped.split(/(https?:\/\/[^\s]+)/g)
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <span key={i} className="inline-flex items-center gap-1">
            <a href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{part}</a>
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(part); setCopiedUrl(part); setTimeout(() => setCopiedUrl(null), 2000) }}
              className="inline-flex p-0.5 rounded hover:bg-muted transition-colors shrink-0 align-middle"
              title="Copy link"
            >
              {copiedUrl === part ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}
import { downloadICSFile, buildOutlookCalendarUrl, isSafeUrl } from '../lib/calendar-utils'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

const SLOT_HEIGHT = 48

// ─── Types ──────────────────────────────────────────────────

type UserEvent = {
  id: string
  user_id: string
  source_type: 'manual' | 'google_oauth' | 'google_public_url' | 'coordination_calendar'
  source_id: string | null
  external_event_id: string | null
  title: string
  description: string | null
  meeting_link: string | null
  location: string | null
  start_time: string
  end_time: string
  is_public: boolean
  created_at: string
  updated_at: string
}

type CalendarSource = {
  id: string
  source_type: 'google_oauth' | 'google_public_url'
  google_email: string | null
  public_url: string | null
  display_name: string
  color: string
  is_active: boolean
}

type TimeInterval = 30 | 60

type SubscribedMeeting = {
  id: string
  calendar_id: string
  calendar_hash: string
  calendar_title: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  duration_minutes: number
  meeting_link: string | null
  created_at: string
  source_type: 'subscription'
}

type Subscription = {
  id: string
  calendar_id: string
  created_at: string
  calendars: { id: string; hash: string; title: string; visibility: string } | null
}

type ImportSyncMode = 'once' | 'range' | 'indefinite'

type SourceSyncPreference = {
  mode: Exclude<ImportSyncMode, 'once'>
  rangeMonths: number
}

type PublishOptions = {
  autoSync: boolean
  autoPublishNew: boolean
}

type EventGroupIdentity = {
  title: string
  meetingLink: string
  location: string
  day: string
}

type SourceSyncMeta = {
  lastSyncedAt?: string
  updatedAt?: string
  lastSyncError?: string
}

type NetworkFilterMode = 'pinned' | 'focus' | 'hidden'
type StoredNetworkFilterMode = NetworkFilterMode | 'all'

const SOURCE_SYNC_PREFS_KEY = 'coordinateEventsSourceSyncPrefs'
const SOURCE_AUTO_PUBLISH_PREFS_KEY = 'coordinateEventsSourceAutoPublishPrefs'
const NETWORK_FILTER_MODES_KEY = 'coordinateEventsNetworkFilterModes'
const MAIN_NETWORK_LABEL = 'Secret Swarm'
const MAIN_CALENDAR_MODE_LABEL = 'Main'
const MAIN_CALENDAR_DATA_CONTROLLER_LABEL = 'Volatire Swarm as data controller'

const normalizeIdentityField = (value: string | null | undefined): string =>
  (value || '').trim().toLowerCase()

const getEventDayKey = (startTime: string): string => startTime.slice(0, 10)

const getEventGroupIdentity = (ev: UserEvent): EventGroupIdentity => ({
  title: normalizeIdentityField(ev.title),
  meetingLink: normalizeIdentityField(ev.meeting_link),
  location: normalizeIdentityField(ev.location),
  day: getEventDayKey(ev.start_time),
})

const buildEventGroupKey = (ev: UserEvent): string => {
  const identity = getEventGroupIdentity(ev)
  return `${identity.title}|${identity.meetingLink}|${identity.location}|${identity.day}`
}

const getEventSyncPriorityTime = (ev: UserEvent): number => {
  const updatedAtTs = new Date(ev.updated_at).getTime()
  if (Number.isFinite(updatedAtTs)) return updatedAtTs
  const createdAtTs = new Date(ev.created_at).getTime()
  if (Number.isFinite(createdAtTs)) return createdAtTs
  const startTs = new Date(ev.start_time).getTime()
  return Number.isFinite(startTs) ? startTs : 0
}

const loadStoredNetworkFilterModes = (): Record<string, NetworkFilterMode> => {
  const defaults: Record<string, NetworkFilterMode> = {
    [MAIN_NETWORK_LABEL]: 'hidden',
  }

  if (typeof window === 'undefined') return defaults

  try {
    const raw = localStorage.getItem(NETWORK_FILTER_MODES_KEY)
    if (!raw) return defaults

    const parsed = JSON.parse(raw) as Record<string, StoredNetworkFilterMode>
    if (!parsed || typeof parsed !== 'object') return defaults

    const next: Record<string, NetworkFilterMode> = {}
    for (const [name, mode] of Object.entries(parsed)) {
      if (mode === 'pinned' || mode === 'focus' || mode === 'hidden') {
        next[name] = mode
      }
    }

    if (!(MAIN_NETWORK_LABEL in parsed)) {
      next[MAIN_NETWORK_LABEL] = 'hidden'
    }

    return next
  } catch {
    return defaults
  }
}

const serializeNetworkFilterModes = (modes: Record<string, NetworkFilterMode>): Record<string, StoredNetworkFilterMode> => {
  const serialized: Record<string, StoredNetworkFilterMode> = {}

  for (const [name, mode] of Object.entries(modes)) {
    serialized[name] = mode
  }

  // Persist explicit "All" override for Secret Swarm if user un-hides it.
  if (!(MAIN_NETWORK_LABEL in modes)) {
    serialized[MAIN_NETWORK_LABEL] = 'all'
  }

  return serialized
}

// ─── Component ──────────────────────────────────────────────

export default function CoordinateEventsPage() {
    // Confirm dialog state
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmTitle, setConfirmTitle] = useState('Are you sure?');
    const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);
  const { user, isAuthenticated } = useAuth()
  const { showToast } = useToast()

  // Calendar grid state
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [timeInterval] = useState<TimeInterval>(60)
  const [startHour] = useState(0)
  const [endHour] = useState(24)

  // Events state
  const [events, setEvents] = useState<UserEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)

  // Calendar sources state
  const [calendarSources, setCalendarSources] = useState<CalendarSource[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importType, setImportType] = useState<'calendar_source' | 'coordination_calendar' | null>(null)
  const [importSourceId, setImportSourceId] = useState('')
  const [importCalendarHash, setImportCalendarHash] = useState('')
  const [importMonths, setImportMonths] = useState(3) // How many months ahead to import
  const [importSyncMode, setImportSyncMode] = useState<ImportSyncMode>('once')
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [sourceSyncPrefs, setSourceSyncPrefs] = useState<Record<string, SourceSyncPreference>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = localStorage.getItem(SOURCE_SYNC_PREFS_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, SourceSyncPreference>
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  })
  const [sourceAutoPublishPrefs, setSourceAutoPublishPrefs] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = localStorage.getItem(SOURCE_AUTO_PUBLISH_PREFS_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, boolean>
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  })
  const [sourceSyncMeta, setSourceSyncMeta] = useState<Record<string, SourceSyncMeta>>({})
  const [syncPrefsHydrated, setSyncPrefsHydrated] = useState(false)

  // Create event modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    meeting_link: '',
    location: '',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '10:00',
    is_public: false,
  })

  // Selected event for details
  type GridItem = { kind: 'event'; data: UserEvent } | { kind: 'sub'; data: SubscribedMeeting }
  const [selectedEvent, setSelectedEvent] = useState<UserEvent | null>(null)
  const [selectedSubMeeting, setSelectedSubMeeting] = useState<SubscribedMeeting | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [overflowPanelItems, setOverflowPanelItems] = useState<GridItem[] | null>(null)

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [subscribedMeetings, setSubscribedMeetings] = useState<SubscribedMeeting[]>([])

  // Search for coordination calendars
  const [coordCalendars, setCoordCalendars] = useState<Array<{ hash: string; title: string; visibility?: string }>>([])
  const [coordSearch, setCoordSearch] = useState('')

  // Google Calendar sync state
  const [syncingToGoogle, setSyncingToGoogle] = useState(false)
  const [showGoogleSyncPicker, setShowGoogleSyncPicker] = useState<{ title: string; description?: string | null; start_time: string; end_time: string; meeting_link?: string | null; location?: string | null } | null>(null)
  const [selectedSyncSourceIds, setSelectedSyncSourceIds] = useState<Set<string>>(new Set())
  const [isAutoSyncing, setIsAutoSyncing] = useState(false)
  const [lastAutoSyncAt, setLastAutoSyncAt] = useState<string | null>(null)
  const [autoSyncSummary, setAutoSyncSummary] = useState<string>('')
  const [showEventSourceNetworks, setShowEventSourceNetworks] = useState(false)
  const autoSyncInFlightRef = useRef(false)

  const googleOAuthSources = useMemo(
    () => calendarSources.filter(s => s.source_type === 'google_oauth' && s.is_active),
    [calendarSources]
  )

  const handleSyncToGoogle = async (event: { title: string; description?: string | null; start_time: string; end_time: string; meeting_link?: string | null; location?: string | null }, targetIds?: string[]) => {
    const ids = targetIds || (googleOAuthSources.length === 1 ? [googleOAuthSources[0].id] : [])
    if (ids.length === 0) return

    setSyncingToGoogle(true)
    try {
      const res = await apiClient.post('/api/calendar-sources/add-event', {
        event: {
          title: event.title,
          description: event.description || undefined,
          start_time: event.start_time,
          end_time: event.end_time,
          meeting_link: event.meeting_link || undefined,
          location: event.location || undefined,
        },
        targetSourceIds: ids,
      })
      const { succeeded, failed } = res.data
      if (failed > 0) {
        showToast(`Added to ${succeeded} calendar(s), ${failed} failed.`, 'error')
      } else {
        showToast(`Added to ${succeeded} Google Calendar(s)!`)
      }
      setShowGoogleSyncPicker(null)
      setSelectedSyncSourceIds(new Set())
    } catch (err) {
      showToast((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to add event to Google Calendar.', 'error')
    } finally {
      setSyncingToGoogle(false)
    }
  }

  // Grid area drag-selection
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<string | null>(null)

  // Collapsible section states
  const [_bulkExpanded, _setBulkExpanded] = useState(false)
  const [isLeftToolsPanelOpen, setIsLeftToolsPanelOpen] = useState(false)
  const [networksExpanded, setNetworksExpanded] = useState(true)
  const [followingExpanded, setFollowingExpanded] = useState(true)
  const [sidePanelPublishAutoSync, setSidePanelPublishAutoSync] = useState(true)
  const [sidePanelPublishAutoPublishNew, setSidePanelPublishAutoPublishNew] = useState(false)

  // Network card filtering
  const [networkFilterModes, setNetworkFilterModes] = useState<Record<string, NetworkFilterMode>>(loadStoredNetworkFilterModes)
  const [publishSelectedNetworks, setPublishSelectedNetworks] = useState<Set<string>>(new Set())

  const getNetworkLabel = useCallback((sourceType: UserEvent['source_type'] | 'sub', sourceId: string | null | undefined, fallbackName?: string) => {
    if (sourceType === 'manual') return MAIN_NETWORK_LABEL
    if (sourceType === 'coordination_calendar') return sourceId ? `Coordination: ${sourceId}` : 'Coordination Calendar'
    if (sourceType === 'sub') return fallbackName || 'Subscription'
    return calendarSources.find(source => source.id === sourceId)?.display_name || sourceId || 'Calendar'
  }, [calendarSources])

  const isNetworkVisibleByName = useCallback((name: string) => {
    const mode = networkFilterModes[name]
    if (mode === 'hidden') return false
    const hasFocusedNetworks = Object.values(networkFilterModes).includes('focus')
    if (hasFocusedNetworks) return mode === 'focus' || mode === 'pinned'
    return true
  }, [networkFilterModes])

  // Current time state for red line and UTC clock
  const [currentTime, setCurrentTime] = useState(new Date())
  const [utcNow, setUtcNow] = useState(() => new Date())
  const tzState = useTimezones()

  // ─── Data fetching ──────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await apiClient.get('/api/user-events')
      setEvents(res.data.events || [])
    } catch (err) {
      console.error('Failed to fetch events:', err)
    } finally {
      setEventsLoading(false)
    }
  }, [isAuthenticated])

  const fetchCalendarSources = useCallback(async () => {
    if (!isAuthenticated) return
    setSourcesLoading(true)
    try {
      const res = await apiClient.get('/api/calendar-sources')
      setCalendarSources(res.data.sources || [])
    } catch (err) {
      console.error('Failed to fetch calendar sources:', err)
    } finally {
      setSourcesLoading(false)
    }
  }, [isAuthenticated])

  const fetchCoordCalendars = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {}
      if (isAuthenticated && user) {
        params.include_own = user.email || user.id || user.travelerName
      }
      const res = await apiClient.get('/api/calendars', { params })
      setCoordCalendars(res.data || [])
    } catch {
      // ignore
    }
  }, [isAuthenticated, user])

  const fetchSubscriptions = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await apiClient.get('/api/calendar-subscriptions')
      setSubscriptions(res.data.subscriptions || [])
    } catch {
      // ignore
    }
  }, [isAuthenticated])

  const fetchSubscribedMeetings = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await apiClient.get('/api/calendar-subscriptions/meetings')
      // Ensure timestamps are treated as UTC (meetings table uses plain TIMESTAMP)
      const ensureUTC = (ts: string) =>
        ts && !ts.endsWith('Z') && !ts.includes('+') ? ts + 'Z' : ts
      const normalized = (res.data.meetings || []).map((m: SubscribedMeeting) => ({
        ...m,
        start_time: ensureUTC(m.start_time),
        end_time: ensureUTC(m.end_time),
      }))
      setSubscribedMeetings(normalized)
    } catch {
      // ignore
    }
  }, [isAuthenticated])

  const fetchSyncPrefs = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await apiClient.get('/api/user-events/sync-prefs')
      const prefs = Array.isArray(res.data?.prefs) ? res.data.prefs : []

      const nextSyncPrefs: Record<string, SourceSyncPreference> = {}
      const nextAutoPublishPrefs: Record<string, boolean> = {}
      const nextSyncMeta: Record<string, SourceSyncMeta> = {}

      for (const pref of prefs) {
        const sourceType = pref?.source_type
        const sourceId = typeof pref?.source_id === 'string' ? pref.source_id : ''
        if (!sourceId) continue

        const key = sourceType === 'coordination_calendar'
          ? `coordination_calendar:${sourceId}`
          : `calendar_source:${sourceId}`

        const rangeMonthsRaw = Number(pref?.range_months)
        const rangeMonths = Number.isFinite(rangeMonthsRaw)
          ? Math.min(24, Math.max(1, Math.floor(rangeMonthsRaw)))
          : 12

        nextSyncPrefs[key] = {
          mode: rangeMonths >= 24 ? 'indefinite' : 'range',
          rangeMonths,
        }
        nextAutoPublishPrefs[key] = !!pref?.auto_publish_new
        nextSyncMeta[key] = {
          lastSyncedAt: typeof pref?.last_synced_at === 'string' ? pref.last_synced_at : undefined,
          updatedAt: typeof pref?.updated_at === 'string' ? pref.updated_at : undefined,
          lastSyncError: typeof pref?.last_sync_error === 'string' ? pref.last_sync_error : undefined,
        }
      }

      setSourceSyncPrefs(nextSyncPrefs)
      setSourceAutoPublishPrefs(nextAutoPublishPrefs)
      setSourceSyncMeta(nextSyncMeta)
    } catch {
      // ignore -- fallback to local prefs
    } finally {
      setSyncPrefsHydrated(true)
    }
  }, [isAuthenticated])

  const handleUnsubscribe = async (calendarHash: string) => {
    try {
      await apiClient.delete(`/api/calendar-subscriptions/${calendarHash}`)
      setSubscriptions(prev => prev.filter(s => s.calendars?.hash !== calendarHash))
      setSubscribedMeetings(prev => prev.filter(m => m.calendar_hash !== calendarHash))
    } catch (err) {
      console.error('Failed to unsubscribe:', err)
    }
  }

  useEffect(() => {
    fetchEvents()
    fetchCalendarSources()
    fetchSubscriptions()
    fetchSubscribedMeetings()
    fetchSyncPrefs()
  }, [fetchEvents, fetchCalendarSources, fetchSubscriptions, fetchSubscribedMeetings, fetchSyncPrefs])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(SOURCE_SYNC_PREFS_KEY, JSON.stringify(sourceSyncPrefs))
  }, [sourceSyncPrefs])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(SOURCE_AUTO_PUBLISH_PREFS_KEY, JSON.stringify(sourceAutoPublishPrefs))
  }, [sourceAutoPublishPrefs])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(NETWORK_FILTER_MODES_KEY, JSON.stringify(serializeNetworkFilterModes(networkFilterModes)))
  }, [networkFilterModes])

  useEffect(() => {
    if (!isAuthenticated || !syncPrefsHydrated) return

    const payloadPrefs = Object.entries(sourceSyncPrefs)
      .map(([key, pref]) => {
        const sep = key.indexOf(':')
        if (sep < 0) return null
        const sourceTypeRaw = key.slice(0, sep)
        const sourceId = key.slice(sep + 1)
        if (!sourceId) return null

        if (sourceTypeRaw === 'calendar_source') {
          const src = calendarSources.find(s => s.id === sourceId)
          if (!src) return null
          return {
            source_type: src.source_type,
            source_id: sourceId,
            auto_sync: true,
            auto_publish_new: !!sourceAutoPublishPrefs[key],
            range_months: pref.mode === 'indefinite' ? 24 : Math.min(24, Math.max(1, pref.rangeMonths || 12)),
          }
        }

        if (sourceTypeRaw === 'coordination_calendar') {
          return {
            source_type: 'coordination_calendar',
            source_id: sourceId,
            auto_sync: true,
            auto_publish_new: !!sourceAutoPublishPrefs[key],
            range_months: pref.mode === 'indefinite' ? 24 : Math.min(24, Math.max(1, pref.rangeMonths || 12)),
          }
        }

        return null
      })
      .filter((item): item is { source_type: 'google_oauth' | 'google_public_url' | 'coordination_calendar'; source_id: string; auto_sync: boolean; auto_publish_new: boolean; range_months: number } => !!item)

    const timer = window.setTimeout(() => {
      void apiClient.put('/api/user-events/sync-prefs', { prefs: payloadPrefs }).catch(() => {
        // ignore
      })
    }, 500)

    return () => window.clearTimeout(timer)
  }, [isAuthenticated, syncPrefsHydrated, sourceSyncPrefs, sourceAutoPublishPrefs, calendarSources])

  const sourceSyncConfigs = useMemo(() => {
    const configs: Array<{
      source_type: 'google_oauth' | 'google_public_url' | 'coordination_calendar'
      source_id: string
      range_months: number
      auto_publish_new: boolean
    }> = []

    for (const [key, pref] of Object.entries(sourceSyncPrefs)) {
      const sep = key.indexOf(':')
      if (sep < 0) continue
      const sourceTypeRaw = key.slice(0, sep)
      const sourceId = key.slice(sep + 1)
      if (!sourceId) continue

      if (sourceTypeRaw !== 'calendar_source' && sourceTypeRaw !== 'coordination_calendar') {
        continue
      }

      if (sourceTypeRaw === 'calendar_source') {
        const src = calendarSources.find(s => s.id === sourceId)
        if (!src) continue
        configs.push({
          source_type: src.source_type,
          source_id: sourceId,
          range_months: pref.mode === 'indefinite' ? 24 : pref.rangeMonths,
          auto_publish_new: !!sourceAutoPublishPrefs[key],
        })
      } else {
        configs.push({
          source_type: 'coordination_calendar',
          source_id: sourceId,
          range_months: pref.mode === 'indefinite' ? 24 : pref.rangeMonths,
          auto_publish_new: !!sourceAutoPublishPrefs[key],
        })
      }
    }

    return configs
  }, [sourceSyncPrefs, calendarSources, sourceAutoPublishPrefs])

  const runImportedSourcesSync = useCallback(async (showSummaryToast: boolean) => {
    if (!isAuthenticated || autoSyncInFlightRef.current) return
    if (sourceSyncConfigs.length === 0) {
      if (showSummaryToast) {
        showToast('No imported calendars are configured for continuous sync.', 'error')
      }
      return
    }

    autoSyncInFlightRef.current = true
    setIsAutoSyncing(true)

    try {
      const res = await apiClient.post('/api/user-events/sync-imports', { source_configs: sourceSyncConfigs })
      const summary = res.data || {}
      const inserted = Number(summary.inserted || 0)
      const updated = Number(summary.updated || 0)
      const deleted = Number(summary.deleted || 0)
      const syncedSources = Number(summary.syncedSources || 0)

      await fetchEvents()
      setLastAutoSyncAt(new Date().toISOString())
      setAutoSyncSummary(`+${inserted} / ~${updated} / -${deleted}`)

      if (showSummaryToast) {
        showToast(`Synced ${syncedSources} source(s): +${inserted}, ~${updated}, -${deleted}`)
      }
    } catch (err) {
      if (showSummaryToast) {
        showToast((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to sync imported events.', 'error')
      }
    } finally {
      autoSyncInFlightRef.current = false
      setIsAutoSyncing(false)
    }
  }, [isAuthenticated, sourceSyncConfigs, fetchEvents, showToast])

  useEffect(() => {
    if (!isAuthenticated || sourceSyncConfigs.length === 0) return

    runImportedSourcesSync(false)

    const interval = setInterval(() => {
      runImportedSourcesSync(false)
    }, 10 * 60 * 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated, sourceSyncConfigs.length, runImportedSourcesSync])

  useEffect(() => {
    if (!isAuthenticated || sourceSyncConfigs.length === 0) return

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runImportedSourcesSync(false)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [isAuthenticated, sourceSyncConfigs.length, runImportedSourcesSync])

  // ─── Time helpers ─────────────────────────────────────────

  // Update current time every 30 seconds for red line indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Update UTC clock every second for accurate display
  useEffect(() => {
    const interval = setInterval(() => {
      setUtcNow(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Get current time indicator position (in pixels from top)
  const getCurrentTimePosition = (): number | null => {
    const now = currentTime
    const currentHourUTC = now.getUTCHours()
    const currentMinuteUTC = now.getUTCMinutes()
    
    if (currentHourUTC < startHour || currentHourUTC >= endHour) {
      return null
    }
    
    const minutesFromStart = (currentHourUTC - startHour) * 60 + currentMinuteUTC
    const position = (minutesFromStart / 60) * SLOT_HEIGHT
    
    return position
  }

  const generateTimeSlots = () => {
    const slots: string[] = []
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += timeInterval) {
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)), [currentWeekStart])
  const weekEnd = addDays(currentWeekStart, 7)

  const formatTimeLabel = (time: string) => convertUtcTimeToTimezone(time, tzState.primary)

  // Detect DST transitions within visible week for all active timezones
  const allActiveIanas = [tzState.primary, ...tzState.additional]
  const dstTransitions = detectDstTransitions(allActiveIanas, weekDays)

  // Build day slots: interleave DST indicator columns before the transition day
  type DaySlot =
    | { type: 'day'; day: Date; dayIdx: number }
    | { type: 'dst'; transition: DstTransition }
  const buildDaySlots = (): DaySlot[] => {
    const slots: DaySlot[] = []
    for (let i = 0; i < weekDays.length; i++) {
      const transitionsHere = dstTransitions.filter((t) => t.transitionDayIndex === i)
      for (const t of transitionsHere) {
        slots.push({ type: 'dst', transition: t })
      }
      slots.push({ type: 'day', day: weekDays[i], dayIdx: i })
    }
    return slots
  }
  const daySlots = buildDaySlots()

  // ─── Events for current week ──────────────────────────────

  const eventGroups = useMemo(() => {
    const map = new Map<string, UserEvent[]>()
    for (const ev of events) {
      const signature = buildEventGroupKey(ev)
      const list = map.get(signature) || []
      list.push(ev)
      map.set(signature, list)
    }
    return map
  }, [events])

  const representativeEvents = useMemo(() => {
    const reps: UserEvent[] = []
    for (const list of eventGroups.values()) {
      const sorted = [...list].sort((a, b) => {
        const aTs = getEventSyncPriorityTime(a)
        const bTs = getEventSyncPriorityTime(b)
        if (aTs !== bTs) return bTs - aTs
        return b.created_at.localeCompare(a.created_at)
      })
      reps.push(sorted[0])
    }
    return reps
  }, [eventGroups])

  const groupedEventsByRepresentativeId = useMemo(() => {
    const byId = new Map<string, UserEvent[]>()
    for (const list of eventGroups.values()) {
      const sorted = [...list].sort((a, b) => {
        const aTs = getEventSyncPriorityTime(a)
        const bTs = getEventSyncPriorityTime(b)
        if (aTs !== bTs) return bTs - aTs
        return b.created_at.localeCompare(a.created_at)
      })
      byId.set(sorted[0].id, sorted)
    }
    return byId
  }, [eventGroups])

  const eventsInWeek = useMemo(() => {
    return representativeEvents.filter(ev => {
      const evStart = new Date(ev.start_time)
      const evEnd = new Date(ev.end_time)
      return evStart < weekEnd && evEnd > currentWeekStart && isNetworkVisibleByName(getNetworkLabel(ev.source_type, ev.source_id))
    })
  }, [representativeEvents, currentWeekStart, weekEnd, getNetworkLabel, isNetworkVisibleByName])

  const subMeetingsInWeek = useMemo(() => {
    return subscribedMeetings.filter(m => {
      const mStart = new Date(m.start_time)
      const mEnd = new Date(m.end_time)
      return mStart < weekEnd && mEnd > currentWeekStart && isNetworkVisibleByName(getNetworkLabel('sub', m.calendar_hash, m.calendar_title || 'Subscription'))
    })
  }, [subscribedMeetings, currentWeekStart, weekEnd, getNetworkLabel, isNetworkVisibleByName])

  // Combined items for grid display

  // ─── Overlap layout per day ──────────────────────────────

  const dayLayouts = useMemo(() => {
    const slotDurationMs = timeInterval * 60 * 1000
    return weekDays.map(day => {
      const dayStartMs = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), startHour, 0, 0, 0)
      const dayEndMs = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), endHour, 0, 0, 0)

      const dayItems: GridItem[] = []
      for (const ev of eventsInWeek) {
        const evStart = new Date(ev.start_time).getTime()
        const evEnd = new Date(ev.end_time).getTime()
        if (evStart < dayEndMs && evEnd > dayStartMs) dayItems.push({ kind: 'event', data: ev })
      }
      for (const m of subMeetingsInWeek) {
        const mStart = new Date(m.start_time).getTime()
        const mEnd = new Date(m.end_time).getTime()
        if (mStart < dayEndMs && mEnd > dayStartMs) dayItems.push({ kind: 'sub', data: m })
      }

      const layout = computeDayLayout(
        dayItems.map(item => ({ id: item.data.id, start_time: item.data.start_time, end_time: item.data.end_time })),
        dayStartMs,
        dayEndMs,
        SLOT_HEIGHT,
        slotDurationMs
      )

      return { dayItems, layout }
    })
  }, [eventsInWeek, subMeetingsInWeek, timeInterval, startHour, endHour, weekDays])

  // ─── Grid cell helpers for drag selection ─────────────────

  const getCellId = (date: Date, time: string): string => {
    return `${format(date, 'yyyy-MM-dd')}_${time}`
  }

  const parseCellId = (cellId: string): { date: string; time: string } => {
    const [date, time] = cellId.split('_')
    return { date, time }
  }

  const getCellsInRectangle = (startCell: string, endCell: string): Set<string> => {
    const start = parseCellId(startCell)
    const end = parseCellId(endCell)
    const cells = new Set<string>()

    const startDate = parse(start.date, 'yyyy-MM-dd', new Date())
    const endDate = parse(end.date, 'yyyy-MM-dd', new Date())

    const allSlots = generateTimeSlots()
    const startTimeIdx = allSlots.indexOf(start.time)
    const endTimeIdx = allSlots.indexOf(end.time)
    const minTimeIdx = Math.min(startTimeIdx, endTimeIdx)
    const maxTimeIdx = Math.max(startTimeIdx, endTimeIdx)

    const dates: Date[] = []
    let cur = startDate <= endDate ? new Date(startDate) : new Date(endDate)
    const last = startDate <= endDate ? endDate : startDate
    while (cur <= last) {
      dates.push(new Date(cur))
      cur = addDays(cur, 1)
    }

    dates.forEach(d => {
      for (let i = minTimeIdx; i <= maxTimeIdx; i++) {
        cells.add(getCellId(d, allSlots[i]))
      }
    })
    return cells
  }

  const handleCellMouseDown = (day: Date, time: string) => {
    const cellId = getCellId(day, time)
    setIsDragging(true)
    setDragStart(cellId)
    setSelectedCells(new Set([cellId]))
    // Close any detail modals
    setSelectedEvent(null)
    setSelectedSubMeeting(null)
  }

  const handleCellMouseEnter = (day: Date, time: string) => {
    if (!isDragging || !dragStart) return
    const cellId = getCellId(day, time)
    const rectangleCells = getCellsInRectangle(dragStart, cellId)
    setSelectedCells(rectangleCells)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  useEffect(() => {
    setShowEventSourceNetworks(false)
  }, [selectedEvent?.id])

  // Get all events that overlap the selected cells
  const selectedEvents = useMemo(() => {
    if (selectedCells.size === 0) return []
    const eventIds = new Set<string>()
    const result: UserEvent[] = []

    for (const cellId of selectedCells) {
      const { date, time } = parseCellId(cellId)
      const [hours, mins] = time.split(':').map(Number)
      const cellDate = parse(date, 'yyyy-MM-dd', new Date())
      const slotStart = new Date(Date.UTC(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), hours, mins, 0, 0))
      const slotEnd = new Date(slotStart.getTime() + timeInterval * 60 * 1000)

      for (const ev of events) {
        if (eventIds.has(ev.id)) continue
        if (!isNetworkVisibleByName(getNetworkLabel(ev.source_type, ev.source_id))) continue
        const evStart = new Date(ev.start_time)
        const evEnd = new Date(ev.end_time)
        if (evStart < slotEnd && evEnd > slotStart) {
          eventIds.add(ev.id)
          result.push(ev)
        }
      }
    }
    return result
  }, [selectedCells, events, timeInterval, getNetworkLabel, isNetworkVisibleByName])

  const handleBulkDeleteSelected = async () => {
    if (selectedEvents.length === 0) return
    const ids = selectedEvents.map(e => e.id)
    try {
      await apiClient.delete('/api/user-events/bulk', { data: { event_ids: ids } })
      setEvents(prev => prev.filter(e => !ids.includes(e.id)))
      setSelectedCells(new Set())
    } catch (err) {
      console.error('Failed to bulk delete:', err)
    }
  }

  const handleBulkPublicSelected = async (isPublic: boolean) => {
    if (selectedEvents.length === 0) return
    const ids = selectedEvents.map(e => e.id)
    try {
      await apiClient.put('/api/user-events/bulk-public', { event_ids: ids, is_public: isPublic })
      setEvents(prev => prev.map(e => ids.includes(e.id) ? { ...e, is_public: isPublic } : e))
      setSelectedCells(new Set())
    } catch (err) {
      console.error('Failed to bulk update:', err)
    }
  }

  const handleDeleteBySource = async (sourceId: string, sourceType: string) => {
    try {
      await apiClient.delete('/api/user-events/bulk', { data: { source_id: sourceId, source_type: sourceType } })
      setEvents(prev => prev.filter(e => !(e.source_id === sourceId && e.source_type === sourceType)))
      // Remove from network filters if present
      setNetworkFilterModes(prev => {
        const next = { ...prev }
        const srcLabel = uniqueSources.find(([, v]) => v.id === sourceId && v.type === sourceType)?.[1]?.label
        if (srcLabel) delete next[srcLabel]
        return next
      })
      // Optionally, refresh events from server for full sync
      if (typeof fetchEvents === 'function') await fetchEvents()
    } catch (err) {
      console.error('Failed to delete by source:', err)
    }
  }

  const clearSelection = () => {
    setSelectedCells(new Set())
  }

  const currentImportSourceKey = useMemo(() => {
    if (importType === 'calendar_source' && importSourceId) {
      return `calendar_source:${importSourceId}`
    }
    if (importType === 'coordination_calendar' && importCalendarHash) {
      return `coordination_calendar:${importCalendarHash}`
    }
    return ''
  }, [importType, importSourceId, importCalendarHash])

  useEffect(() => {
    if (!currentImportSourceKey) {
      setImportSyncMode('once')
      return
    }

    const pref = sourceSyncPrefs[currentImportSourceKey]
    if (!pref) {
      setImportSyncMode('once')
      return
    }

    setImportSyncMode(pref.mode)
    if (pref.mode === 'range') {
      setImportMonths(pref.rangeMonths)
    }
  }, [currentImportSourceKey, sourceSyncPrefs])

  // ─── Event actions ────────────────────────────────────────

  const handleTogglePublic = async (event: UserEvent) => {
    try {
      await apiClient.put(`/api/user-events/${event.id}`, { is_public: !event.is_public })
      setEvents(prev => prev.map(e => e.id === event.id ? { ...e, is_public: !e.is_public } : e))
      if (selectedEvent?.id === event.id) {
        setSelectedEvent(prev => prev ? { ...prev, is_public: !prev.is_public } : null)
      }
    } catch (err) {
      console.error('Failed to toggle public:', err)
    }
  }

  const getSyncPrefKeyForEvent = useCallback((ev: UserEvent): string | null => {
    if (ev.source_type === 'manual' || !ev.source_id) return null
    if (ev.source_type === 'coordination_calendar') return `coordination_calendar:${ev.source_id}`
    return `calendar_source:${ev.source_id}`
  }, [])

  const getSyncPrefKeysForEvents = useCallback((evts: UserEvent[]): string[] => {
    const keys = new Set<string>()
    for (const ev of evts) {
      const key = getSyncPrefKeyForEvent(ev)
      if (key) keys.add(key)
    }
    return Array.from(keys)
  }, [getSyncPrefKeyForEvent])

  const setAutoSyncForEvents = useCallback((evts: UserEvent[], enabled: boolean, autoPublishNew?: boolean) => {
    const prefKeys = getSyncPrefKeysForEvents(evts)
    if (prefKeys.length === 0) return

    setSourceSyncPrefs(prev => {
      const next = { ...prev }
      for (const key of prefKeys) {
        if (enabled) {
          next[key] = { mode: 'indefinite', rangeMonths: 24 }
        } else {
          delete next[key]
        }
      }
      return next
    })

    setSourceAutoPublishPrefs(prev => {
      const next = { ...prev }
      for (const key of prefKeys) {
        if (!enabled) {
          delete next[key]
          continue
        }
        if (typeof autoPublishNew === 'boolean') {
          next[key] = autoPublishNew
        } else if (!(key in next)) {
          next[key] = false
        }
      }
      return next
    })
  }, [getSyncPrefKeysForEvents])

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await apiClient.delete(`/api/user-events/${eventId}`)
      setEvents(prev => prev.filter(e => e.id !== eventId))
      if (selectedEvent?.id === eventId) setSelectedEvent(null)
    } catch (err) {
      console.error('Failed to delete event:', err)
    }
  }

  const handleBulkPublic = async (isPublic: boolean, sourceId?: string, sourceType?: string) => {
    try {
      const body: Record<string, unknown> = { is_public: isPublic }
      if (sourceId) {
        body.source_id = sourceId
        if (sourceType) body.source_type = sourceType
      }
      const res = await apiClient.put('/api/user-events/bulk-public', body)
      // Refresh events
      await fetchEvents()
      return res.data.updated || 0
    } catch (err) {
      console.error('Failed to bulk update:', err)
      return 0
    }
  }

  // ─── Import handling ──────────────────────────────────────

  const handleImport = async () => {
    setIsImporting(true)
    setImportResult(null)
    try {
      const now = new Date()
      const timeMin = now.toISOString()
      const futureDate = new Date(now)
      futureDate.setMonth(futureDate.getMonth() + importMonths)
      const timeMax = futureDate.toISOString()

      if (importType === 'calendar_source' && importSourceId) {
        const res = await apiClient.post('/api/user-events/import/calendar-source', {
          source_id: importSourceId,
          time_min: timeMin,
          time_max: timeMax,
        })
        setImportResult(`Imported ${res.data.imported} of ${res.data.total_found} events`)
      } else if (importType === 'coordination_calendar' && importCalendarHash) {
        const res = await apiClient.post('/api/user-events/import/coordination-calendar', {
          calendar_hash: importCalendarHash,
        })
        setImportResult(`Imported ${res.data.imported} of ${res.data.total_found} meetings`)
      }

      if (currentImportSourceKey) {
        setSourceSyncPrefs(prev => {
          const next = { ...prev }
          if (importSyncMode === 'once') {
            delete next[currentImportSourceKey]
          } else {
            next[currentImportSourceKey] = {
              mode: importSyncMode,
              rangeMonths: importSyncMode === 'indefinite' ? 24 : importMonths,
            }
          }
          return next
        })

        if (importSyncMode === 'once') {
          setSourceAutoPublishPrefs(prev => {
            const next = { ...prev }
            delete next[currentImportSourceKey]
            return next
          })
        }
      }

      await fetchEvents()
    } catch (err) {
      setImportResult(`Error: ${(err as { response?: { data?: { error?: string } } }).response?.data?.error || (err as { message?: string }).message}`)
    } finally {
      setIsImporting(false)
    }
  }

  // ─── Create event ─────────────────────────────────────────

  const handleCreateEvent = async () => {
    if (!createForm.title || !createForm.start_date || !createForm.end_date) return
    try {
      const startISO = new Date(`${createForm.start_date}T${createForm.start_time}:00Z`).toISOString()
      const endISO = new Date(`${createForm.end_date}T${createForm.end_time}:00Z`).toISOString()

      await apiClient.post('/api/user-events', {
        title: createForm.title,
        description: createForm.description || null,
        meeting_link: createForm.meeting_link || null,
        location: createForm.location || null,
        start_time: startISO,
        end_time: endISO,
        is_public: createForm.is_public,
      })

      await fetchEvents()
      setShowCreateModal(false)
      setCreateForm({
        title: '', description: '', meeting_link: '', location: '',
        start_date: '', start_time: '09:00', end_date: '', end_time: '10:00', is_public: false,
      })
    } catch (err) {
      console.error('Failed to create event:', err)
    }
  }

  // ─── Week navigation ─────────────────────────────────────

  const goToPrevWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1))
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1))
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Publish modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [publishModalEvents, setPublishModalEvents] = useState<UserEvent[]>([])
  const [publishModalSelectedIds, setPublishModalSelectedIds] = useState<Set<string>>(new Set())
  const [publishModalAutoSync, setPublishModalAutoSync] = useState(true)
  const [publishModalAutoPublishNew, setPublishModalAutoPublishNew] = useState(false)
  const [publishModalOnConfirm, setPublishModalOnConfirm] = useState<((ids: string[], options: PublishOptions) => Promise<void>) | null>(null)

  const openPublishModal = (
    evts: UserEvent[],
    onConfirm: (ids: string[], options: PublishOptions) => Promise<void>,
    defaults?: Partial<PublishOptions>
  ) => {
    setPublishModalEvents(evts)
    setPublishModalSelectedIds(new Set(evts.map(e => e.id)))
    setPublishModalAutoSync(defaults?.autoSync ?? true)
    setPublishModalAutoPublishNew(defaults?.autoPublishNew ?? false)
    setPublishModalOnConfirm(() => onConfirm)
    setPublishModalOpen(true)
  }

  const _openLeftPanelSection = (section: 'networks' | 'following') => {
    if (section === 'networks') setNetworksExpanded(true)
    else setFollowingExpanded(true)
    setIsLeftToolsPanelOpen(true)
  }

  // ─── Source display helpers ───────────────────────────────

  const uniqueSources = useMemo(() => {
    const sources = new Map<string, { type: string; id: string; label: string }>()
    for (const ev of events) {
      const key = `${ev.source_type}:${ev.source_id || 'manual'}`
      if (!sources.has(key)) {
        const label = ev.source_type === 'manual' ? MAIN_NETWORK_LABEL
          : ev.source_type === 'coordination_calendar' ? `Coordination: ${ev.source_id}`
          : calendarSources.find(s => s.id === ev.source_id)?.display_name || ev.source_id || 'Calendar'
        sources.set(key, { type: ev.source_type, id: ev.source_id || '', label })
      }
    }
    return Array.from(sources.entries())
  }, [events, calendarSources])

  const sourceColors = useMemo(() => {
    const colors: Record<string, string> = {}
    const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
    uniqueSources.forEach(([key], i) => {
      if (key.startsWith('manual:')) colors[key] = '#6B7280'
      else colors[key] = palette[i % palette.length]
    })
    return colors
  }, [uniqueSources])

  const getNetworkLabelForEvent = useCallback((ev: UserEvent) => {
    const sourceKey = `${ev.source_type}:${ev.source_id || 'manual'}`
    const src = uniqueSources.find(([k]) => k === sourceKey)
    return src ? src[1].label : MAIN_NETWORK_LABEL
  }, [uniqueSources])

  const getEventColor = (ev: UserEvent) => {
    const key = `${ev.source_type}:${ev.source_id || 'manual'}`
    return sourceColors[key] || '#6B7280'
  }

  // ─── Network Cards ──────────────────────────────────────

  const networks = useMemo(() => {
    const map = new Map<string, { name: string; count: number; color: string; sourceKey: string }>()
    for (const ev of events) {
      const sourceKey = `${ev.source_type}:${ev.source_id || 'manual'}`
      const src = uniqueSources.find(([k]) => k === sourceKey)
      const name = src ? src[1].label : MAIN_NETWORK_LABEL
      if (!map.has(name)) {
        map.set(name, { name, count: 0, color: sourceColors[sourceKey] || '#6B7280', sourceKey })
      }
      map.get(name)!.count++
    }
    // Also add subscribed calendar sources
    for (const m of subscribedMeetings) {
      const name = m.calendar_title || 'Subscription'
      if (!map.has(name)) {
        map.set(name, { name, count: 0, color: '#8B5CF6', sourceKey: `sub:${m.calendar_hash}` })
      }
      map.get(name)!.count++
    }
    return Array.from(map.values())
  }, [events, subscribedMeetings, uniqueSources, sourceColors])

  const networkFilters = useMemo(() => {
    const pinned = new Set<string>()
    const focused = new Set<string>()
    const hidden = new Set<string>()

    for (const [name, mode] of Object.entries(networkFilterModes)) {
      if (mode === 'pinned') pinned.add(name)
      else if (mode === 'focus') focused.add(name)
      else if (mode === 'hidden') hidden.add(name)
    }

    return {
      pinned,
      focused,
      hidden,
      actionable: new Set<string>([...pinned, ...focused]),
    }
  }, [networkFilterModes])

  const selectedPublishNetworks = useMemo(() => {
    if (publishSelectedNetworks.size === 0) return [] as typeof networks
    return networks.filter(net => publishSelectedNetworks.has(net.name) && networkFilterModes[net.name] !== 'hidden')
  }, [networks, publishSelectedNetworks, networkFilterModes])

  useEffect(() => {
    setPublishSelectedNetworks(prev => {
      if (prev.size === 0) return prev

      const availableNames = new Set(networks.map(net => net.name))
      let changed = false
      const next = new Set<string>()

      for (const name of prev) {
        if (!availableNames.has(name) || networkFilterModes[name] === 'hidden') {
          changed = true
          continue
        }
        next.add(name)
      }

      return changed ? next : prev
    })
  }, [networks, networkFilterModes])

  const getNextNetworkFilterMode = (mode?: NetworkFilterMode): NetworkFilterMode | undefined => {
    if (!mode) return 'pinned'
    if (mode === 'pinned') return 'focus'
    if (mode === 'focus') return 'hidden'
    return undefined
  }

  const cycleNetworkFilter = (name: string) => {
    const nextMode = getNextNetworkFilterMode(networkFilterModes[name])

    setNetworkFilterModes(prev => {
      const next = { ...prev }
      const nextMode = getNextNetworkFilterMode(prev[name])
      if (!nextMode) delete next[name]
      else next[name] = nextMode
      return next
    })

    if (nextMode === 'hidden') {
      setPublishSelectedNetworks(prev => {
        if (!prev.has(name)) return prev
        const next = new Set(prev)
        next.delete(name)
        return next
      })
    }
  }

  const togglePublishNetworkSelection = (name: string) => {
    if (networkFilterModes[name] === 'hidden') return

    setPublishSelectedNetworks(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const getNetworkFilterMode = (name: string): NetworkFilterMode | undefined => networkFilterModes[name]

  const _isNetworkVisible = useCallback((name: string) => {
    const mode = networkFilterModes[name]
    if (mode === 'hidden') return false
    if (networkFilters.focused.size > 0) return mode === 'focus' || mode === 'pinned'
    return true
  }, [networkFilterModes, networkFilters])

  const getNetworkFilterButtonLabel = (mode?: NetworkFilterMode): string => {
    if (mode === 'pinned') return 'Pin'
    if (mode === 'focus') return 'Only'
    if (mode === 'hidden') return 'Hide'
    return 'All'
  }

  const getNetworkFilterButtonClassName = (mode?: NetworkFilterMode): string => {
    if (mode === 'pinned') {
      return 'border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300'
    }
    if (mode === 'focus') {
      return 'border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    }
    if (mode === 'hidden') {
      return 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    }
    return 'border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground'
  }

  const getNetworkHoverTitle = (sourceKey: string): string | undefined => {
    if (sourceKey.startsWith('manual:')) return MAIN_CALENDAR_DATA_CONTROLLER_LABEL
    return undefined
  }

  const getPrefKeyFromSourceKey = (sourceKey: string): string | null => {
    const colonIdx = sourceKey.indexOf(':')
    if (colonIdx < 0) return null

    const srcType = sourceKey.slice(0, colonIdx)
    const srcId = sourceKey.slice(colonIdx + 1)
    if (!srcId) return null

    if (srcType === 'coordination_calendar') return `coordination_calendar:${srcId}`
    if (srcType === 'google_oauth' || srcType === 'google_public_url') return `calendar_source:${srcId}`
    return null
  }

  const getNetworkSyncDetails = (sourceKey: string): { isInSync: boolean; statusLabel: string; deadlineLabel?: string; modeLabel?: string } => {
    if (sourceKey.startsWith('manual:')) {
      return { isInSync: false, statusLabel: MAIN_CALENDAR_MODE_LABEL }
    }

    if (sourceKey.startsWith('sub:')) {
      return { isInSync: true, statusLabel: 'Following live' }
    }

    const prefKey = getPrefKeyFromSourceKey(sourceKey)
    if (!prefKey) {
      return { isInSync: false, statusLabel: 'Not synced', modeLabel: 'off' }
    }

    const pref = sourceSyncPrefs[prefKey]
    if (!pref) {
      return { isInSync: false, statusLabel: 'Not synced', modeLabel: 'off' }
    }

    if (pref.mode === 'indefinite') {
      return { isInSync: true, statusLabel: 'In sync', modeLabel: 'indefinite' }
    }

    const anchor = sourceSyncMeta[prefKey]?.lastSyncedAt || sourceSyncMeta[prefKey]?.updatedAt
    const baseDate = anchor ? new Date(anchor) : new Date()
    const deadline = addMonths(baseDate, Math.max(1, pref.rangeMonths || 1))
    const ended = deadline.getTime() < Date.now()
    return {
      isInSync: !ended,
      statusLabel: ended ? 'Range ended' : 'In sync',
      deadlineLabel: `until ${format(deadline, 'MMM d, yyyy')}`,
      modeLabel: `range ${Math.max(1, pref.rangeMonths || 1)}m`,
    }
  }

  const setNetworkSyncMode = (sourceKey: string, mode: 'off' | 'range' | 'indefinite') => {
    if (sourceKey.startsWith('manual:') || sourceKey.startsWith('sub:')) return

    const prefKey = getPrefKeyFromSourceKey(sourceKey)
    if (!prefKey) return

    setSourceSyncPrefs(prev => {
      const next = { ...prev }
      if (mode === 'off') {
        delete next[prefKey]
      } else if (mode === 'indefinite') {
        next[prefKey] = { mode: 'indefinite', rangeMonths: 24 }
      } else {
        const existingMonths = next[prefKey]?.rangeMonths || 3
        next[prefKey] = { mode: 'range', rangeMonths: Math.min(24, Math.max(1, existingMonths)) }
      }
      return next
    })

    if (mode === 'off') {
      setSourceAutoPublishPrefs(prev => {
        const next = { ...prev }
        delete next[prefKey]
        return next
      })
    }
  }

  const setNetworkSyncRangeMonths = (sourceKey: string, months: number) => {
    const prefKey = getPrefKeyFromSourceKey(sourceKey)
    if (!prefKey) return

    setSourceSyncPrefs(prev => {
      const next = { ...prev }
      next[prefKey] = {
        mode: 'range',
        rangeMonths: Math.min(24, Math.max(1, Math.floor(months || 1))),
      }
      return next
    })
  }

  /** Get the display label for an event based on selected networks */
  const getEventChipLabel = (ev: UserEvent) => {
    const networkName = getNetworkLabelForEvent(ev)
    if (networkFilters.actionable.has(networkName)) return ev.title
    return networkName
  }

  const getSubChipLabel = (m: SubscribedMeeting) => {
    const networkName = m.calendar_title || 'Subscription'
    if (networkFilters.actionable.has(networkName)) return m.title
    return networkName
  }

  const formatUTC = (iso: string, fmt: string) => {
    const d = new Date(iso)
    const utc = new Date(d.getTime() + d.getTimezoneOffset() * 60000)
    return format(utc, fmt)
  }

  const selectedEventSourceNetworkNames = useMemo(() => {
    if (!selectedEvent) return []
    const grouped = groupedEventsByRepresentativeId.get(selectedEvent.id) || [selectedEvent]
    const names = new Set<string>()
    for (const ev of grouped) {
      names.add(getNetworkLabelForEvent(ev))
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [selectedEvent, groupedEventsByRepresentativeId, getNetworkLabelForEvent])

  const selectedEventGroupedRows = useMemo(() => {
    if (!selectedEvent) return []
    return groupedEventsByRepresentativeId.get(selectedEvent.id) || [selectedEvent]
  }, [selectedEvent, groupedEventsByRepresentativeId])

  const selectedEventSyncPrefKeys = useMemo(() => {
    return getSyncPrefKeysForEvents(selectedEventGroupedRows)
  }, [selectedEventGroupedRows, getSyncPrefKeysForEvents])

  const selectedEventAutoSyncEnabled = useMemo(() => {
    if (selectedEventSyncPrefKeys.length === 0) return false
    return selectedEventSyncPrefKeys.every(key => !!sourceSyncPrefs[key])
  }, [selectedEventSyncPrefKeys, sourceSyncPrefs])

  const latestServerSyncAt = useMemo(() => {
    const times = Object.values(sourceSyncMeta)
      .map(meta => meta.lastSyncedAt)
      .filter((v): v is string => !!v)
      .map(v => new Date(v).getTime())
      .filter(t => Number.isFinite(t))

    if (times.length === 0) return null
    return new Date(Math.max(...times)).toISOString()
  }, [sourceSyncMeta])

  const serverSyncErrorCount = useMemo(() => {
    return Object.values(sourceSyncMeta).filter(meta => !!meta.lastSyncError).length
  }, [sourceSyncMeta])

  const importPrimaryLabel = useMemo(() => {
    if (importType === 'coordination_calendar') {
      return importSyncMode === 'once' ? 'Import Meetings (once)' : 'Import Meetings'
    }
    return importSyncMode === 'once' ? 'Import Events (once)' : 'Import Events'
  }, [importType, importSyncMode])

  // ─── Render ───────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to access Your Event Calendar</h2>
          <p className="text-muted-foreground">Import events from your calendars and publish them to the Events Calendar.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <LeftPanelPortal>
        <aside
          className={`sticky top-0 h-screen shrink-0 overflow-hidden border-r border-border bg-card transition-all duration-300 ${
            isLeftToolsPanelOpen ? 'w-96' : 'w-0'
          }`}
        >
          <div className="flex h-full w-96 min-w-[24rem] flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <PanelLeftOpen className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-foreground">Calendar Tools</h2>
              </div>
              <button
                onClick={() => setIsLeftToolsPanelOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Hide side panel"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 after:block after:h-[33vh] after:content-['']">
              <div className="border border-border rounded-lg overflow-hidden mb-3">
                <button
                  onClick={() => setNetworksExpanded(prev => !prev)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent/50 transition-colors"
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>Networks</span>
                  <span className="text-[10px] opacity-60">{networks.length}</span>
                  {networkFilters.actionable.size > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">{networkFilters.actionable.size} view active</span>
                  )}
                  {selectedPublishNetworks.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">{selectedPublishNetworks.length} selected</span>
                  )}
                  {networkFilters.hidden.size > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">{networkFilters.hidden.size} hidden</span>
                  )}
                  <span className="ml-auto">{networksExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
                </button>
                {networksExpanded && (
                  <div className="px-3 pb-2">
                    {networks.length === 0 ? (
                      <p className="rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                        No networks available yet. Import or create events to populate this list.
                      </p>
                    ) : (
                      <>
                        <p className="mb-2 text-[10px] text-muted-foreground leading-tight">
                          View controls visibility only. Select controls which networks are used by the action buttons below. Hidden networks cannot be selected. Pin keeps a network visible without hiding others, Only hides everything else except other selected networks, and Hide removes just that network. Calendar mode shows whether events are Main, Following live, or using imported sync.
                        </p>
                        <table className="w-full table-fixed text-[10px] leading-tight mb-3">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="w-[56px] text-left font-medium py-1">View</th>
                              <th className="w-[62px] text-left font-medium py-1">Select</th>
                              <th className="w-[46px] text-left font-medium py-1">#</th>
                              <th className="text-left font-medium py-1">Network</th>
                              <th className="w-[130px] text-left font-medium py-1">Calendar mode</th>
                            </tr>
                          </thead>
                          <tbody>
                            {networks.map(net => {
                              const syncDetails = getNetworkSyncDetails(net.sourceKey)
                              const filterMode = getNetworkFilterMode(net.name)
                              const isPublishSelected = publishSelectedNetworks.has(net.name)
                              const isPublishDisabled = filterMode === 'hidden'
                              return (
                                <tr key={net.name} className="border-b border-border last:border-b-0">
                                  <td className="py-1">
                                    <button
                                      type="button"
                                      onClick={() => cycleNetworkFilter(net.name)}
                                      className={`inline-flex h-6 min-w-[42px] items-center justify-center rounded border px-1.5 text-[9px] font-semibold transition-colors ${getNetworkFilterButtonClassName(filterMode)}`}
                                      title={`Cycle ${net.name} filter`}
                                      aria-label={`${net.name} filter ${getNetworkFilterButtonLabel(filterMode)}`}
                                    >
                                      {getNetworkFilterButtonLabel(filterMode)}
                                    </button>
                                  </td>
                                  <td className="py-1">
                                    <label
                                      className={`inline-flex h-6 min-w-[48px] items-center justify-center rounded border px-1.5 ${
                                        isPublishDisabled
                                          ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 cursor-not-allowed'
                                          : isPublishSelected
                                            ? 'border-emerald-300 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30'
                                            : 'border-border bg-background'
                                      }`}
                                      title={isPublishDisabled ? `${net.name} is hidden from view and cannot be selected` : `Select ${net.name}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isPublishSelected && !isPublishDisabled}
                                        disabled={isPublishDisabled}
                                        onChange={() => togglePublishNetworkSelection(net.name)}
                                        className="h-3.5 w-3.5 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed"
                                        aria-label={isPublishDisabled ? `${net.name} selection unavailable while hidden` : `${net.name} selected`}
                                      />
                                    </label>
                                  </td>
                                  <td className="py-1">{net.count}</td>
                                  <td className="py-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: net.color }} />
                                      <span className="whitespace-normal break-words leading-tight" title={getNetworkHoverTitle(net.sourceKey)}>{net.name}</span>
                                    </div>
                                  </td>
                                  <td className="py-1">
                                    <div className="flex flex-col items-start gap-0.5">
                                      {!net.sourceKey.startsWith('manual:') && !net.sourceKey.startsWith('sub:') && (() => {
                                        const prefKey = getPrefKeyFromSourceKey(net.sourceKey)
                                        const pref = prefKey ? sourceSyncPrefs[prefKey] : undefined
                                        const modeValue = !pref ? 'off' : pref.mode === 'indefinite' ? 'indefinite' : 'range'

                                        return (
                                          <>
                                            <select
                                              value={modeValue}
                                              onChange={e => setNetworkSyncMode(net.sourceKey, e.target.value as 'off' | 'range' | 'indefinite')}
                                              className="h-6 w-full rounded border border-border bg-background px-1 text-[9px]"
                                            >
                                              <option value="off">Off</option>
                                              <option value="range">Range</option>
                                              <option value="indefinite">Indefinite</option>
                                            </select>
                                            {modeValue === 'range' && (
                                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                                <input
                                                  type="number"
                                                  min={1}
                                                  max={24}
                                                  value={Math.min(24, Math.max(1, pref?.rangeMonths || 3))}
                                                  onChange={e => setNetworkSyncRangeMonths(net.sourceKey, Number(e.target.value || 1))}
                                                  className="h-5 w-11 rounded border border-border bg-background px-1"
                                                />
                                                <span>months</span>
                                              </div>
                                            )}
                                          </>
                                        )
                                      })()}
                                      <span className={`text-[9px] px-1 py-0.5 rounded-full ${
                                        syncDetails.isInSync
                                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                          : 'bg-muted text-muted-foreground'
                                      }`}>
                                        {syncDetails.statusLabel}
                                      </span>
                                      {syncDetails.modeLabel && (
                                        <span className="text-[9px] text-muted-foreground">{syncDetails.modeLabel}</span>
                                      )}
                                      {syncDetails.deadlineLabel && (
                                        <span className="text-[9px] text-muted-foreground">{syncDetails.deadlineLabel}</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>

                        {selectedPublishNetworks.length > 0 && (
                          <div className="flex flex-col gap-2 pt-1">
                            <p className="text-[10px] leading-tight text-muted-foreground">
                              The functions below are activated for selected networks.
                            </p>
                            <div className="rounded-md border border-border/70 bg-background/60 px-2 py-2 space-y-2">
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={sidePanelPublishAutoSync}
                                  onChange={e => setSidePanelPublishAutoSync(e.target.checked)}
                                  className="mt-0.5 accent-blue-600 w-3.5 h-3.5 shrink-0"
                                />
                                <span className="text-[10px] leading-tight text-muted-foreground">
                                  Auto-sync updates after publish
                                </span>
                              </label>
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={sidePanelPublishAutoPublishNew}
                                  onChange={e => setSidePanelPublishAutoPublishNew(e.target.checked)}
                                  className="mt-0.5 accent-blue-600 w-3.5 h-3.5 shrink-0"
                                />
                                <span className="text-[10px] leading-tight text-muted-foreground">
                                  Auto-publish new meetings from selected calendars
                                </span>
                              </label>
                            </div>
                            <button
                              onClick={() => {
                                const selected = selectedPublishNetworks
                                const eventsToPublish = events.filter(ev => {
                                  const net = selected.find(n => n.sourceKey === `${ev.source_type}:${ev.source_id || 'manual'}`)
                                  return !!net && !net.sourceKey.startsWith('sub:')
                                })
                                openPublishModal(eventsToPublish, async (ids, options) => {
                                  const eventsBySource = new Map<string, { srcType: string; srcId: string }>()
                                  for (const net of selected) {
                                    if (net.sourceKey.startsWith('sub:')) continue
                                    const colonIdx = net.sourceKey.indexOf(':')
                                    const srcType = net.sourceKey.slice(0, colonIdx)
                                    const srcId = net.sourceKey.slice(colonIdx + 1)
                                    if (srcType && srcId) eventsBySource.set(net.sourceKey, { srcType, srcId })
                                  }
                                  // Use targeted IDs if available, else bulk by source
                                  if (ids.length > 0 && ids.length < eventsToPublish.length) {
                                    await apiClient.put('/api/user-events/bulk-public', { event_ids: ids, is_public: true })
                                    await fetchEvents()
                                  } else {
                                    for (const { srcType, srcId } of eventsBySource.values()) {
                                      await handleBulkPublic(true, srcId, srcType)
                                    }
                                  }
                                  const selectedRows = eventsToPublish.filter(ev => ids.includes(ev.id))
                                  setAutoSyncForEvents(selectedRows, options.autoSync, options.autoPublishNew)
                                }, {
                                  autoSync: sidePanelPublishAutoSync,
                                  autoPublishNew: sidePanelPublishAutoPublishNew,
                                })
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Make Network Events Public
                            </button>
                            <button
                              onClick={() => {
                                const selected = selectedPublishNetworks
                                selected.forEach(net => {
                                  const colonIdx = net.sourceKey.indexOf(':')
                                  const srcType = net.sourceKey.slice(0, colonIdx)
                                  const srcId = net.sourceKey.slice(colonIdx + 1)
                                  if (srcType && srcId && srcType !== 'sub') handleBulkPublic(false, srcId, srcType)
                                })
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-muted text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors shadow-sm"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                              Make Network Events Private
                            </button>
                            <button
                              onClick={() => {
                                const selected = selectedPublishNetworks
                                if (selected.length === 0) return
                                const ownNets = selected.filter(n => !n.sourceKey.startsWith('sub:'))
                                const subNets = selected.filter(n => n.sourceKey.startsWith('sub:'))
                                const allNames = selected.map(n => n.name).join(', ')
                                setConfirmTitle('Clear All Events?')
                                setConfirmMessage(`Remove all events from "${allNames}" from your Coordinate Events Calendar? This cannot be undone.`)
                                setOnConfirmAction(() => async () => {
                                  for (const net of ownNets) {
                                    const colonIdx = net.sourceKey.indexOf(':')
                                    const srcType = net.sourceKey.slice(0, colonIdx)
                                    const srcId = net.sourceKey.slice(colonIdx + 1)
                                    if (srcType && srcId) await handleDeleteBySource(srcId, srcType)
                                  }
                                  for (const net of subNets) {
                                    const hash = net.sourceKey.slice(4)
                                    if (hash) await handleUnsubscribe(hash)
                                  }
                                })
                                setTimeout(() => setConfirmOpen(true), 0)
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove from Calendar
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setFollowingExpanded(prev => !prev)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent/50 transition-colors"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Following</span>
                  <span className="text-[10px] opacity-60">{subscriptions.length}</span>
                  <span className="ml-auto">{followingExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
                </button>
                {followingExpanded && (
                  <div className="px-3 pb-2 flex flex-wrap items-center gap-2">
                    {subscriptions.length === 0 ? (
                      <p className="rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground w-full">
                        You are not following any coordination calendars yet.
                      </p>
                    ) : (
                      subscriptions.map(sub => (
                        <div key={sub.id} className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Bell className="w-3 h-3" />
                          <a href={`/calendar/${sub.calendars?.hash}`} className="hover:underline">{sub.calendars?.title || sub.calendars?.hash}</a>
                          <button
                            onClick={() => sub.calendars?.hash && handleUnsubscribe(sub.calendars.hash)}
                            className="ml-1 p-0.5 hover:bg-purple-200 dark:hover:bg-purple-800 rounded transition-colors"
                            title="Unfollow"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </LeftPanelPortal>

      <div className="flex flex-col h-screen bg-background p-2 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-2 md:mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-base md:text-2xl font-bold">Your Event Calendar</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!isLeftToolsPanelOpen) {
                    setIsLeftToolsPanelOpen(true)
                    setNetworksExpanded(true)
                  } else {
                    setNetworksExpanded(prev => !prev)
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors border ${
                  isLeftToolsPanelOpen && networksExpanded
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                    : 'bg-background text-foreground border-border hover:bg-accent/50'
                }`}
                title={isLeftToolsPanelOpen && networksExpanded ? 'Collapse networks section' : 'Show networks'}
              >
                {isLeftToolsPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                <Network className="w-4 h-4" />
                Networks
                <span className="text-[10px] opacity-80">{networks.length}</span>
                {selectedPublishNetworks.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/15">
                    {selectedPublishNetworks.length}
                  </span>
                )}
                {networkFilters.hidden.size > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-100">
                    {networkFilters.hidden.size} hidden
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  if (!isLeftToolsPanelOpen) {
                    setIsLeftToolsPanelOpen(true)
                    setFollowingExpanded(true)
                  } else {
                    setFollowingExpanded(prev => !prev)
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors border ${
                  isLeftToolsPanelOpen && followingExpanded
                    ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                    : 'bg-background text-foreground border-border hover:bg-accent/50'
                }`}
                title={isLeftToolsPanelOpen && followingExpanded ? 'Collapse following section' : 'Show following'}
              >
                {isLeftToolsPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                <Bell className="w-4 h-4" />
                Following
                <span className="text-[10px] opacity-80">{subscriptions.length}</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Event
              </button>
              <button
                onClick={() => { setShowImportModal(true); setImportType(null); setImportResult(null); fetchCoordCalendars() }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Import
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TimezoneSelector timezones={tzState} />
            <span className="text-border mx-1">|</span>
            <span>{events.length} event{events.length !== 1 ? 's' : ''}</span>
            <span className="text-border mx-1">|</span>
            <span>{events.filter(e => e.is_public).length} public</span>
            <span className="text-border mx-1">|</span>
            <span className="text-xs opacity-80">Auto-sync sources: {sourceSyncConfigs.length}</span>
            <button
              onClick={() => runImportedSourcesSync(true)}
              disabled={isAutoSyncing || sourceSyncConfigs.length === 0}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-accent/50 disabled:opacity-50"
            >
              {isAutoSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sync now
            </button>
            {lastAutoSyncAt && (
              <span className="text-xs opacity-80">
                Last sync {format(new Date(lastAutoSyncAt), 'HH:mm')} ({autoSyncSummary || 'no changes'})
              </span>
            )}
            {latestServerSyncAt && (
              <span className="text-xs opacity-80">
                Server sync {format(new Date(latestServerSyncAt), 'MMM d, yyyy HH:mm')}
              </span>
            )}
            {serverSyncErrorCount > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {serverSyncErrorCount} source{serverSyncErrorCount !== 1 ? 's' : ''} with sync errors
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Tool Sections */}
      <div className="flex flex-col gap-1 mb-2">
        {/* Tool sections moved to shared left sidepanel */}
      </div>

      {/* Selection Toolbar */}
      {selectedCells.size > 0 && (
        <div className="mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
            {selectedCells.size} slot{selectedCells.size !== 1 ? 's' : ''} selected
            {selectedEvents.length > 0 && ` · ${selectedEvents.length} event${selectedEvents.length !== 1 ? 's' : ''}`}
          </span>
          {selectedEvents.length > 0 && (
            <>
              <button
                onClick={() => {
                  openPublishModal(selectedEvents, async (ids, options) => {
                    await apiClient.put('/api/user-events/bulk-public', { event_ids: ids, is_public: true })
                    setEvents(prev => prev.map(e => ids.includes(e.id) ? { ...e, is_public: true } : e))
                    const selectedRows = selectedEvents.filter(ev => ids.includes(ev.id))
                    setAutoSyncForEvents(selectedRows, options.autoSync, options.autoPublishNew)
                    setSelectedCells(new Set())
                  })
                }}
                className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                <Eye className="w-3 h-3 inline mr-1" />
                Make Public
              </button>
              <button
                onClick={() => handleBulkPublicSelected(false)}
                className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
              >
                <EyeOff className="w-3 h-3 inline mr-1" />
                Make Private
              </button>
              <button
                onClick={() => {
                  setConfirmTitle('Delete Selected Events?');
                  setConfirmMessage(`Delete ${selectedEvents.length} selected event${selectedEvents.length !== 1 ? 's' : ''}? This cannot be undone.`);
                  setOnConfirmAction(() => handleBulkDeleteSelected);
                  setConfirmOpen(true);
                }}
                className="px-2 py-1 text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                <Trash2 className="w-3 h-3 inline mr-1" />
                Delete Selected
              </button>
            </>
          )}
          <button
            onClick={clearSelection}
            className="ml-auto px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
          >
            <X className="w-3 h-3 inline mr-1" />
            Clear
          </button>
        </div>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={goToPrevWeek} className="p-1.5 rounded-md hover:bg-accent/50 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {format(currentWeekStart, 'MMM d')} – {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
          </span>
          <button
            onClick={goToToday}
            className="px-2 py-0.5 text-xs font-medium bg-accent/50 rounded hover:bg-accent transition-colors"
          >
            Today
          </button>
        </div>
        <button onClick={goToNextWeek} className="p-1.5 rounded-md hover:bg-accent/50 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div
        className="flex-1 overflow-auto border border-border rounded-lg bg-card select-none"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {eventsLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid sticky top-0 z-10 bg-background border-b border-border" style={{ gridTemplateColumns: `${tzState.additional.length > 0 ? `repeat(${tzState.additional.length}, 62px) ` : ''}60px ${daySlots.map((s) => (s.type === 'dst' ? '62px' : '1fr')).join(' ')}` }}>
              {/* Additional timezone column headers */}
              {tzState.additional.map((iana) => {
                const entry = findTimezone(iana)
                const label = entry ? entry.city : iana
                const abbr = entry ? entry.abbr : ''
                const ct = getCurrentTimeInTimezone(iana)
                return (
                  <div key={`hdr-tz-${iana}`} className="p-1 text-xs text-muted-foreground text-center border-r border-border/50 flex flex-col items-center justify-between">
                    <span className="text-[9px] font-semibold opacity-60 truncate max-w-full">{label}</span>
                    <span className="text-[9px] opacity-50">{abbr}</span>
                    <span className="font-mono tabular-nums text-[10px]">
                      {ct.split(':')[0]}<span style={{ animation: 'blink-colon 1s step-start infinite' }}>:</span>{ct.split(':')[1]}
                    </span>
                  </div>
                )
              })}
              {/* Primary timezone column header */}
              {(() => {
                const isUtc = tzState.primary === 'UTC'
                const entry = findTimezone(tzState.primary)
                const label = isUtc ? 'UTC' : (entry ? entry.city : tzState.primary)
                const abbr = isUtc ? '' : (entry ? entry.abbr : '')
                const ct = isUtc
                  ? `${utcNow.getUTCHours().toString().padStart(2, '0')}:${utcNow.getUTCMinutes().toString().padStart(2, '0')}`
                  : getCurrentTimeInTimezone(tzState.primary)
                return (
                  <div className="p-2 text-xs text-blue-600 dark:text-blue-400 font-medium border-r border-border flex flex-col items-end justify-between">
                    <span className="text-[10px] font-bold">{label}</span>
                    {abbr && <span className="text-[9px] opacity-70">{abbr}</span>}
                    <style>{`@keyframes blink-colon { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }`}</style>
                    <span className="font-mono tabular-nums font-semibold">
                      {ct.split(':')[0]}<span style={{ animation: 'blink-colon 1s step-start infinite' }}>:</span>{ct.split(':')[1]}
                    </span>
                  </div>
                )
              })()}
              {daySlots.map((slot, slotIdx) => {
                if (slot.type === 'dst') {
                  const t = slot.transition
                  const entry = findTimezone(t.iana)
                  const city = entry ? entry.city : t.iana
                  const offsetBefore = t.offsetBefore >= 0 ? `+${t.offsetBefore / 60}` : `${t.offsetBefore / 60}`
                  const offsetAfter = t.offsetAfter >= 0 ? `+${t.offsetAfter / 60}` : `${t.offsetAfter / 60}`
                  return (
                    <div key={`day-dst-hdr-${t.iana}-${slotIdx}`} className="p-1 text-center border-l border-amber-400 bg-amber-50/60 dark:bg-amber-950/30 flex flex-col items-center justify-center">
                      <span className="text-[8px] font-semibold text-amber-700 dark:text-amber-300 truncate max-w-full">{city}</span>
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">GMT</span>
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">{offsetBefore} to {offsetAfter}</span>
                    </div>
                  )
                }
                const day = slot.day
                const isToday = isSameDay(day, new Date())
                return (
                  <div
                    key={day.toISOString()}
                    className={`p-2 text-center text-xs font-medium border-r border-border last:border-r-0 ${
                      isToday ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' : 'text-muted-foreground'
                    }`}
                  >
                    <div>{format(day, 'EEE')}</div>
                    <div className={`text-lg font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Time slots + events overlay */}
            <div style={{ position: 'relative' }}>
              {/* Grid background rows */}
              {timeSlots.map((time) => (
                <div
                  key={time}
                  className="grid border-b border-border last:border-b-0"
                  style={{ gridTemplateColumns: `${tzState.additional.length > 0 ? `repeat(${tzState.additional.length}, 62px) ` : ''}60px ${daySlots.map((s) => (s.type === 'dst' ? '62px' : '1fr')).join(' ')}`, height: SLOT_HEIGHT }}
                >
                  {/* Additional timezone time labels */}
                  {tzState.additional.map((iana) => (
                    <div key={`tz-${iana}-${time}`} className="p-1 text-[10px] text-muted-foreground text-center border-r border-border/50 font-mono tabular-nums flex items-start justify-center pt-1">
                      {convertUtcTimeToTimezone(time, iana)}
                    </div>
                  ))}
                  {/* Primary timezone time label */}
                  <div className="p-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold font-mono tabular-nums border-r border-border flex items-start justify-end pr-2 pt-1">
                    {formatTimeLabel(time)}
                  </div>
                  {daySlots.map((slot, slotIdx) => {
                    if (slot.type === 'dst') {
                      const t = slot.transition
                      const dstTime = convertUtcTimeToTimezoneOnDate(time, t.iana, weekDays[t.transitionDayIndex])
                      const beforeDay = t.transitionDayIndex > 0 ? weekDays[t.transitionDayIndex - 1] : weekDays[0]
                      const beforeTime = convertUtcTimeToTimezoneOnDate(time, t.iana, beforeDay)
                      const isChanged = dstTime !== beforeTime
                      return (
                        <div key={`dst-${t.iana}-${time}-${slotIdx}`} className={`p-1 text-[10px] text-center border-l border-amber-400 font-mono tabular-nums flex items-start justify-center pt-1 ${
                          isChanged
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 font-semibold'
                            : 'text-muted-foreground/40'
                        }`}>
                          {dstTime}
                        </div>
                      )
                    }
                    const day = slot.day
                    const isToday = isSameDay(day, new Date())
                    const cellId = getCellId(day, time)
                    const isSelected = selectedCells.has(cellId)
                    return (
                      <div
                        key={slot.dayIdx}
                        onMouseDown={(e) => { e.preventDefault(); handleCellMouseDown(day, time) }}
                        onMouseEnter={() => handleCellMouseEnter(day, time)}
                        className={`border-r border-border last:border-r-0 cursor-crosshair ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/30 ring-1 ring-inset ring-blue-400 dark:ring-blue-600'
                            : isToday ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
                        }`}
                      />
                    )
                  })}
                </div>
              ))}

              {/* Events overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 60 + (tzState.additional.length * 62),
                  right: 0,
                  height: timeSlots.length * SLOT_HEIGHT,
                  pointerEvents: 'none',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: daySlots.map((s) => (s.type === 'dst' ? '62px' : '1fr')).join(' '), height: '100%' }}>
                  {daySlots.map((slot, slotIdx) => {
                    if (slot.type === 'dst') {
                      return <div key={`overlay-dst-${slotIdx}`} />
                    }
                    const dayIdx = slot.dayIdx
                    const { dayItems, layout } = dayLayouts[dayIdx]
                    return (
                      <div
                        key={dayIdx}
                        style={{ position: 'relative' }}
                        className="border-r border-transparent last:border-r-0"
                      >
                        {/* Event segments */}
                        {layout.eventSegments.map((seg, i) => {
                          const item = dayItems[seg.eventIndex]
                          if (!item) return null

                          if (item.kind === 'event') {
                            const ev = item.data
                            const color = getEventColor(ev)
                            return (
                              <button
                                key={`${seg.eventId}-${i}`}
                                onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); setSelectedSubMeeting(null) }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="flex flex-col items-start justify-start px-1 rounded-sm text-[10px] leading-tight transition-colors hover:opacity-80 overflow-hidden"
                                style={{
                                  position: 'absolute',
                                  top: seg.top,
                                  height: Math.max(seg.height, 4),
                                  left: `calc(${seg.leftPercent}% + 1px)`,
                                  width: `calc(${seg.widthPercent}% - 2px)`,
                                  pointerEvents: isDragging ? 'none' : 'auto',
                                  backgroundColor: `${color}20`,
                                  borderLeft: `3px solid ${color}`,
                                  color: color,
                                  zIndex: 5,
                                }}
                                title={getEventChipLabel(ev)}
                              >
                                {seg.isFirstSegment && (
                                  <>
                                    <div className="flex items-center gap-0.5 min-w-0 pt-0.5 max-w-full">
                                      {ev.is_public && <Eye className="w-2.5 h-2.5 shrink-0 text-green-500" />}
                                      <span className="block truncate font-medium min-w-0">{getEventChipLabel(ev)}</span>
                                    </div>
                                    <div className="text-[9px] opacity-70 truncate max-w-full">
                                      {formatUTC(ev.start_time, 'HH:mm')} – {formatUTC(ev.end_time, 'HH:mm')}
                                    </div>
                                  </>
                                )}
                              </button>
                            )
                          } else {
                            const m = item.data
                            return (
                              <button
                                key={`${seg.eventId}-${i}`}
                                onClick={(e) => { e.stopPropagation(); setSelectedSubMeeting(m); setSelectedEvent(null) }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="flex flex-col items-start justify-start px-1 rounded-sm text-[10px] leading-tight transition-colors hover:opacity-80 overflow-hidden"
                                style={{
                                  position: 'absolute',
                                  top: seg.top,
                                  height: Math.max(seg.height, 4),
                                  left: `calc(${seg.leftPercent}% + 1px)`,
                                  width: `calc(${seg.widthPercent}% - 2px)`,
                                  pointerEvents: isDragging ? 'none' : 'auto',
                                  backgroundColor: '#8B5CF620',
                                  borderLeft: '3px solid #8B5CF6',
                                  color: '#8B5CF6',
                                  zIndex: 5,
                                }}
                                title={getSubChipLabel(m)}
                              >
                                {seg.isFirstSegment && (
                                  <>
                                    <span className="block truncate font-medium min-w-0 pt-0.5 max-w-full">{getSubChipLabel(m)}</span>
                                    <div className="text-[9px] opacity-70 truncate max-w-full">
                                      {formatUTC(m.start_time, 'HH:mm')} – {formatUTC(m.end_time, 'HH:mm')}
                                    </div>
                                  </>
                                )}
                              </button>
                            )
                          }
                        })}

                        {/* Overflow segments (+N Meetings) */}
                        {layout.overflowSegments.map((seg, i) => {
                          const overflowItems = seg.eventIndices.map(idx => dayItems[idx]).filter(Boolean)
                          return (
                            <button
                              key={`overflow-${i}`}
                              onClick={(e) => { e.stopPropagation(); setOverflowPanelItems(overflowItems) }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="text-left px-1 rounded-sm text-[10px] leading-tight font-medium transition-colors hover:opacity-80 overflow-hidden"
                              style={{
                                position: 'absolute',
                                top: seg.top,
                                height: Math.max(seg.height, 16),
                                left: `calc(${seg.leftPercent}% + 1px)`,
                                width: `calc(${seg.widthPercent}% - 2px)`,
                                pointerEvents: isDragging ? 'none' : 'auto',
                                backgroundColor: '#6B728020',
                                borderLeft: '3px solid #6B7280',
                                color: '#6B7280',
                                zIndex: 5,
                              }}
                              title={`${seg.count} more meeting${seg.count !== 1 ? 's' : ''}`}
                            >
                              <span className="block truncate pt-0.5">+{seg.count} Meeting{seg.count !== 1 ? 's' : ''}</span>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Current Time Indicator Line */}
              {(() => {
                const position = getCurrentTimePosition()
                if (position === null) return null
                
                return (
                  <div 
                    className="absolute left-0 right-0 pointer-events-none z-[15]"
                    style={{ 
                      top: `${position}px`,
                      height: '3px',
                      background: 'linear-gradient(to right, transparent, rgba(239, 68, 68, 0.8) 60px, rgba(239, 68, 68, 0.8), transparent)',
                      boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)'
                    }}
                  >
                    <div 
                      className="absolute left-[60px] -top-1 w-2 h-2 bg-red-600 rounded-full"
                      style={{ boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)' }}
                    />
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Overflow Panel Modal */}
      {overflowPanelItems && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setOverflowPanelItems(null)}>
          <div className="bg-card text-card-foreground rounded-lg p-5 max-w-md w-full mx-4 my-4 max-h-[90vh] overflow-y-auto shadow-xl border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Overlapping Meetings</h2>
              <button onClick={() => setOverflowPanelItems(null)} className="p-1 rounded hover:bg-muted transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-auto">
              {overflowPanelItems.map(item => {
                if (item.kind === 'event') {
                  const ev = item.data
                  const color = getEventColor(ev)
                  return (
                    <button
                      key={ev.id}
                      onClick={() => { setOverflowPanelItems(null); setSelectedEvent(ev); setSelectedSubMeeting(null) }}
                      className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                      style={{ borderLeft: `4px solid ${color}` }}
                    >
                      <div className="flex items-center gap-1 font-medium text-sm" style={{ color }}>
                        {ev.is_public && <Eye className="w-3 h-3 shrink-0 text-green-500" />}
                        {ev.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatUTC(ev.start_time, 'EEE, MMM d')} · {formatUTC(ev.start_time, 'HH:mm')} – {formatUTC(ev.end_time, 'HH:mm')}
                      </div>
                    </button>
                  )
                } else {
                  const m = item.data
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setOverflowPanelItems(null); setSelectedSubMeeting(m); setSelectedEvent(null) }}
                      className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                      style={{ borderLeft: '4px solid #8B5CF6' }}
                    >
                      <div className="font-medium text-sm" style={{ color: '#8B5CF6' }}>{m.calendar_title || m.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatUTC(m.start_time, 'EEE, MMM d')} · {formatUTC(m.start_time, 'HH:mm')} – {formatUTC(m.end_time, 'HH:mm')}
                      </div>
                    </button>
                  )
                }
              })}
            </div>
          </div>
        </div>
      )}

      {/* Event Details Panel */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setSelectedEvent(null)}>
          <div className="bg-card text-card-foreground rounded-lg p-5 max-w-md w-full mx-4 my-4 max-h-[90vh] overflow-y-auto shadow-xl border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold truncate pr-4">{selectedEvent.title}</h2>
              <button onClick={() => setSelectedEvent(null)} className="p-1 rounded hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>
                  {formatUTC(selectedEvent.start_time, 'EEE, MMM d, yyyy')} ·{' '}
                  {formatUTC(selectedEvent.start_time, 'HH:mm')} –{' '}
                  {formatUTC(selectedEvent.end_time, 'HH:mm')}
                </span>
              </div>

              {selectedEvent.description && (
                <p className="text-muted-foreground text-xs whitespace-pre-wrap break-all border-l-2 border-border pl-3 py-1">
                  <LinkifyText text={selectedEvent.description} />
                </p>
              )}

              {isSafeUrl(selectedEvent.meeting_link) && (
                <div className="flex items-center gap-2">
                  <a
                    href={selectedEvent.meeting_link ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-blue-600 hover:underline text-xs min-w-0 break-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    Meeting Link
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(selectedEvent.meeting_link!); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000) }}
                    className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                    title="Copy link"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                </div>
              )}

              {selectedEvent.location && (
                <div className="text-xs text-muted-foreground">
                  <span className="mr-1">📍</span>
                  <LinkifyText text={selectedEvent.location} />
                </div>
              )}

              <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    Source network{selectedEventSourceNetworkNames.length !== 1 ? 's' : ''}: {selectedEventSourceNetworkNames[0] || MAIN_NETWORK_LABEL}
                    {selectedEventSourceNetworkNames.length > 1 ? ` +${selectedEventSourceNetworkNames.length - 1}` : ''}
                  </span>
                  {selectedEventSourceNetworkNames.length > 1 && (
                    <button
                      onClick={() => setShowEventSourceNetworks(prev => !prev)}
                      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-border hover:bg-accent/50"
                    >
                      {showEventSourceNetworks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showEventSourceNetworks ? 'Hide' : 'Show'}
                    </button>
                  )}
                </div>
                {showEventSourceNetworks && selectedEventSourceNetworkNames.length > 1 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedEventSourceNetworkNames.map(name => (
                      <span key={name} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[11px]">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Add to Calendar buttons */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
              <a
                href={buildOutlookCalendarUrl({
                  title: selectedEvent.title,
                  description: selectedEvent.description,
                  start_time: selectedEvent.start_time,
                  end_time: selectedEvent.end_time,
                  meeting_link: selectedEvent.meeting_link,
                  location: selectedEvent.location,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-[#0078d4] text-white hover:bg-[#106ebe] transition-colors"
                title="Add to Outlook Calendar"
              >
                <CalendarPlus className="w-4 h-4" />
                Outlook
              </a>
              <button
                onClick={() => downloadICSFile({
                  title: selectedEvent.title,
                  description: selectedEvent.description,
                  start_time: selectedEvent.start_time,
                  end_time: selectedEvent.end_time,
                  meeting_link: selectedEvent.meeting_link,
                  location: selectedEvent.location,
                })}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
                title="Download .ics file for Apple Calendar and others"
              >
                <Download className="w-4 h-4" />
                .ics
              </button>
              {googleOAuthSources.length === 1 ? (
                <button
                  onClick={() => handleSyncToGoogle({
                    title: selectedEvent.title, description: selectedEvent.description,
                    start_time: selectedEvent.start_time, end_time: selectedEvent.end_time,
                    meeting_link: selectedEvent.meeting_link, location: selectedEvent.location,
                  })}
                  disabled={syncingToGoogle}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  title={`Add to ${googleOAuthSources[0].display_name}`}
                >
                  <CalendarPlus className="w-4 h-4" />
                  {syncingToGoogle ? 'Syncing...' : 'Add to Google'}
                </button>
              ) : googleOAuthSources.length > 1 ? (
                <button
                  onClick={() => setShowGoogleSyncPicker({
                    title: selectedEvent.title, description: selectedEvent.description,
                    start_time: selectedEvent.start_time, end_time: selectedEvent.end_time,
                    meeting_link: selectedEvent.meeting_link, location: selectedEvent.location,
                  })}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  title="Choose which Google Calendar to add to"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Add to Google
                </button>
              ) : (
                <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedEvent.title)}&dates=${new Date(selectedEvent.start_time).toISOString().replace(/[-:]/g, '').replace(/\.\\d{3}/, '')}/${new Date(selectedEvent.end_time).toISOString().replace(/[-:]/g, '').replace(/\.\\d{3}/, '')}${selectedEvent.description ? `&details=${encodeURIComponent(selectedEvent.description)}` : ''}${selectedEvent.location ? `&location=${encodeURIComponent(selectedEvent.location)}` : selectedEvent.meeting_link ? `&location=${encodeURIComponent(selectedEvent.meeting_link)}` : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  title="Add to Google Calendar"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Google Calendar
                </a>
              )}
            </div>

            {/* Meeting page link for coordination calendar events */}
            {selectedEvent.source_type === 'coordination_calendar' && selectedEvent.external_event_id && (
              <div className="mt-2">
                <Link
                  to={`/meeting/${selectedEvent.external_event_id}`}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors w-full"
                >
                  <ExternalLink className="w-4 h-4" />
                  Meeting Page
                </Link>
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={async () => {
                  if (!selectedEvent.is_public) {
                    openPublishModal(selectedEventGroupedRows, async (ids, options) => {
                      const targetPublic = true
                      if (ids.length <= 1) {
                        const onlyEvent = selectedEventGroupedRows.find(row => row.id === ids[0])
                        if (!onlyEvent) return
                        await apiClient.put(`/api/user-events/${onlyEvent.id}`, { is_public: targetPublic })
                        setEvents(prev => prev.map(e => e.id === onlyEvent.id ? { ...e, is_public: targetPublic } : e))
                        if (selectedEvent?.id === onlyEvent.id) {
                          setSelectedEvent(prev => prev ? { ...prev, is_public: targetPublic } : null)
                        }
                      } else {
                        await apiClient.put('/api/user-events/bulk-public', { event_ids: ids, is_public: targetPublic })
                        setEvents(prev => prev.map(e => ids.includes(e.id) ? { ...e, is_public: targetPublic } : e))
                        setSelectedEvent(prev => prev ? { ...prev, is_public: targetPublic } : null)
                      }
                      const selectedRows = selectedEventGroupedRows.filter(ev => ids.includes(ev.id))
                      setAutoSyncForEvents(selectedRows, options.autoSync, options.autoPublishNew)
                    })
                    return
                  }

                  const targetPublic = false
                  const ids = selectedEventGroupedRows.map(e => e.id)
                  if (ids.length <= 1) {
                    await handleTogglePublic(selectedEvent)
                    return
                  }
                  try {
                    await apiClient.put('/api/user-events/bulk-public', { event_ids: ids, is_public: targetPublic })
                    setEvents(prev => prev.map(e => ids.includes(e.id) ? { ...e, is_public: targetPublic } : e))
                    setSelectedEvent(prev => prev ? { ...prev, is_public: targetPublic } : null)
                  } catch (err) {
                    console.error('Failed to update merged event visibility:', err)
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedEvent.is_public
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {selectedEvent.is_public ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {selectedEvent.is_public ? 'Public' : 'Private'}
              </button>
              <button
                onClick={() => {
                  setConfirmTitle('Delete Event?');
                  setConfirmMessage(selectedEventGroupedRows.length > 1
                    ? `Delete this meeting from ${selectedEventGroupedRows.length} imported sources? This cannot be undone.`
                    : 'Delete this event? This cannot be undone.');
                  setOnConfirmAction(() => async () => {
                    if (selectedEventGroupedRows.length <= 1) {
                      await handleDeleteEvent(selectedEvent.id)
                      return
                    }
                    const ids = selectedEventGroupedRows.map(e => e.id)
                    try {
                      await apiClient.delete('/api/user-events/bulk', { data: { event_ids: ids } })
                      setEvents(prev => prev.filter(e => !ids.includes(e.id)))
                      setSelectedEvent(null)
                    } catch (err) {
                      console.error('Failed to delete merged event rows:', err)
                    }
                  });
                  setConfirmOpen(true);
                }}
                className="px-3 py-2 rounded-md text-sm font-medium text-red-600 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {selectedEvent.is_public && selectedEventSyncPrefKeys.length > 0 && (
              <div className="mt-2 rounded-md border border-border bg-background/60 px-3 py-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEventAutoSyncEnabled}
                    onChange={e => setAutoSyncForEvents(selectedEventGroupedRows, e.target.checked)}
                    className="mt-0.5 accent-blue-600 w-4 h-4 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-medium text-foreground">Auto-sync this published item</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Keep this public item updated when source title/time changes or it is removed.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscribed Meeting Details */}
      {selectedSubMeeting && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setSelectedSubMeeting(null)}>
          <div className="bg-card text-card-foreground rounded-lg p-5 max-w-md w-full mx-4 my-4 max-h-[90vh] overflow-y-auto shadow-xl border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold pr-4">{selectedSubMeeting.calendar_title || selectedSubMeeting.title}</h2>
              <button onClick={() => setSelectedSubMeeting(null)} className="p-1 rounded hover:bg-muted transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>
                  {formatUTC(selectedSubMeeting.start_time, 'EEE, MMM d, yyyy')} ·{' '}
                  {formatUTC(selectedSubMeeting.start_time, 'HH:mm')} –{' '}
                  {formatUTC(selectedSubMeeting.end_time, 'HH:mm')}
                </span>
              </div>

              {selectedSubMeeting.description && (
                <p className="text-muted-foreground text-xs whitespace-pre-wrap break-all border-l-2 border-border pl-3 py-1">
                  <LinkifyText text={selectedSubMeeting.description} />
                </p>
              )}

              {isSafeUrl(selectedSubMeeting.meeting_link) && (
                <div className="flex items-center gap-2">
                  <a href={selectedSubMeeting.meeting_link ?? undefined} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-blue-600 hover:underline text-xs min-w-0 break-all">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    Meeting Link
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(selectedSubMeeting.meeting_link!); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000) }}
                    className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                    title="Copy link"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                <Bell className="w-3.5 h-3.5 shrink-0" />
                <span>Following: <a href={`/calendar/${selectedSubMeeting.calendar_hash}`} className="text-blue-600 hover:underline font-medium">{selectedSubMeeting.calendar_title}</a></span>
              </div>
            </div>

            {/* Add to Calendar buttons */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
              <a
                href={buildOutlookCalendarUrl({
                  title: selectedSubMeeting.title,
                  description: selectedSubMeeting.description,
                  start_time: selectedSubMeeting.start_time,
                  end_time: selectedSubMeeting.end_time,
                  meeting_link: selectedSubMeeting.meeting_link,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-[#0078d4] text-white hover:bg-[#106ebe] transition-colors"
                title="Add to Outlook Calendar"
              >
                <CalendarPlus className="w-4 h-4" />
                Outlook
              </a>
              <button
                onClick={() => downloadICSFile({
                  title: selectedSubMeeting.title,
                  description: selectedSubMeeting.description,
                  start_time: selectedSubMeeting.start_time,
                  end_time: selectedSubMeeting.end_time,
                  meeting_link: selectedSubMeeting.meeting_link,
                })}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
                title="Download .ics file for Apple Calendar and others"
              >
                <Download className="w-4 h-4" />
                .ics
              </button>
              {googleOAuthSources.length === 1 ? (
                <button
                  onClick={() => handleSyncToGoogle({
                    title: selectedSubMeeting.title, description: selectedSubMeeting.description,
                    start_time: selectedSubMeeting.start_time, end_time: selectedSubMeeting.end_time,
                    meeting_link: selectedSubMeeting.meeting_link,
                  })}
                  disabled={syncingToGoogle}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  title={`Add to ${googleOAuthSources[0].display_name}`}
                >
                  <CalendarPlus className="w-4 h-4" />
                  {syncingToGoogle ? 'Syncing...' : 'Add to Google'}
                </button>
              ) : googleOAuthSources.length > 1 ? (
                <button
                  onClick={() => setShowGoogleSyncPicker({
                    title: selectedSubMeeting.title, description: selectedSubMeeting.description,
                    start_time: selectedSubMeeting.start_time, end_time: selectedSubMeeting.end_time,
                    meeting_link: selectedSubMeeting.meeting_link,
                  })}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  title="Choose which Google Calendar to add to"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Add to Google
                </button>
              ) : (
                <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedSubMeeting.title)}&dates=${new Date(selectedSubMeeting.start_time).toISOString().replace(/[-:]/g, '').replace(/\.\\d{3}/, '')}/${new Date(selectedSubMeeting.end_time).toISOString().replace(/[-:]/g, '').replace(/\.\\d{3}/, '')}${selectedSubMeeting.description ? `&details=${encodeURIComponent(selectedSubMeeting.description)}` : ''}${selectedSubMeeting.meeting_link ? `&location=${encodeURIComponent(selectedSubMeeting.meeting_link)}` : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  title="Add to Google Calendar"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Google Calendar
                </a>
              )}
            </div>

            {/* Meeting page link */}
            <div className="mt-2">
              <Link
                to={`/meeting/${selectedSubMeeting.id.replace(/^sub_/, '')}`}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors w-full"
              >
                <ExternalLink className="w-4 h-4" />
                Meeting Page
              </Link>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => { handleUnsubscribe(selectedSubMeeting.calendar_hash); setSelectedSubMeeting(null) }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-red-600 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
              >
                <BellOff className="w-4 h-4" />
                Unfollow Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Calendar Source Picker Modal */}
      {showGoogleSyncPicker && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" onClick={() => { setShowGoogleSyncPicker(null); setSelectedSyncSourceIds(new Set()) }}>
          <div className="bg-card text-card-foreground rounded-lg p-5 max-w-sm w-full mx-4 my-4 max-h-[90vh] overflow-y-auto shadow-xl border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Choose Calendar</h2>
              <button onClick={() => { setShowGoogleSyncPicker(null); setSelectedSyncSourceIds(new Set()) }} className="p-1 rounded hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Select which Google Calendar(s) to add "{showGoogleSyncPicker.title}" to:</p>
            <div className="space-y-2 mb-4">
              {googleOAuthSources.map(source => (
                <label key={source.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedSyncSourceIds.has(source.id)}
                    onChange={() => setSelectedSyncSourceIds(prev => {
                      const next = new Set(prev)
                      if (next.has(source.id)) next.delete(source.id)
                      else next.add(source.id)
                      return next
                    })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: source.color }} />
                  <span className="text-sm truncate">{source.display_name}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => handleSyncToGoogle(showGoogleSyncPicker, Array.from(selectedSyncSourceIds))}
              disabled={selectedSyncSourceIds.size === 0 || syncingToGoogle}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <CalendarPlus className="w-4 h-4" />
              {syncingToGoogle ? 'Adding...' : `Add to ${selectedSyncSourceIds.size} Calendar(s)`}
            </button>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-card text-card-foreground rounded-lg p-5 max-w-md w-full mx-4 my-4 max-h-[90vh] overflow-y-auto shadow-xl border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Create Event</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Event title"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Meeting Link</label>
                <input
                  type="url"
                  value={createForm.meeting_link}
                  onChange={e => setCreateForm(p => ({ ...p, meeting_link: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={createForm.start_date}
                    onChange={e => setCreateForm(p => ({ ...p, start_date: e.target.value, end_date: p.end_date || e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    value={createForm.start_time}
                    onChange={e => setCreateForm(p => ({ ...p, start_time: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">End Date *</label>
                  <input
                    type="date"
                    value={createForm.end_date}
                    onChange={e => setCreateForm(p => ({ ...p, end_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">End Time</label>
                  <input
                    type="time"
                    value={createForm.end_time}
                    onChange={e => setCreateForm(p => ({ ...p, end_time: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={createForm.is_public}
                  onChange={e => setCreateForm(p => ({ ...p, is_public: e.target.checked }))}
                  className="rounded"
                />
                <Eye className="w-3.5 h-3.5 text-green-600" />
                Publish to Events Calendar
              </label>
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t border-border">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 px-3 py-2 text-sm font-medium bg-muted rounded-md hover:bg-muted/80">
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={!createForm.title || !createForm.start_date || !createForm.end_date}
                className="flex-1 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowImportModal(false)}>
          <div className="bg-card text-card-foreground rounded-lg p-5 max-w-lg w-full mx-4 my-4 max-h-[90vh] overflow-y-auto shadow-xl border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Import Events</h2>
              <button onClick={() => setShowImportModal(false)} className="p-1 rounded hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!importType ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-3">
                  Choose a source to import events into Your Event Calendar.
                </p>

                {/* Calendar Sources */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Connected Calendars</h3>
                  {sourcesLoading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : calendarSources.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-md">
                      No calendar sources connected. Connect Google Calendar or add a public calendar URL in Settings → Calendar.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {calendarSources.map(src => (
                        <button
                          key={src.id}
                          onClick={() => { setImportType('calendar_source'); setImportSourceId(src.id) }}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-md border border-border hover:bg-accent/50 transition-colors text-left"
                        >
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: src.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{src.display_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {src.source_type === 'google_oauth' ? src.google_email : 'Public URL'}
                            </div>
                          </div>
                          <Download className="w-4 h-4 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Coordination Calendars */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Coordination Calendars</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    Import confirmed meetings from public Coordination Calendars.
                  </p>
                  <button
                    onClick={() => { setImportType('coordination_calendar'); fetchCoordCalendars() }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-md border border-border hover:bg-accent/50 transition-colors"
                  >
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">Browse Coordination Calendars</span>
                  </button>
                </div>
              </div>
            ) : importType === 'calendar_source' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <button onClick={() => setImportType(null)} className="text-blue-600 hover:underline text-xs">← Back</button>
                  <span className="font-medium">Import from: {calendarSources.find(s => s.id === importSourceId)?.display_name}</span>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Import range (months ahead)</label>
                  <select
                    value={importMonths}
                    onChange={e => setImportMonths(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                  >
                    <option value={1}>1 month</option>
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                  </select>
                </div>

                <div className="space-y-1.5 rounded-md border border-border p-3">
                  <p className="text-xs font-medium">Import style</p>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="import-style-calendar-source"
                      checked={importSyncMode === 'once'}
                      onChange={() => setImportSyncMode('once')}
                    />
                    Import once
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="import-style-calendar-source"
                      checked={importSyncMode === 'range'}
                      onChange={() => setImportSyncMode('range')}
                    />
                    Import and keep in sync for the selected range
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="import-style-calendar-source"
                      checked={importSyncMode === 'indefinite'}
                      onChange={() => setImportSyncMode('indefinite')}
                    />
                    Keep in sync indefinitely
                  </label>
                </div>

                {importResult && (
                  <div className={`text-sm p-2 rounded-md ${importResult.startsWith('Error') ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 space-y-2' : 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400'}`}>
                    <p>{importResult}</p>
                    {importResult.includes('invalid_grant') && (
                      <Link
                        to="/settings?tab=calendar&section=connections"
                        className="inline-flex items-center gap-1 text-xs underline hover:opacity-80 transition-opacity"
                      >
                        Reconnect Google Calendar
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )}

                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="w-full px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isImporting ? 'Importing...' : importPrimaryLabel}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <button onClick={() => setImportType(null)} className="text-blue-600 hover:underline text-xs">← Back</button>
                  <span className="font-medium">Import from Coordination Calendar</span>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Search or enter calendar hash</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={coordSearch}
                      onChange={e => { setCoordSearch(e.target.value); setImportCalendarHash(e.target.value) }}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Search or paste calendar hash..."
                    />
                  </div>
                </div>

                {coordCalendars.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                    {coordCalendars
                      .filter(c => !coordSearch || c.title.toLowerCase().includes(coordSearch.toLowerCase()) || c.hash.includes(coordSearch))
                      .map(cal => (
                        <button
                          key={cal.hash}
                          onClick={() => { setImportCalendarHash(cal.hash); setCoordSearch(cal.title) }}
                          className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                            importCalendarHash === cal.hash ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800' : 'hover:bg-muted/50 border border-transparent'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{cal.title}</div>
                            <div className="text-xs text-muted-foreground">{cal.hash}</div>
                          </div>
                          {importCalendarHash === cal.hash && <Check className="w-4 h-4 text-blue-600" />}
                        </button>
                      ))}
                  </div>
                )}

                <div className="space-y-1.5 rounded-md border border-border p-3">
                  <p className="text-xs font-medium">Import style</p>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="import-style-coordination-source"
                      checked={importSyncMode === 'once'}
                      onChange={() => setImportSyncMode('once')}
                    />
                    Import once
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="import-style-coordination-source"
                      checked={importSyncMode === 'range'}
                      onChange={() => setImportSyncMode('range')}
                    />
                    Import and keep in sync for the selected range
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="import-style-coordination-source"
                      checked={importSyncMode === 'indefinite'}
                      onChange={() => setImportSyncMode('indefinite')}
                    />
                    Keep in sync indefinitely
                  </label>
                </div>

                {importResult && (
                  <div className={`text-sm p-2 rounded-md ${importResult.startsWith('Error') ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 space-y-2' : 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400'}`}>
                    <p>{importResult}</p>
                    {importResult.includes('invalid_grant') && (
                      <Link
                        to="/settings?tab=calendar&section=connections"
                        className="inline-flex items-center gap-1 text-xs underline hover:opacity-80 transition-opacity"
                      >
                        Reconnect Google Calendar
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )}

                <button
                  onClick={handleImport}
                  disabled={isImporting || !importCalendarHash}
                  className="w-full px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isImporting ? 'Importing...' : importPrimaryLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        onConfirm={() => {
          if (onConfirmAction) onConfirmAction();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
        confirmText={confirmTitle === 'Clear All Events?' ? 'Clear All' : 'Delete'}
        cancelText="Cancel"
      />

      {/* Publish Events Modal */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Publish Events</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review and select which events to make public
                </p>
              </div>
              <button
                onClick={() => setPublishModalOpen(false)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between py-1 mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {publishModalSelectedIds.size} of {publishModalEvents.length} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPublishModalSelectedIds(new Set(publishModalEvents.map(e => e.id)))}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      onClick={() => setPublishModalSelectedIds(new Set())}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Deselect all
                    </button>
                  </div>
                </div>
                {publishModalEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No events in the selected range.</p>
                ) : (
                  publishModalEvents.map(ev => (
                    <label key={ev.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={publishModalSelectedIds.has(ev.id)}
                        onChange={() => {
                          setPublishModalSelectedIds(prev => {
                            const next = new Set(prev)
                            if (next.has(ev.id)) next.delete(ev.id)
                            else next.add(ev.id)
                            return next
                          })
                        }}
                        className="mt-0.5 accent-green-600 w-4 h-4 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(ev.start_time), 'MMM d, yyyy HH:mm')} -- {format(new Date(ev.end_time), 'HH:mm')}
                        </p>
                      </div>
                      {ev.is_public && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 shrink-0">
                          already public
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-border px-5 py-4 space-y-3">
              <div className="space-y-2.5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishModalAutoSync}
                    onChange={e => setPublishModalAutoSync(e.target.checked)}
                    className="mt-0.5 accent-blue-600 w-4 h-4 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">Auto-sync updates</p>
                    <p className="text-xs text-muted-foreground">
                      When a source event changes (time, title, or is removed), the public calendar updates automatically.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishModalAutoPublishNew}
                    onChange={e => setPublishModalAutoPublishNew(e.target.checked)}
                    className="mt-0.5 accent-blue-600 w-4 h-4 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">Auto-publish new meetings</p>
                    <p className="text-xs text-muted-foreground">
                      Any new meetings arriving from the same source calendar will be published automatically.
                    </p>
                  </div>
                </label>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setPublishModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-md text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={publishModalSelectedIds.size === 0}
                  onClick={async () => {
                    if (!publishModalOnConfirm) return
                    const ids = Array.from(publishModalSelectedIds)
                    await publishModalOnConfirm(ids, {
                      autoSync: publishModalAutoSync,
                      autoPublishNew: publishModalAutoPublishNew,
                    })
                    setPublishModalOpen(false)
                  }}
                  className="flex-1 px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Publish {publishModalSelectedIds.size > 0 ? `${publishModalSelectedIds.size} event${publishModalSelectedIds.size !== 1 ? 's' : ''}` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  )
}
