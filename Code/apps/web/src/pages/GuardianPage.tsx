import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api-client'
import { getPrimaryTimezone, formatDateTimeInTimezone, formatTimeInTimezone, getTimezoneAbbr } from '../lib/timezone-data'
import GuardianTimeSeries from '../components/GuardianTimeSeries'
import GuardianActionTimeSeries from '../components/GuardianActionTimeSeries'
import GuardianSystemLog from '../components/GuardianSystemLog'
import {
  Shield, ShieldAlert, Settings, BarChart3, Copy, Check, Plus, Trash2,
  ChevronDown, ChevronRight, ChevronLeft, ToggleLeft, ToggleRight, RefreshCw,
  AlertTriangle, Eye, Clock, Users, Hash, Regex, Type, X, Upload,
  Search, Server, ChevronUp, Paperclip, Image, FileText, MessageSquare,
  Ban, Timer, MessageSquareX, History, ExternalLink, VolumeX, Gavel
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────

interface RuleGroup {
  id: string
  name: string
  description: string | null
  is_enabled: boolean
  action_delete_message: boolean
  action_timeout_member: boolean
  action_timeout_duration: number
  action_ban_member: boolean
  created_at: string
  guardian_rules: [{ count: number }]
}

interface Rule {
  id: string
  group_id: string
  pattern: string
  pattern_type: 'regex' | 'wildcard'
  description: string | null
  is_enabled: boolean
  created_at: string
}

interface FlaggedMessage {
  id: string
  guild_id: string
  guild_name: string | null
  channel_id: string
  channel_name: string | null
  message_id: string
  author_id: string
  author_username: string | null
  author_display_name: string | null
  content: string | null
  referenced_content: string | null
  matched_rule_group_name: string | null
  matched_rule_group_id: string | null
  matched_pattern: string | null
  matched_text: string | null
  source_type: string
  action_taken: string
  flagged_at: string
  edit_version?: number
  is_edit?: boolean
  deleted_at?: string | null
  deleted_by_kind?: 'bot' | 'user' | 'moderator' | 'unknown' | null
  dm_sent_at?: string | null
  dm_failure_reason?: string | null
}

interface RecentMessage {
  id: string
  guild_id: string
  guild_name?: string | null
  channel_id: string
  channel_name?: string | null
  message_id: string
  author_id: string
  author_username: string | null
  content_preview: string | null
  was_flagged: boolean
  scanned_at: string
  message_type?: string
  has_attachments?: boolean
  has_embeds?: boolean
  attachment_types?: string | null
  edit_version?: number
  is_edit?: boolean
  deleted_at?: string | null
  deleted_by_kind?: 'bot' | 'user' | 'moderator' | 'unknown' | null
}

interface Stats {
  messagesLast24h: number
  messagesLast7d: number
  messagesLast30d: number
  messagesTotal: number
  flaggedLast24h: number
  flaggedLast7d: number
  flaggedLast30d: number
  flaggedTotal: number
  uniqueUsersTotal: number
  uniqueUsers24h: number
  uniqueUsers7d: number
  uniqueUsers30d: number
  uniqueUsersFiltered: number
  flaggedByGroup: Array<{ groupId: string; groupName: string; count: number }>
}

type DateRange = '1d' | '7d' | '30d' | 'all' | 'custom'
type CustomPeriodType = 'day' | 'week' | 'month' | 'year'

interface KnownUser {
  id: string
  username: string
  display_name: string | null
}

interface ServerRole {
  id: string
  guild_id: string
  guild_name: string | null
  role_id: string
  role_name: string
  role_color: number
  role_position: number
  is_ignored: boolean
}

interface ServerData {
  guild_id: string
  guild_name: string
  roles: ServerRole[]
}

interface ServerChannel {
  id: string
  guild_id: string
  guild_name: string | null
  channel_id: string
  channel_name: string
  channel_type: number
  is_monitored: boolean
}

interface ServerChannelData {
  guild_id: string
  guild_name: string
  channels: ServerChannel[]
}

type Tab = 'dashboard' | 'configuration' | 'server-settings' | 'channel-settings'

// ─── Access Gate ──────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md text-center space-y-4 p-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Shield className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Moderator Access Required</h2>
        <p className="text-muted-foreground leading-relaxed">
          The Discord Guardian moderation dashboard is available to users with the <strong>Moderator</strong> role.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Access can be requested from the <strong>SingularityNET Ambassador Program Moderators WG</strong>.
          Once granted, you will have access to moderation dashboards and bot configurations.
        </p>
        <div className="pt-2 text-xs text-muted-foreground/60">
          If you believe you should have access, please contact a Moderators WG lead.
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────

const TAB_SLUGS: Tab[] = ['dashboard', 'configuration', 'server-settings', 'channel-settings']

export default function GuardianPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  const activeTab: Tab = tabParam && TAB_SLUGS.includes(tabParam) ? tabParam : 'dashboard'

  const setActiveTab = useCallback((tab: Tab) => {
    if (tab === 'dashboard') {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab }, { replace: true })
    }
  }, [setSearchParams])

  useEffect(() => {
    if (!isAuthenticated) return
    apiClient.get('/api/guardian/access')
      .then(res => setHasAccess(res.data.isModerator))
      .catch(() => setHasAccess(false))
  }, [isAuthenticated])

  if (authLoading || hasAccess === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated || !hasAccess) {
    return <AccessDenied />
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
            <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Discord Guardian</h1>
            <p className="text-sm text-muted-foreground">Message scanning & moderation dashboard</p>
          </div>
        </div>
        <button
          onClick={async () => {
            try {
              const res = await apiClient.get('/api/guardian/bot-invite')
              if (res.data?.url && /^https:\/\//i.test(res.data.url)) {
                window.open(res.data.url, '_blank', 'noopener')
              }
            } catch (err) {
              console.error('Failed to get invite URL:', err)
              alert('Could not generate bot invite link. The Guardian bot client ID may not be configured on the server.')
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Invite Bot to Server
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'dashboard'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('configuration')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'configuration'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <Settings className="h-4 w-4" />
          Configuration
        </button>
        <button
          onClick={() => setActiveTab('server-settings')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'server-settings'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <Server className="h-4 w-4" />
          Server Settings
        </button>
        <button
          onClick={() => setActiveTab('channel-settings')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'channel-settings'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <Hash className="h-4 w-4" />
          Channel Settings
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' ? <DashboardTab /> : activeTab === 'configuration' ? <ConfigurationTab /> : activeTab === 'server-settings' ? <ServerSettingsTab /> : <ChannelSettingsTab />}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Render moderation action icons for the Flagged Messages table.
 * `actionTaken` is a comma-separated string like
 * "flagged,deleted,timeout,banned" produced by the guardian bot.
 */
function ActionIcons({ actionTaken }: { actionTaken: string | null | undefined }) {
  const tokens = (actionTaken || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  const wasDeleted = tokens.includes('deleted')
  const wasMuted = tokens.includes('timeout') || tokens.includes('mute') || tokens.includes('muted')
  const wasBanned = tokens.includes('banned') || tokens.includes('ban')

  if (!wasDeleted && !wasMuted && !wasBanned) {
    return (
      <span
        className="inline-flex items-center text-[10px] text-muted-foreground italic px-1"
        title="Flagged only -- no automatic action taken. Pending moderator review."
      >
        flag only
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-1">
      {wasDeleted && (
        <span title="Message was deleted by the bot">
          <Trash2 className="h-3.5 w-3.5 text-amber-500" />
        </span>
      )}
      {wasMuted && (
        <span title="User was temporarily muted (Discord timeout)">
          <VolumeX className="h-3.5 w-3.5 text-yellow-500" />
        </span>
      )}
      {wasBanned && (
        <span title="User was banned from the server" className="relative inline-flex items-center">
          <VolumeX className="h-3.5 w-3.5 text-red-500 opacity-60" />
          <Gavel className="h-3 w-3 text-red-600 -ml-1.5" />
        </span>
      )}
    </div>
  )
}

/** Highlight matched text in red within content */
function HighlightedContent({ content, matchedText }: { content: string; matchedText: string | null }) {
  if (!matchedText || !content) return <span>{content}</span>

  try {
    const escaped = matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    const parts = content.split(regex)

    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part)
            ? <span key={i} className="text-red-600 dark:text-red-400 font-semibold bg-red-50 dark:bg-red-950/40 px-0.5 rounded">{part}</span>
            : <span key={i}>{part}</span>
        )}
      </span>
    )
  } catch {
    return <span>{content}</span>
  }
}

function getNoContentReason(msg: FlaggedMessage): { display: string; tooltip: string } | null {
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
  const shorten = (value: string, max = 90) => value.length > max ? `${value.slice(0, max)}...` : value

  const matchedText = msg.matched_text ? normalize(msg.matched_text) : ''
  if (matchedText) {
    return {
      display: `(matched: ${shorten(matchedText)})`,
      tooltip: `Matched content: ${matchedText}`,
    }
  }

  const matchedPattern = msg.matched_pattern ? normalize(msg.matched_pattern) : ''
  if (matchedPattern) {
    return {
      display: `(pattern: ${shorten(matchedPattern)})`,
      tooltip: `Matched pattern: ${matchedPattern}`,
    }
  }

  return null
}

/** Format lastRefresh as smart relative text: "Today 2:34 PM EST" / "Yesterday ..." / "Apr 14 ..." + "Xh ago" */
function formatSmartLastUpdated(date: Date): string {
  const tz = getPrimaryTimezone()
  const abbr = getTimezoneAbbr(tz)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  const diffM = Math.floor(diffMs / (1000 * 60))

  // Format the time portion
  const timePart = formatTimeInTimezone(date, tz)

  // Determine day label in the user's timezone
  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'short', day: 'numeric' })
  const todayStr = dayFmt.format(now)
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const yesterdayStr = dayFmt.format(yesterdayDate)
  const dateStr = dayFmt.format(date)

  let dayLabel: string
  if (dateStr === todayStr) dayLabel = 'Today'
  else if (dateStr === yesterdayStr) dayLabel = 'Yesterday'
  else dayLabel = dateStr

  // Relative portion (up to 24h)
  let relative = ''
  if (diffMs >= 0 && diffH < 24) {
    if (diffM < 1) relative = ' (just now)'
    else if (diffM < 60) relative = ` (${diffM}m ago)`
    else relative = ` (${diffH}h ago)`
  }

  return `${dayLabel} ${timePart} ${abbr}${relative}`
}

function PaginationControls({ page, totalPages, onPageChange, position = 'bottom' }: { page: number; totalPages: number; onPageChange: (p: number) => void; position?: 'top' | 'bottom' }) {
  const [jumpInput, setJumpInput] = useState('')
  if (totalPages <= 1) return null

  const handleJump = () => {
    const target = parseInt(jumpInput, 10)
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target)
      setJumpInput('')
    }
  }

  const borderCls = position === 'top' ? 'border-b border-border' : 'border-t border-border'
  return (
    <div className={`flex items-center justify-between px-4 py-2 ${borderCls}`}>
      <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="px-1.5 py-1 rounded border border-border text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors text-[10px] font-medium"
          title="First page"
        >
          1
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded border border-border text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded border border-border text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        {totalPages > 3 && (
          <form onSubmit={e => { e.preventDefault(); handleJump() }} className="flex items-center gap-1 ml-1">
            <input
              type="text"
              inputMode="numeric"
              value={jumpInput}
              onChange={e => setJumpInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="#"
              className="w-10 px-1.5 py-1 text-[10px] bg-background border border-border rounded text-center focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!jumpInput}
              className="px-1.5 py-1 rounded border border-border text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors text-[10px] font-medium"
            >
              Go
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard Tab ────────────────────────────────────────────────────

function DashboardTab() {
  // Refs for charts and system log
  const timeSeriesRef = useRef<{ refresh: () => Promise<void> } | null>(null)
  const actionSeriesRef = useRef<{ refresh: () => Promise<void> } | null>(null)
  const systemLogRef = useRef<{ refresh: () => Promise<void> } | null>(null)

  const [stats, setStats] = useState<Stats | null>(null)
  const [flagged, setFlagged] = useState<FlaggedMessage[]>([])
  const [flaggedTotal, setFlaggedTotal] = useState(0)
  const [recent, setRecent] = useState<RecentMessage[]>([])
  const [recentTotal, setRecentTotal] = useState(0)

  // Shared filters (apply to both tables)
  const [filterGroup, setFilterGroup] = useState<string>('')
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [filterMode, setFilterMode] = useState<'include' | 'exclude'>('include')
  const [customPeriodNumber, setCustomPeriodNumber] = useState<number>(2)
  const [customPeriodType, setCustomPeriodType] = useState<CustomPeriodType>('week')

  // Compute From/To dates for a given period
  const computeDateRange = (
    range: DateRange,
    customNumber: number = customPeriodNumber,
    customType: CustomPeriodType = customPeriodType,
  ): { since: string; until: string } => {
    const today = new Date()
    const until = today.toISOString().slice(0, 10)
    if (range === 'all') return { since: '', until: '' }
    const from = new Date(today)
    if (range === 'custom') {
      const n = Math.max(1, Math.min(99, Math.floor(customNumber || 1)))
      if (customType === 'day') from.setDate(from.getDate() - n)
      else if (customType === 'week') from.setDate(from.getDate() - n * 7)
      else if (customType === 'month') from.setMonth(from.getMonth() - n)
      else if (customType === 'year') from.setFullYear(from.getFullYear() - n)
    } else {
      const days = range === '1d' ? 1 : range === '7d' ? 7 : 30
      from.setDate(from.getDate() - days)
    }
    return { since: from.toISOString().slice(0, 10), until }
  }

  const initialRange = computeDateRange('custom', 2, 'week')
  const [filterSince, setFilterSince] = useState<string>(initialRange.since)
  const [filterUntil, setFilterUntil] = useState<string>(initialRange.until)
  const [dateRange, setDateRange] = useState<DateRange>('custom')
  const [userSearch, setUserSearch] = useState('')
  const [showUserPicker, setShowUserPicker] = useState(false)
  const userPickerRef = useRef<HTMLDivElement>(null)

  const [groups, setGroups] = useState<RuleGroup[]>([])
  const [knownUsers, setKnownUsers] = useState<KnownUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Flagged messages: expandable, default 5
  const [flaggedPage, setFlaggedPage] = useState(1)
  const [flaggedPageSize, setFlaggedPageSize] = useState(5)
  const [flaggedExpanded, setFlaggedExpanded] = useState(true)

  // Recent messages: expandable, default 20
  const [recentPage, setRecentPage] = useState(1)
  const [recentPageSize, setRecentPageSize] = useState(20)
  const [recentExpanded, setRecentExpanded] = useState(false)

  // Edit history expansion
  // Tracks which message_id rows have their "all versions" highlight active (keyed by `${type}:${messageId}`).
  const [expandedEditHistory, setExpandedEditHistory] = useState<Record<string, boolean>>({})

  // Row content expansion (click to show full text)
  const [expandedFlaggedRows, setExpandedFlaggedRows] = useState<Set<string>>(new Set())
  const [expandedRecentRows, setExpandedRecentRows] = useState<Set<string>>(new Set())

  const toggleFlaggedRow = (id: string) => {
    setExpandedFlaggedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleRecentRow = (id: string) => {
    setExpandedRecentRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Close user picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setShowUserPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Build query params for filters (without pagination -- pagination passed as args)
  const buildFilterParams = useCallback((pageSize: number, page: number, _dateField: 'flagged_at' | 'scanned_at') => {
    const params = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) })
    if (filterGroup) params.set('group_id', filterGroup)
    if (selectedUsers.size > 0) {
      params.set('author_ids', Array.from(selectedUsers).join(','))
      params.set('filter_mode', filterMode)
    }
    if (filterSince) params.set('since', new Date(filterSince).toISOString())
    if (filterUntil) params.set('until', new Date(filterUntil + 'T23:59:59').toISOString())
    return params
  }, [filterGroup, selectedUsers, filterMode, filterSince, filterUntil])

  // Build stats filter params (for unique users filtered metric)
  const buildStatsFilterParams = useCallback(() => {
    const params = new URLSearchParams()
    if (filterGroup) params.set('group_id', filterGroup)
    if (selectedUsers.size > 0) {
      params.set('author_ids', Array.from(selectedUsers).join(','))
      params.set('filter_mode', filterMode)
    }
    if (filterSince) params.set('since', new Date(filterSince).toISOString())
    if (filterUntil) params.set('until', new Date(filterUntil + 'T23:59:59').toISOString())
    return params
  }, [filterGroup, selectedUsers, filterMode, filterSince, filterUntil])

  // Load static data (groups, users) -- only on mount and manual refresh
  const loadStaticData = useCallback(async () => {
    try {
      const [groupsRes, usersRes] = await Promise.all([
        apiClient.get('/api/guardian/rule-groups'),
        apiClient.get('/api/guardian/users'),
      ])
      setGroups(groupsRes.data.groups)
      setKnownUsers(usersRes.data.users)
    } catch (err) {
      console.error('Failed to load static data:', err)
    }
  }, [])

  // Load stats (reloads when filters change)
  const loadStats = useCallback(async () => {
    try {
      const statsParams = buildStatsFilterParams()
      const qs = statsParams.toString()
      const statsRes = await apiClient.get(`/api/guardian/stats${qs ? `?${qs}` : ''}`)
      setStats(statsRes.data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }, [buildStatsFilterParams])

  // Load flagged table -- accepts page args so callback only changes on filter change
  const loadFlaggedPage = useCallback(async (page: number, pageSize: number) => {
    try {
      const flaggedParams = buildFilterParams(pageSize, page, 'flagged_at')
      flaggedParams.set('skip_count', '1')
      // Fire data query immediately, count query in background
      const dataPromise = apiClient.get(`/api/guardian/flagged?${flaggedParams}`)
      const countParams = buildFilterParams(pageSize, page, 'flagged_at')
      countParams.set('count_only', '1')
      const countPromise = apiClient.get(`/api/guardian/flagged?${countParams}`)

      const flaggedRes = await dataPromise
      setFlagged(flaggedRes.data.flagged)
      // If server returned total (no skip_count support), use it
      if (flaggedRes.data.total != null) setFlaggedTotal(flaggedRes.data.total)

      // Count arrives async -- update total when ready
      countPromise.then(res => { if (res.data.total != null) setFlaggedTotal(res.data.total) }).catch(() => {})
    } catch (err) {
      console.error('Failed to load flagged messages:', err)
    }
  }, [buildFilterParams])

  // Load recent table -- accepts page args so callback only changes on filter change
  const loadRecentPage = useCallback(async (page: number, pageSize: number) => {
    try {
      const recentParams = buildFilterParams(pageSize, page, 'scanned_at')
      recentParams.set('skip_count', '1')
      const dataPromise = apiClient.get(`/api/guardian/recent?${recentParams}`)
      const countParams = buildFilterParams(pageSize, page, 'scanned_at')
      countParams.set('count_only', '1')
      const countPromise = apiClient.get(`/api/guardian/recent?${countParams}`)

      const recentRes = await dataPromise
      setRecent(recentRes.data.messages)
      if (recentRes.data.total != null) setRecentTotal(recentRes.data.total)

      countPromise.then(res => { if (res.data.total != null) setRecentTotal(res.data.total) }).catch(() => {})
    } catch (err) {
      console.error('Failed to load recent messages:', err)
    }
  }, [buildFilterParams])

  // Full reload -- used on mount and manual refresh
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      await Promise.all([loadStaticData(), loadStats(), loadFlaggedPage(flaggedPage, flaggedPageSize), loadRecentPage(recentPage, recentPageSize)])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadStaticData, loadStats, loadFlaggedPage, loadRecentPage, flaggedPage, flaggedPageSize, recentPage, recentPageSize])

  // Sequential refresh starting from the user's chosen section. The clicked
  // section refreshes first (priority), then the rest of the page follows in
  // the natural top-to-bottom order. Each step enforces a minimum 1.5s
  // loading animation so the user always sees the spinner.
  type RefreshSection = 'flagged' | 'recent' | 'stats' | 'timeseries' | 'actionseries' | 'systemlog'
  const refreshFrom = useCallback(async (start: RefreshSection) => {
    setRefreshing(true)
    const minDelay = (p: Promise<unknown>, ms: number) =>
      Promise.all([p, new Promise(res => setTimeout(res, ms))])
    const steps: Record<RefreshSection, () => Promise<unknown>> = {
      flagged: () => loadFlaggedPage(flaggedPage, flaggedPageSize),
      recent: () => loadRecentPage(recentPage, recentPageSize),
      stats: () => loadStats(),
      timeseries: () => timeSeriesRef.current?.refresh?.() ?? Promise.resolve(),
      actionseries: () => actionSeriesRef.current?.refresh?.() ?? Promise.resolve(),
      systemlog: () => systemLogRef.current?.refresh?.() ?? Promise.resolve(),
    }
    // Natural page order (top to bottom)
    const order: RefreshSection[] = ['stats', 'timeseries', 'actionseries', 'systemlog', 'flagged', 'recent']
    const queue: RefreshSection[] = [start, ...order.filter(s => s !== start)]
    try {
      for (const section of queue) {
        await minDelay(steps[section](), 1500)
      }
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Failed to refresh dashboard data:', err)
    } finally {
      setRefreshing(false)
    }
  }, [loadFlaggedPage, flaggedPage, flaggedPageSize, loadRecentPage, recentPage, recentPageSize, loadStats])

  // "Refresh Now" -- starts from flagged messages (most important table).
  const refreshAll = useCallback(() => refreshFrom('flagged'), [refreshFrom])

  // Initial full load
  const loadCountRef = useRef(0)
  useEffect(() => {
    if (loadCountRef.current === 0) {
      loadCountRef.current = 1
      loadData()
    }
  }, [loadData])

  // Reload only flagged table when page/size changes (after initial load)
  const prevFlaggedRef = useRef({ page: flaggedPage, size: flaggedPageSize })
  useEffect(() => {
    if (loadCountRef.current < 1) return
    if (prevFlaggedRef.current.page === flaggedPage && prevFlaggedRef.current.size === flaggedPageSize) return
    prevFlaggedRef.current = { page: flaggedPage, size: flaggedPageSize }
    loadFlaggedPage(flaggedPage, flaggedPageSize)
  }, [flaggedPage, flaggedPageSize, loadFlaggedPage])

  // Reload only recent table when page/size changes (after initial load)
  const prevRecentRef = useRef({ page: recentPage, size: recentPageSize })
  useEffect(() => {
    if (loadCountRef.current < 1) return
    if (prevRecentRef.current.page === recentPage && prevRecentRef.current.size === recentPageSize) return
    prevRecentRef.current = { page: recentPage, size: recentPageSize }
    loadRecentPage(recentPage, recentPageSize)
  }, [recentPage, recentPageSize, loadRecentPage])

  // Reload stats + tables when filters change (after initial load)
  const prevBuildFilterRef = useRef(buildFilterParams)
  useEffect(() => {
    if (loadCountRef.current < 1) return
    if (prevBuildFilterRef.current === buildFilterParams) return
    prevBuildFilterRef.current = buildFilterParams
    // Filters changed -- reload everything except static data
    Promise.all([
      loadStats(),
      loadFlaggedPage(flaggedPage, flaggedPageSize),
      loadRecentPage(recentPage, recentPageSize),
    ]).then(() => setLastRefresh(new Date()))
  }, [buildFilterParams, loadStats, loadFlaggedPage, loadRecentPage, flaggedPage, flaggedPageSize, recentPage, recentPageSize])

  // Reset pages when filters change
  useEffect(() => { setFlaggedPage(1) }, [filterGroup, selectedUsers, filterMode, filterSince, filterUntil])
  useEffect(() => { setRecentPage(1) }, [filterGroup, selectedUsers, filterMode, filterSince, filterUntil])

  // Filtered user list for picker
  const filteredPickerUsers = useMemo(() => {
    if (!userSearch.trim()) return knownUsers
    const q = userSearch.toLowerCase()
    return knownUsers.filter(u =>
      u.username.toLowerCase().includes(q) ||
      (u.display_name && u.display_name.toLowerCase().includes(q))
    )
  }, [knownUsers, userSearch])

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Guardian detection timestamps are recorded in UTC -- always render them in UTC
  // so operators see the same wall-clock time the rule engine logged.
  const formatTime = (iso: string) => {
    return formatDateTimeInTimezone(iso, 'UTC')
  }

  const toggleEditHistory = (messageId: string, type: 'recent' | 'flagged') => {
    // Each version already has its own row -- toggle just highlights all rows
    // sharing this message_id so an operator can spot related versions at a glance.
    const key = `${type}:${messageId}`
    setExpandedEditHistory(prev => {
      const n = { ...prev }
      if (n[key]) {
        delete n[key]
      } else {
        n[key] = true
      }
      return n
    })
  }

  const flaggedTotalPages = Math.max(1, Math.ceil(flaggedTotal / flaggedPageSize))
  const recentTotalPages = Math.max(1, Math.ceil(recentTotal / recentPageSize))

  const hasActiveFilters = !!(filterGroup || selectedUsers.size > 0 || filterSince || filterUntil)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Live Status Bar */}
      <div className="flex items-center justify-end bg-card border border-border rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              {formatSmartLastUpdated(lastRefresh)}
            </span>
          )}
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Shared Filters */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Filters <span className="text-muted-foreground font-normal">(apply to stats &amp; both tables)</span></h3>

        {/* Date range quick filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Period:</span>
          {([
            { key: '1d' as DateRange, label: '1 Day' },
            { key: '7d' as DateRange, label: '1 Week' },
            { key: '30d' as DateRange, label: '1 Month' },
            { key: 'all' as DateRange, label: 'All' },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => {
                setDateRange(f.key)
                const { since, until } = computeDateRange(f.key)
                setFilterSince(since)
                setFilterUntil(until)
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                dateRange === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-accent/50'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => {
              setDateRange('custom')
              const { since, until } = computeDateRange('custom', customPeriodNumber, customPeriodType)
              setFilterSince(since)
              setFilterUntil(until)
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              dateRange === 'custom'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-accent/50'
            }`}
          >
            Custom
          </button>
          <input
            type="number"
            min={1}
            max={99}
            value={customPeriodNumber}
            onChange={(e) => {
              const raw = parseInt(e.target.value, 10)
              const next = Number.isFinite(raw) ? Math.max(1, Math.min(99, raw)) : 1
              setCustomPeriodNumber(next)
              setDateRange('custom')
              const { since, until } = computeDateRange('custom', next, customPeriodType)
              setFilterSince(since)
              setFilterUntil(until)
            }}
            className={`w-16 px-2 py-1.5 text-xs rounded-md border bg-background text-foreground transition-colors ${
              dateRange === 'custom' ? 'border-primary' : 'border-border'
            }`}
          />
          <select
            value={customPeriodType}
            onChange={(e) => {
              const next = e.target.value as CustomPeriodType
              setCustomPeriodType(next)
              setDateRange('custom')
              const { since, until } = computeDateRange('custom', customPeriodNumber, next)
              setFilterSince(since)
              setFilterUntil(until)
            }}
            className={`px-2 py-1.5 text-xs rounded-md border bg-background text-foreground transition-colors ${
              dateRange === 'custom' ? 'border-primary' : 'border-border'
            }`}
          >
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
            <option value="year">year</option>
          </select>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <label className="text-xs text-muted-foreground">From:</label>
          <input
            type="date"
            value={filterSince}
            onChange={e => setFilterSince(e.target.value)}
            className="px-2 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <label className="text-xs text-muted-foreground">To:</label>
          <input
            type="date"
            value={filterUntil}
            onChange={e => setFilterUntil(e.target.value)}
            className="px-2 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Category filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Category:</label>
            <select
              value={filterGroup}
              onChange={e => setFilterGroup(e.target.value)}
              className="px-2 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-w-[160px]"
            >
              <option value="">All categories</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* User search box with checklist */}
          <div className="flex items-center gap-2 relative" ref={userPickerRef}>
            <label className="text-xs text-muted-foreground">Users:</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setShowUserPicker(true) }}
                onFocus={() => setShowUserPicker(true)}
                placeholder={selectedUsers.size > 0 ? `${selectedUsers.size} selected` : 'Search users...'}
                className="pl-7 pr-2 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
              />
              {showUserPicker && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-hidden">
                  {/* Include/Exclude toggle */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-accent/30">
                    <span className="text-xs text-muted-foreground">Mode:</span>
                    <button
                      onClick={() => setFilterMode('include')}
                      className={`px-2 py-0.5 text-xs rounded ${filterMode === 'include' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Show only
                    </button>
                    <button
                      onClick={() => setFilterMode('exclude')}
                      className={`px-2 py-0.5 text-xs rounded ${filterMode === 'exclude' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Hide selected
                    </button>
                    {selectedUsers.size > 0 && (
                      <button onClick={() => setSelectedUsers(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto max-h-48">
                    {filteredPickerUsers.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-muted-foreground text-center">No users found</div>
                    ) : (
                      filteredPickerUsers.map(u => (
                        <button
                          key={u.id}
                          onClick={() => toggleUserSelection(u.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/50 transition-colors"
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                            selectedUsers.has(u.id)
                              ? filterMode === 'exclude'
                                ? 'bg-red-500 border-red-500 text-white'
                                : 'bg-primary border-primary text-white'
                              : 'border-border'
                          }`}>
                            {selectedUsers.has(u.id) && <Check className="h-2.5 w-2.5" />}
                          </div>
                          <span className="font-medium text-foreground truncate">{u.display_name || u.username}</span>
                          {u.display_name && <span className="text-muted-foreground truncate">({u.username})</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Selected user chips */}
            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${filterMode === 'exclude' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
                  {filterMode === 'exclude' ? 'Hiding' : 'Showing'} {selectedUsers.size}
                </span>
              </div>
            )}
          </div>

          {/* Clear all filters */}
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterGroup(''); setSelectedUsers(new Set()); setFilterSince(''); setFilterUntil(''); setUserSearch('') }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded border border-border hover:bg-accent transition-colors"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>

        {/* Category chips */}
        {stats && stats.flaggedByGroup.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {stats.flaggedByGroup.map(g => (
              <button
                key={g.groupId}
                onClick={() => setFilterGroup(prev => prev === g.groupId ? '' : g.groupId)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterGroup === g.groupId
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {g.groupName}: {g.count}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard icon={<Eye className="h-5 w-5" />} label="Messages Scanned" value={
            dateRange === '1d' ? stats.messagesLast24h :
            dateRange === '7d' ? stats.messagesLast7d :
            dateRange === '30d' ? stats.messagesLast30d :
            stats.messagesTotal
          } />
          <StatCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />} label="Flagged" value={
            dateRange === '1d' ? stats.flaggedLast24h :
            dateRange === '7d' ? stats.flaggedLast7d :
            dateRange === '30d' ? stats.flaggedLast30d :
            stats.flaggedTotal
          } accent />
          <StatCard icon={<Users className="h-5 w-5 text-orange-500" />} label="Users Flagged" value={
            stats.uniqueUsersFiltered != null ? stats.uniqueUsersFiltered :
            dateRange === '1d' ? (stats.uniqueUsers24h ?? stats.uniqueUsersTotal) :
            dateRange === '7d' ? (stats.uniqueUsers7d ?? stats.uniqueUsersTotal) :
            dateRange === '30d' ? (stats.uniqueUsers30d ?? stats.uniqueUsersTotal) :
            stats.uniqueUsersTotal
          } accent />
        </div>
      )}

      {/* Timeseries Chart */}
      <GuardianTimeSeries ref={timeSeriesRef} dateRange={dateRange} filterSince={filterSince} filterUntil={filterUntil} />

      {/* Moderation Actions Chart -- per-action breakdown from guardian_action_log */}
      <GuardianActionTimeSeries ref={actionSeriesRef} dateRange={dateRange} filterSince={filterSince} filterUntil={filterUntil} />

      {/* System Log -- collapsible panel of failed bot actions (default collapsed) */}
      <GuardianSystemLog
        ref={systemLogRef}
        onRefreshAll={() => refreshFrom('systemlog')}
        externalLoading={refreshing}
      />

      {/* Flagged Messages — Expandable Table */}
      <div className="bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <button
            onClick={() => setFlaggedExpanded(!flaggedExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            {flaggedExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <ShieldAlert className="h-4 w-4 text-red-500" />
            Flagged Messages
            <span className="text-muted-foreground font-normal">({flaggedTotal})</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">Show:</label>
              <select
                value={flaggedPageSize}
                onChange={e => { setFlaggedPageSize(Number(e.target.value)); setFlaggedPage(1) }}
                className="px-1.5 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {[5, 10, 20, 30, 50].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <button onClick={refreshAll} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {flaggedExpanded && (
          <>
            <PaginationControls page={flaggedPage} totalPages={flaggedTotalPages} onPageChange={setFlaggedPage} position="top" />
            {flagged.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No flagged messages {hasActiveFilters ? 'matching filters' : 'yet'}
              </div>
            ) : (
              <div className="overflow-x-hidden">
                <table className="w-full text-xs table-fixed">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[170px]">Time (UTC)</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[100px]">Server</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[110px]">Channel</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[100px]">User</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground whitespace-nowrap w-[80px]">Copy User</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Content</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[70px]">Source</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[130px]">Rule Group</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap w-[110px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {flagged.map(msg => {
                      const historyKey = `flagged:${msg.message_id}`
                      const historyActive = !!expandedEditHistory[historyKey]
                      const hasEdits = msg.is_edit || (msg.edit_version && msg.edit_version > 1)
                      const noContentReason = getNoContentReason(msg)
                      return (
                        <React.Fragment key={msg.id}>
                          <tr
                            onClick={() => toggleFlaggedRow(msg.id)}
                            className={`hover:bg-accent/30 transition-colors cursor-pointer ${historyActive ? 'bg-primary/5' : ''}`}
                          >
                            <td className="px-3 py-2 text-muted-foreground">
                              <div className="flex items-center gap-1 truncate">
                                {formatTime(msg.flagged_at)}
                                {msg.deleted_at && (
                                  <span
                                    className="px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[9px] font-medium shrink-0"
                                    title={`Deleted ${formatTime(msg.deleted_at)} by ${msg.deleted_by_kind || 'unknown'}`}
                                  >
                                    deleted{msg.deleted_by_kind ? ` (${msg.deleted_by_kind})` : ''}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground truncate">{msg.guild_name || '-'}</td>
                            <td className="px-3 py-2 truncate">
                              <a
                                href={`https://discord.com/channels/${msg.guild_id}/${msg.channel_id}/${msg.message_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                                title="Open message in Discord"
                              >
                                #{msg.channel_name || msg.channel_id}
                                <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
                              </a>
                            </td>
                            <td className="px-3 py-2 font-medium text-foreground truncate">{msg.author_display_name || msg.author_username || 'Unknown'}</td>
                            <td className="px-3 py-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => copyToClipboard(msg.author_id)}
                                className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border hover:bg-accent transition-colors"
                                title={`Copy author Discord ID (${msg.author_id})`}
                              >
                                {copiedId === msg.author_id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                <span className="text-[10px]">ID</span>
                              </button>
                            </td>
                            <td className="px-3 py-2 text-foreground">
                              {msg.content ? (
                                <div className={expandedFlaggedRows.has(msg.id) ? 'whitespace-pre-wrap break-all' : 'truncate'}>
                                  <HighlightedContent content={msg.content} matchedText={msg.matched_text} />
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic inline-block max-w-full truncate align-bottom" title={noContentReason?.tooltip || undefined}>
                                  (no content)
                                  {noContentReason ? ` ${noContentReason.display}` : ''}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                msg.source_type === 'direct' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                msg.source_type === 'reply' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                msg.source_type === 'forward' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                                'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                              }`}>
                                {msg.source_type}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap overflow-hidden">
                              {msg.matched_rule_group_name && (
                                <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[10px] font-medium">
                                  {msg.matched_rule_group_name}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                                {hasEdits && (
                                  <button
                                    onClick={() => toggleEditHistory(msg.message_id, 'flagged')}
                                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border transition-colors ${historyActive
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                                    title={historyActive ? 'Hide edit history highlight' : 'Highlight all versions of this message'}
                                  >
                                    <History className="h-3 w-3" />
                                    <span className="text-[10px] font-medium">v{msg.edit_version || 1}</span>
                                  </button>
                                )}
                                <ActionIcons actionTaken={msg.action_taken} />
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <PaginationControls page={flaggedPage} totalPages={flaggedTotalPages} onPageChange={setFlaggedPage} position="bottom" />
          </>
        )}
        {!flaggedExpanded && flagged.length > 0 && (
          <div className="px-4 py-3 text-xs text-muted-foreground">
            {flaggedTotal} flagged message{flaggedTotal !== 1 ? 's' : ''} -- click header to expand
          </div>
        )}
      </div>

      {/* Recent Messages — Expandable Table */}
      <div className="bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <button
            onClick={() => setRecentExpanded(!recentExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            {recentExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <Clock className="h-4 w-4" />
            Recent Scanned Messages
            <span className="text-muted-foreground font-normal">({recentTotal})</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">Show:</label>
              <select
                value={recentPageSize}
                onChange={e => { setRecentPageSize(Number(e.target.value)); setRecentPage(1) }}
                className="px-1.5 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {[10, 20, 30, 50, 100].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {recentExpanded && (
          <>
            <PaginationControls page={recentPage} totalPages={recentTotalPages} onPageChange={setRecentPage} position="top" />
            {recent.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No messages scanned yet</div>
            ) : (
              <div className="overflow-x-hidden">
                <table className="w-full text-xs table-fixed">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[70px]">Status</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[170px]">Time (UTC)</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[100px]">Server</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[110px]">Channel</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[100px]">User</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap w-[60px]">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Content</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recent.map(msg => {
                      const historyKey = `recent:${msg.message_id}`
                      const historyActive = !!expandedEditHistory[historyKey]
                      const hasEdits = msg.is_edit || (msg.edit_version && msg.edit_version > 1)
                      return (
                        <React.Fragment key={msg.id}>
                          <tr
                            onClick={() => toggleRecentRow(msg.id)}
                            className={`hover:bg-accent/30 transition-colors cursor-pointer ${msg.was_flagged ? 'bg-red-50/50 dark:bg-red-950/10' : ''} ${historyActive ? 'bg-primary/5' : ''}`}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${msg.was_flagged ? 'bg-red-500' : 'bg-green-500'}`} />
                                {hasEdits && (
                                  <button
                                    onClick={e => { e.stopPropagation(); toggleEditHistory(msg.message_id, 'recent') }}
                                    className={`flex items-center gap-0.5 px-1 py-0.5 rounded border transition-colors ${historyActive
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                                    title={historyActive ? 'Hide edit history highlight' : 'Highlight all versions of this message'}
                                  >
                                    <History className="h-3 w-3" />
                                    <span className="text-[10px] font-medium">v{msg.edit_version || 1}</span>
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              <div className="truncate">
                                {formatTime(msg.scanned_at)}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground truncate">{msg.guild_name || '-'}</td>
                            <td className="px-3 py-2 truncate">
                              <a
                                href={`https://discord.com/channels/${msg.guild_id}/${msg.channel_id}/${msg.message_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                                title="Open message in Discord"
                              >
                                #{msg.channel_name || msg.channel_id}
                                <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
                              </a>
                            </td>
                            <td className="px-3 py-2 font-medium text-foreground truncate">{msg.author_username || msg.author_id}</td>
                            <td className="px-3 py-2">
                              <MessageTypeBadge messageType={msg.message_type} hasAttachments={msg.has_attachments} hasEmbeds={msg.has_embeds} />
                            </td>
                            <td className="px-3 py-2 text-foreground">
                              <div className={expandedRecentRows.has(msg.id) ? 'whitespace-pre-wrap break-all' : 'truncate'}>
                                <MessageContentDisplay content={msg.content_preview} messageType={msg.message_type} hasAttachments={msg.has_attachments} hasEmbeds={msg.has_embeds} attachmentTypes={msg.attachment_types} />
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <PaginationControls page={recentPage} totalPages={recentTotalPages} onPageChange={setRecentPage} position="bottom" />
          </>
        )}
        {!recentExpanded && recent.length > 0 && (
          <div className="px-4 py-3 text-xs text-muted-foreground">
            {recentTotal} scanned message{recentTotal !== 1 ? 's' : ''} -- click header to expand
          </div>
        )}
      </div>
    </div>
  )
}

/** Small badge showing the message type */
function MessageTypeBadge({ messageType, hasAttachments, hasEmbeds }: { messageType?: string; hasAttachments?: boolean; hasEmbeds?: boolean }) {
  const type = messageType || (hasAttachments ? 'attachment' : hasEmbeds ? 'embed' : 'text')
  const config: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    text: { icon: null, label: 'Text', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
    system: { icon: <MessageSquare className="h-2.5 w-2.5" />, label: 'System', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
    attachment: { icon: <Paperclip className="h-2.5 w-2.5" />, label: 'File', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
    embed: { icon: <FileText className="h-2.5 w-2.5" />, label: 'Embed', cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
    sticker: { icon: <Image className="h-2.5 w-2.5" />, label: 'Sticker', cls: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' },
    mixed: { icon: <Paperclip className="h-2.5 w-2.5" />, label: 'Mixed', cls: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400' },
  }
  const c = config[type] || config.text
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  )
}

/** Resolve raw "[System: type N]" previews to human-readable labels */
const SYSTEM_TYPE_LABELS: Record<string, string> = {
  '7': 'Member joined',
  '8': 'Server boost',
  '9': 'Server boost (Tier 1)',
  '10': 'Server boost (Tier 2)',
  '11': 'Server boost (Tier 3)',
  '12': 'Channel follow added',
  '18': 'Thread created',
  '19': 'Reply',
  '20': 'Slash command',
  '21': 'Thread starter',
  '23': 'Context menu command',
  '24': 'Auto Moderation action',
  '25': 'Role subscription purchased',
  '27': 'Stage started',
  '28': 'Stage ended',
  '29': 'Stage speaker',
}

function resolveSystemPreview(text: string | null): string | null {
  if (!text) return text
  return text.replace(/\[System: type (\d+)\]/g, (_, num) => {
    const label = SYSTEM_TYPE_LABELS[num]
    return label ? `[System: ${label}]` : `[System: type ${num}]`
  })
}

/** Display message content with type info for empty messages */
function MessageContentDisplay({ content: rawContent, messageType, hasAttachments, hasEmbeds, attachmentTypes }: {
  content: string | null; messageType?: string; hasAttachments?: boolean; hasEmbeds?: boolean; attachmentTypes?: string | null
}) {
  const content = resolveSystemPreview(rawContent)
  // If there is text content, show it normally
  if (content && !content.startsWith('[')) {
    return <span className="text-muted-foreground text-xs">{content}</span>
  }

  // For classified messages (bot v2), show meaningful info
  if (content && content.startsWith('[')) {
    const isSystem = messageType === 'system' || content.startsWith('[System')
    const isAttachment = messageType === 'attachment' || content.startsWith('[Attachment')
    const isEmbed = messageType === 'embed' || content.startsWith('[Embed')
    const isSticker = messageType === 'sticker' || content.startsWith('[Sticker')

    return (
      <span className="text-xs inline-flex items-center gap-1.5 min-w-0">
        {isSystem && <MessageSquare className="h-3 w-3 text-blue-500 shrink-0" />}
        {isAttachment && <Paperclip className="h-3 w-3 text-amber-500 shrink-0" />}
        {isEmbed && <FileText className="h-3 w-3 text-purple-500 shrink-0" />}
        {isSticker && <Image className="h-3 w-3 text-pink-500 shrink-0" />}
        <span className={`min-w-0 ${isSystem ? 'text-blue-600 dark:text-blue-400' : isAttachment ? 'text-amber-600 dark:text-amber-400' : isEmbed ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>
          {content}
        </span>
      </span>
    )
  }

  // Legacy rows without message_type -- try to infer from flags
  if (!content || content === '(no content)') {
    if (hasAttachments) {
      return (
        <span className="text-xs flex-1 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <Paperclip className="h-3 w-3 shrink-0" />
          Attachment{attachmentTypes ? ` (${attachmentTypes})` : ''}
        </span>
      )
    }
    if (hasEmbeds) {
      return (
        <span className="text-xs flex-1 flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
          <FileText className="h-3 w-3 shrink-0" />
          Embedded content
        </span>
      )
    }
    if (messageType === 'system') {
      return (
        <span className="text-xs flex-1 flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <MessageSquare className="h-3 w-3 shrink-0" />
          System message
        </span>
      )
    }
    return <span className="text-muted-foreground text-xs italic">(no text content)</span>
  }

  return <span className="text-muted-foreground text-xs">{content}</span>
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${accent ? 'bg-red-100 dark:bg-red-900/30' : 'bg-accent/50'}`}>
        {icon}
      </div>
      <div>
        <div className={`text-2xl font-bold ${accent ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{value.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

function hashPreviewValue(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

interface RuleListPreviewProps {
  groupId: string
  rules: Rule[]
}

function RuleListPreview({ groupId, rules }: RuleListPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(rules.length)

  const previewRules = useMemo(() => {
    return [...rules].sort((left, right) => {
      const leftHash = hashPreviewValue(`${groupId}:${left.pattern}`)
      const rightHash = hashPreviewValue(`${groupId}:${right.pattern}`)
      if (leftHash !== rightHash) {
        return leftHash - rightHash
      }
      return left.pattern.localeCompare(right.pattern)
    })
  }, [groupId, rules])

  useEffect(() => {
    const updateVisibleCount = () => {
      const container = containerRef.current
      const measure = measureRef.current
      if (!container || !measure) return

      const ruleNodes = Array.from(measure.querySelectorAll<HTMLElement>('[data-preview-chip="rule"]'))
      const ellipsisNode = measure.querySelector<HTMLElement>('[data-preview-chip="ellipsis"]')
      const gap = 8
      const availableWidth = container.clientWidth

      if (ruleNodes.length === 0 || availableWidth <= 0) {
        setVisibleCount(0)
        return
      }

      const ellipsisWidth = ellipsisNode?.getBoundingClientRect().width ?? 0
      let usedWidth = 0
      let nextVisibleCount = 0

      for (let index = 0; index < ruleNodes.length; index += 1) {
        const chipWidth = ruleNodes[index].getBoundingClientRect().width
        const nextWidth = chipWidth + (nextVisibleCount > 0 ? gap : 0)
        const hasMoreRules = index < ruleNodes.length - 1
        const reservedWidth = hasMoreRules ? gap + ellipsisWidth : 0

        if (usedWidth + nextWidth + reservedWidth > availableWidth) {
          break
        }

        usedWidth += nextWidth
        nextVisibleCount += 1
      }

      setVisibleCount(nextVisibleCount)
    }

    updateVisibleCount()

    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateVisibleCount)
      return () => window.removeEventListener('resize', updateVisibleCount)
    }

    const resizeObserver = new ResizeObserver(() => updateVisibleCount())
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [previewRules])

  const visibleRules = previewRules.slice(0, visibleCount)
  const hasOverflow = visibleCount < previewRules.length

  return (
    <>
      <div ref={containerRef} className="min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
          {visibleRules.map(rule => (
            <span
              key={rule.id}
              className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-800 dark:text-emerald-100"
              title={rule.pattern}
            >
              {rule.pattern_type === 'regex' ? <Regex className="h-3 w-3 shrink-0" /> : <Type className="h-3 w-3 shrink-0" />}
              <span className="truncate font-mono">{rule.pattern}</span>
            </span>
          ))}
          {hasOverflow && (
            <span className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
              ...
            </span>
          )}
        </div>
      </div>

      <div ref={measureRef} className="absolute left-0 top-0 -z-10 flex items-center gap-2 whitespace-nowrap opacity-0 pointer-events-none">
        {previewRules.map(rule => (
          <span
            key={rule.id}
            data-preview-chip="rule"
            className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-800 dark:text-emerald-100"
          >
            {rule.pattern_type === 'regex' ? <Regex className="h-3 w-3 shrink-0" /> : <Type className="h-3 w-3 shrink-0" />}
            <span className="font-mono">{rule.pattern}</span>
          </span>
        ))}
        <span
          data-preview-chip="ellipsis"
          className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground"
        >
          ...
        </span>
      </div>
    </>
  )
}

// ─── Configuration Tab ────────────────────────────────────────────────

function ConfigurationTab() {
  const [groups, setGroups] = useState<RuleGroup[]>([])
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [expandedRuleLists, setExpandedRuleLists] = useState<Record<string, boolean>>({})
  const [expandedRuleDescriptions, setExpandedRuleDescriptions] = useState<Record<string, boolean>>({})
  const [ruleDescriptionOverflow, setRuleDescriptionOverflow] = useState<Record<string, boolean>>({})
  const ruleDescriptionRefs = useRef<Record<string, HTMLSpanElement | null>>({})
  const [groupRules, setGroupRules] = useState<Record<string, Rule[]>>({})
  const [loading, setLoading] = useState(true)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newRuleForms, setNewRuleForms] = useState<Record<string, { pattern: string; type: 'regex' | 'wildcard'; description: string }>>({})
  const [saving, setSaving] = useState(false)
  const [bulkImport, setBulkImport] = useState<Record<string, { open: boolean; patterns: string; type: 'regex' | 'wildcard' }>>({})
  const [bulkResult, setBulkResult] = useState<{ succeeded: number; failed: number; errors: string[] } | null>(null)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/api/guardian/rule-groups')
      setGroups(res.data.groups)
    } catch (err) {
      console.error('Failed to load rule groups:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  const loadRules = useCallback(async (groupId: string) => {
    try {
      const res = await apiClient.get(`/api/guardian/rules/${groupId}`)
      setGroupRules(prev => ({ ...prev, [groupId]: res.data.rules }))
    } catch (err) {
      console.error('Failed to load rules:', err)
    }
  }, [])

  const toggleGroup = (groupId: string) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null)
    } else {
      setExpandedGroup(groupId)
      if (!groupRules[groupId]) {
        loadRules(groupId)
      }
    }
  }

  const toggleRuleDescription = (ruleId: string) => {
    setExpandedRuleDescriptions(prev => ({ ...prev, [ruleId]: !prev[ruleId] }))
  }

  const registerRuleDescriptionRef = (ruleId: string) => (node: HTMLSpanElement | null) => {
    ruleDescriptionRefs.current[ruleId] = node
  }

  useEffect(() => {
    const updateOverflowState = () => {
      const nextOverflow: Record<string, boolean> = {}

      for (const [ruleId, element] of Object.entries(ruleDescriptionRefs.current)) {
        if (!element) continue
        nextOverflow[ruleId] = element.scrollWidth > element.clientWidth + 1
      }

      setRuleDescriptionOverflow(prev => {
        const prevKeys = Object.keys(prev)
        const nextKeys = Object.keys(nextOverflow)
        if (prevKeys.length === nextKeys.length && prevKeys.every(key => prev[key] === nextOverflow[key])) {
          return prev
        }
        return nextOverflow
      })
    }

    updateOverflowState()
    window.addEventListener('resize', updateOverflowState)
    return () => window.removeEventListener('resize', updateOverflowState)
  }, [groupRules, expandedRuleLists, expandedRuleDescriptions])

  const createGroup = async () => {
    if (!newGroupName.trim()) return
    setSaving(true)
    try {
      await apiClient.post('/api/guardian/rule-groups', {
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || null,
      })
      setNewGroupName('')
      setNewGroupDesc('')
      setShowNewGroup(false)
      await loadGroups()
    } catch (err) {
      console.error('Failed to create group:', err)
    } finally {
      setSaving(false)
    }
  }

  const toggleGroupEnabled = async (group: RuleGroup) => {
    try {
      await apiClient.put(`/api/guardian/rule-groups/${group.id}`, {
        is_enabled: !group.is_enabled,
      })
      await loadGroups()
    } catch (err) {
      console.error('Failed to toggle group:', err)
    }
  }

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Delete this rule group and all its rules? This cannot be undone.')) return
    try {
      await apiClient.delete(`/api/guardian/rule-groups/${groupId}`)
      setExpandedGroup(null)
      await loadGroups()
    } catch (err) {
      console.error('Failed to delete group:', err)
    }
  }

  const updateGroupActions = async (groupId: string, updates: Partial<Pick<RuleGroup, 'action_delete_message' | 'action_timeout_member' | 'action_timeout_duration' | 'action_ban_member'>>) => {
    try {
      await apiClient.put(`/api/guardian/rule-groups/${groupId}`, updates)
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g))
    } catch (err) {
      console.error('Failed to update group actions:', err)
    }
  }

  const createRule = async (groupId: string) => {
    const form = newRuleForms[groupId]
    if (!form?.pattern?.trim()) return
    setSaving(true)
    try {
      await apiClient.post('/api/guardian/rules', {
        group_id: groupId,
        pattern: form.pattern.trim(),
        pattern_type: form.type,
        description: form.description?.trim() || null,
      })
      setNewRuleForms(prev => ({ ...prev, [groupId]: { pattern: '', type: 'regex', description: '' } }))
      await loadRules(groupId)
      await loadGroups()
    } catch (err: unknown) {
      const errorMsg = err && typeof err === 'object' && 'response' in err
        ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to create rule')
        : 'Failed to create rule'
      alert(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const bulkImportRules = async (groupId: string) => {
    const form = bulkImport[groupId]
    if (!form?.patterns?.trim()) return
    setSaving(true)
    setBulkResult(null)
    try {
      const res = await apiClient.post('/api/guardian/rules/bulk', {
        group_id: groupId,
        patterns: form.patterns,
        pattern_type: form.type,
      })
      const { succeeded, failed, results } = res.data
      const errors = results.filter((r: { success: boolean; error?: string; pattern: string }) => !r.success).map((r: { pattern: string; error?: string }) => `${r.pattern}: ${r.error}`)
      setBulkResult({ succeeded, failed, errors })
      if (succeeded > 0) {
        await loadRules(groupId)
        await loadGroups()
      }
      if (failed === 0) {
        setBulkImport(prev => ({ ...prev, [groupId]: { open: false, patterns: '', type: 'regex' } }))
        setBulkResult(null)
      }
    } catch (err: unknown) {
      const errorMsg = err && typeof err === 'object' && 'response' in err
        ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to import rules')
        : 'Failed to import rules'
      alert(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const toggleRuleEnabled = async (rule: Rule, groupId: string) => {
    try {
      await apiClient.put(`/api/guardian/rules/${rule.id}`, { is_enabled: !rule.is_enabled })
      await loadRules(groupId)
    } catch (err) {
      console.error('Failed to toggle rule:', err)
    }
  }

  const deleteRule = async (ruleId: string, groupId: string) => {
    try {
      await apiClient.delete(`/api/guardian/rules/${ruleId}`)
      await loadRules(groupId)
      await loadGroups()
    } catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
        <p className="font-medium mb-1">How Rule Groups Work</p>
        <p className="text-blue-700 dark:text-blue-300">
          Create named groups of rules (e.g. "URL-Encoded Phishing Links", "Scam Phrases").
          Each group contains regex patterns or wildcard filters. Use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">*</code> for partial matching in wildcard mode.
          The bot checks every message (including quoted replies, forwards, and embeds) against all enabled rules.
        </p>
      </div>

      {/* Add Group Button */}
      {!showNewGroup ? (
        <button
          onClick={() => setShowNewGroup(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Rule Group
        </button>
      ) : (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder="Group name (e.g. URL-Encoded Phishing Links)"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            value={newGroupDesc}
            onChange={e => setNewGroupDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={createGroup}
              disabled={saving || !newGroupName.trim()}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Create Group
            </button>
            <button
              onClick={() => { setShowNewGroup(false); setNewGroupName(''); setNewGroupDesc('') }}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rule Groups List */}
      {groups.length === 0 && !showNewGroup ? (
        <div className="text-center py-12 text-muted-foreground">
          <Settings className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No rule groups configured yet. Create your first group to start scanning messages.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(group => {
            const isExpanded = expandedGroup === group.id
            const rules = groupRules[group.id] || []
            const ruleForm = newRuleForms[group.id] || { pattern: '', type: 'regex' as const, description: '' }
            const ruleCount = group.guardian_rules?.[0]?.count || 0

            return (
              <div key={group.id} className="bg-card border border-border rounded-lg overflow-hidden">
                {/* Group Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => toggleGroup(group.id)}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{group.name}</span>
                      <span className="rounded-full border border-emerald-500/35 bg-emerald-500/18 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-100">{ruleCount} rule{ruleCount !== 1 ? 's' : ''}</span>
                    </div>
                    {group.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleGroupEnabled(group)}
                      className="text-muted-foreground hover:text-foreground"
                      title={group.is_enabled ? 'Disable group' : 'Enable group'}
                    >
                      {group.is_enabled ? (
                        <ToggleRight className="h-5 w-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteGroup(group.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                      title="Delete group"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Rules */}
                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="px-4 py-3 bg-muted/20 border-b border-border space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-foreground">Rules</p>
                          <p className="text-[11px] text-muted-foreground">
                            {rules.length === 0
                              ? 'No rules in this group yet'
                              : expandedRuleLists[group.id]
                                ? 'Full rule list'
                                : 'Previewing a few example rules that fit on the card'}
                          </p>
                        </div>
                        {rules.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedRuleLists(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            {expandedRuleLists[group.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {expandedRuleLists[group.id] ? 'Collapse rules' : `Expand rules (${rules.length})`}
                          </button>
                        )}
                      </div>

                      {rules.length > 0 && !expandedRuleLists[group.id] && (
                        <div className="relative">
                          <RuleListPreview groupId={group.id} rules={rules} />
                        </div>
                      )}
                    </div>

                    {rules.length > 0 && expandedRuleLists[group.id] && (
                      <div className="divide-y divide-border">
                        {rules.map(rule => (
                          <div key={rule.id} className="px-4 py-3 text-sm">
                            {(() => {
                              const isDescriptionExpanded = Boolean(expandedRuleDescriptions[rule.id])
                              const showDescriptionToggle = isDescriptionExpanded || Boolean(ruleDescriptionOverflow[rule.id])

                              return (
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              rule.pattern_type === 'regex'
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                : 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                              }`}>
                                {rule.pattern_type === 'regex' ? <Regex className="h-3 w-3 inline" /> : <Type className="h-3 w-3 inline" />}
                                {' '}{rule.pattern_type}
                              </div>
                              <code className="min-w-0 flex-[0_1_38%] text-xs font-mono text-foreground bg-accent/50 px-2 py-1 rounded truncate" title={rule.pattern}>
                                {rule.pattern}
                              </code>
                              {rule.description && (
                                <div className="min-w-0 flex-1 flex items-center gap-2">
                                  <span
                                    ref={registerRuleDescriptionRef(rule.id)}
                                    className="min-w-0 text-xs text-muted-foreground truncate"
                                    title={rule.description}
                                  >
                                    {rule.description}
                                  </span>
                                  {showDescriptionToggle && (
                                    <button
                                      type="button"
                                      onClick={() => toggleRuleDescription(rule.id)}
                                      className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      {isDescriptionExpanded ? 'Collapse' : 'Expand'}
                                    </button>
                                  )}
                                </div>
                              )}
                              <button
                                onClick={() => toggleRuleEnabled(rule, group.id)}
                                className="shrink-0"
                                title={rule.is_enabled ? 'Disable' : 'Enable'}
                              >
                                {rule.is_enabled ? (
                                  <ToggleRight className="h-4 w-4 text-green-500" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                              <button
                                onClick={() => deleteRule(rule.id, group.id)}
                                className="text-muted-foreground hover:text-red-500 shrink-0 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                              )
                            })()}

                            {rule.description && expandedRuleDescriptions[rule.id] && (
                              <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                {rule.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bot Actions */}
                    <div className="p-4 border-t border-border space-y-3">
                      <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        Bot Actions
                        <span className="text-muted-foreground font-normal">-- when a message matches this group</span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Delete Message */}
                        <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-accent/30 transition-colors cursor-pointer">
                          <button
                            type="button"
                            onClick={() => updateGroupActions(group.id, { action_delete_message: !group.action_delete_message })}
                            className="shrink-0"
                          >
                            {group.action_delete_message ? (
                              <ToggleRight className="h-5 w-5 text-red-500" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                              <MessageSquareX className="h-3.5 w-3.5 text-red-500" />
                              Delete Message
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Automatically delete the flagged message</p>
                          </div>
                        </label>

                        {/* Timeout Member */}
                        <div className="p-3 rounded-lg border border-border bg-background space-y-2">
                          <label className="flex items-center gap-3 hover:bg-accent/30 transition-colors cursor-pointer rounded -m-1 p-1">
                            <button
                              type="button"
                              onClick={() => updateGroupActions(group.id, { action_timeout_member: !group.action_timeout_member })}
                              className="shrink-0"
                            >
                              {group.action_timeout_member ? (
                                <ToggleRight className="h-5 w-5 text-amber-500" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                <Timer className="h-3.5 w-3.5 text-amber-500" />
                                Timeout Member
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Put the member in timeout</p>
                            </div>
                          </label>
                          {group.action_timeout_member && (
                            <div className="flex items-center gap-2 pl-8">
                              <select
                                value={group.action_timeout_duration}
                                onChange={e => updateGroupActions(group.id, { action_timeout_duration: Number(e.target.value) })}
                                className="px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <option value={60}>1 minute</option>
                                <option value={300}>5 minutes</option>
                                <option value={600}>10 minutes</option>
                                <option value={1800}>30 minutes</option>
                                <option value={3600}>1 hour</option>
                                <option value={21600}>6 hours</option>
                                <option value={86400}>1 day</option>
                                <option value={604800}>1 week</option>
                                <option value={2419200}>28 days</option>
                              </select>
                              <span className="text-[11px] text-muted-foreground">duration</span>
                            </div>
                          )}
                        </div>

                        {/* Ban Member */}
                        <label className="flex items-center gap-3 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-background hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer">
                          <button
                            type="button"
                            onClick={() => {
                              if (!group.action_ban_member || confirm(
                                'Enable auto-ban?\n\n' +
                                'WARNING -- this is irreversible from the member\'s side:\n' +
                                '  - The member is permanently removed from the server.\n' +
                                '  - There is NO appeal process and NO self-service way back in.\n' +
                                '  - Only a server moderator can manually unban them.\n\n' +
                                'Recommended alternative: use Delete Message + a long Timeout (e.g. 1 day, 1 week, or 28 days) for serious infringements. ' +
                                'That still blocks the offender but lets them appeal and lets moderators decide whether to escalate to a ban manually.\n\n' +
                                'Continue and enable auto-ban?'
                              )) {
                                updateGroupActions(group.id, { action_ban_member: !group.action_ban_member })
                              }
                            }}
                            className="shrink-0"
                          >
                            {group.action_ban_member ? (
                              <ToggleRight className="h-5 w-5 text-red-600" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                              <Ban className="h-3.5 w-3.5 text-red-600" />
                              Ban Member
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Permanently ban the member from the server. Irreversible from the member's side -- no appeal, no self-service way back in. Only a moderator can manually unban. Prefer a long Timeout for serious infringements so appeals stay possible.
                            </p>
                          </div>
                        </label>
                      </div>
                      {group.action_ban_member && (
                        <div className="flex items-start gap-2 px-2 py-1.5 text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-900">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>
                            Auto-ban is enabled. Members matching these rules will be permanently banned with <strong>no appeal process</strong> -- only a moderator can manually unban them. In practice we recommend using <strong>Delete Message + a long Timeout</strong> (1 day to 28 days) instead, so appeals stay possible and moderators can decide whether to escalate to a manual ban.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Add Rule Form */}
                    <div className="p-4 bg-accent/20 border-t border-border space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={ruleForm.type}
                          onChange={e => setNewRuleForms(prev => ({
                            ...prev,
                            [group.id]: { ...ruleForm, type: e.target.value as 'regex' | 'wildcard' }
                          }))}
                          className="px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="regex">Regex</option>
                          <option value="wildcard">Wildcard (*)</option>
                        </select>
                        <input
                          value={ruleForm.pattern}
                          onChange={e => setNewRuleForms(prev => ({
                            ...prev,
                            [group.id]: { ...ruleForm, pattern: e.target.value }
                          }))}
                          placeholder={ruleForm.type === 'regex' ? 'RegEx pattern (e.g. (%[0-9a-f]{2,2}){2,})' : 'Wildcard pattern (e.g. *discord.gg*)'}
                          className="flex-1 px-3 py-1.5 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={() => createRule(group.id)}
                          disabled={saving || !ruleForm.pattern.trim()}
                          className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Add
                        </button>
                        <button
                          onClick={() => setBulkImport(prev => ({ ...prev, [group.id]: { open: !prev[group.id]?.open, patterns: prev[group.id]?.patterns || '', type: prev[group.id]?.type || 'regex' } }))}
                          className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
                            bulkImport[group.id]?.open
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                              : 'bg-accent text-muted-foreground hover:text-foreground border border-border'
                          }`}
                          title="Bulk import comma-separated patterns"
                        >
                          <Upload className="h-3 w-3" />
                          Import
                        </button>
                      </div>
                      <input
                        value={ruleForm.description}
                        onChange={e => setNewRuleForms(prev => ({
                          ...prev,
                          [group.id]: { ...ruleForm, description: e.target.value }
                        }))}
                        placeholder="Description (optional)"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      />

                      {/* Bulk Import Panel */}
                      {bulkImport[group.id]?.open && (
                        <div className="mt-2 p-3 bg-background border border-border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">Bulk Import Patterns</span>
                            <button
                              onClick={() => { setBulkImport(prev => ({ ...prev, [group.id]: { open: false, patterns: '', type: 'regex' } })); setBulkResult(null) }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Enter multiple patterns separated by commas. Each pattern will be added as a separate rule.
                          </p>
                          <select
                            value={bulkImport[group.id]?.type || 'regex'}
                            onChange={e => setBulkImport(prev => ({ ...prev, [group.id]: { ...prev[group.id], type: e.target.value as 'regex' | 'wildcard' } }))}
                            className="px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="regex">Regex</option>
                            <option value="wildcard">Wildcard (*)</option>
                          </select>
                          <textarea
                            value={bulkImport[group.id]?.patterns || ''}
                            onChange={e => setBulkImport(prev => ({ ...prev, [group.id]: { ...prev[group.id], patterns: e.target.value } }))}
                            placeholder="pattern1, pattern2, pattern3"
                            rows={3}
                            className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                          />
                          {bulkImport[group.id]?.patterns?.trim() && (
                            <p className="text-[11px] text-muted-foreground">
                              {bulkImport[group.id].patterns.split(',').filter(p => p.trim()).length} pattern(s) detected
                            </p>
                          )}
                          {bulkResult && (
                            <div className={`text-xs p-2 rounded ${
                              bulkResult.failed > 0
                                ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                                : 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                            }`}>
                              <p>{bulkResult.succeeded} imported, {bulkResult.failed} failed</p>
                              {bulkResult.errors.length > 0 && (
                                <ul className="mt-1 space-y-0.5 text-[11px]">
                                  {bulkResult.errors.map((e, i) => <li key={i} className="font-mono">{e}</li>)}
                                </ul>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => bulkImportRules(group.id)}
                            disabled={saving || !bulkImport[group.id]?.patterns?.trim()}
                            className="px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1"
                          >
                            <Upload className="h-3 w-3" />
                            {saving ? 'Importing...' : 'Import All'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Server Settings Tab ──────────────────────────────────────────────

interface NotificationConfig {
  actions_log_channel_id: string | null
  user_feedback_channel_id: string | null
}

interface SearchableChannelSelectProps {
  value: string | null
  channels: ServerChannel[]
  noneLabel: string
  onChange: (value: string | null) => void
}

function SearchableChannelSelect({
  value,
  channels,
  noneLabel,
  onChange,
}: SearchableChannelSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})

  const selectedChannel = useMemo(
    () => channels.find(channel => channel.channel_id === value) ?? null,
    [channels, value],
  )

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredChannels = useMemo(() => {
    if (!normalizedQuery) return channels
    return channels.filter(channel => channel.channel_name.toLowerCase().includes(normalizedQuery))
  }, [channels, normalizedQuery])

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      return
    }

    const updateMenuPosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top
      const preferUpward = spaceBelow < 360 && spaceAbove > spaceBelow

      setMenuStyle({
        left: rect.left,
        width: rect.width,
        top: preferUpward ? undefined : rect.bottom + 4,
        bottom: preferUpward ? viewportHeight - rect.top + 4 : undefined,
      })
    }

    updateMenuPosition()
    inputRef.current?.focus()

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      const clickInsidePicker = pickerRef.current?.contains(target)
      const clickInsideMenu = menuRef.current?.contains(target)
      if (!clickInsidePicker && !clickInsideMenu) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen])

  const handleSelect = (nextValue: string | null) => {
    onChange(nextValue)
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div ref={pickerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background text-left text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 flex items-center gap-2"
        aria-expanded={isOpen}
      >
        <span className={`flex-1 truncate ${selectedChannel ? '' : 'text-muted-foreground'}`}>
          {selectedChannel ? `#${selectedChannel.channel_name}` : noneLabel}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="fixed z-[1200] rounded-lg border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden"
          >
            <div className="relative border-b border-border p-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search channels..."
                className="w-full pl-8 pr-2 py-1.5 text-sm rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-accent/60 transition-colors ${value ? 'text-muted-foreground' : 'bg-accent/40 text-foreground'}`}
              >
                {noneLabel}
              </button>

              {filteredChannels.map(channel => (
                <button
                  key={channel.channel_id}
                  type="button"
                  onClick={() => handleSelect(channel.channel_id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-accent/60 transition-colors ${value === channel.channel_id ? 'bg-accent/40 text-foreground' : 'text-foreground'}`}
                >
                  #{channel.channel_name}
                </button>
              ))}

              {filteredChannels.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No channels match your search.
                </div>
              )}
            </div>
          </div>
          , document.body,
        )
      )}
    </div>
  )
}

function ServerSettingsTab() {
  const [servers, setServers] = useState<ServerData[]>([])
  const [channelsByGuild, setChannelsByGuild] = useState<Record<string, ServerChannel[]>>({})
  const [notifByGuild, setNotifByGuild] = useState<Record<string, NotificationConfig>>({})
  const [savingNotif, setSavingNotif] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())

  const loadServers = useCallback(async () => {
    setLoading(true)
    try {
      const [serversRes, channelsRes] = await Promise.all([
        apiClient.get('/api/guardian/servers'),
        apiClient.get('/api/guardian/servers/channels'),
      ])
      setServers(serversRes.data.servers || [])

      const map: Record<string, ServerChannel[]> = {}
      for (const s of (channelsRes.data.servers || []) as ServerChannelData[]) {
        // Notification channels must be text-like (text=0, announcement=5, forum=15)
        map[s.guild_id] = s.channels.filter(c => c.channel_type === 0 || c.channel_type === 5 || c.channel_type === 15)
      }
      setChannelsByGuild(map)
    } catch (err) {
      console.error('Failed to load servers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadServers() }, [loadServers])

  /** Load notification config for a guild when its panel is expanded */
  const loadNotificationConfig = useCallback(async (guildId: string) => {
    if (notifByGuild[guildId]) return
    try {
      const res = await apiClient.get(`/api/guardian/servers/${guildId}/notification-channels`)
      setNotifByGuild(prev => ({
        ...prev,
        [guildId]: {
          actions_log_channel_id: res.data.actions_log_channel_id || null,
          user_feedback_channel_id: res.data.user_feedback_channel_id || null,
        },
      }))
    } catch (err) {
      console.error(`Failed to load notification config for ${guildId}:`, err)
      setNotifByGuild(prev => ({ ...prev, [guildId]: { actions_log_channel_id: null, user_feedback_channel_id: null } }))
    }
  }, [notifByGuild])

  const updateNotificationField = (
    guildId: string,
    field: 'actions_log_channel_id' | 'user_feedback_channel_id',
    value: string | null,
  ) => {
    setNotifByGuild(prev => ({
      ...prev,
      [guildId]: {
        actions_log_channel_id: prev[guildId]?.actions_log_channel_id ?? null,
        user_feedback_channel_id: prev[guildId]?.user_feedback_channel_id ?? null,
        [field]: value,
      },
    }))
  }

  const saveNotificationConfig = async (guildId: string) => {
    const cfg = notifByGuild[guildId]
    if (!cfg) return
    setSavingNotif(guildId)
    try {
      await apiClient.put(`/api/guardian/servers/${guildId}/notification-channels`, {
        actions_log_channel_id: cfg.actions_log_channel_id,
        user_feedback_channel_id: cfg.user_feedback_channel_id,
      })
    } catch (err) {
      console.error('Failed to save notification config:', err)
      alert(`Failed to save: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setSavingNotif(null)
    }
  }

  const toggleRoleIgnored = async (role: ServerRole) => {
    setTogglingId(role.id)
    try {
      await apiClient.put(`/api/guardian/servers/roles/${role.id}/ignore`, {
        is_ignored: !role.is_ignored,
      })
      // Update local state
      setServers(prev => prev.map(s => ({
        ...s,
        roles: s.roles.map(r => r.id === role.id ? { ...r, is_ignored: !r.is_ignored } : r),
      })))
    } catch (err) {
      console.error('Failed to toggle role:', err)
    } finally {
      setTogglingId(null)
    }
  }

  /** Convert Discord integer color to CSS hex */
  const roleColorStyle = (color: number) => {
    if (!color) return undefined
    return { color: `#${color.toString(16).padStart(6, '0')}` }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-3">
        <Server className="h-12 w-12 mx-auto opacity-30" />
        <p className="text-sm">No servers found. The bot will sync server roles automatically when it connects to Discord.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
        <p className="font-medium mb-1">Role-Based Whitelisting</p>
        <p className="text-blue-700 dark:text-blue-300">
          Toggle "Ignore" on a role to stop the Guardian bot from scanning messages by users with that role.
          This is useful for whitelisting trusted roles (e.g. Ambassadors, Moderators) to reduce noise.
          Changes take effect within 60 seconds.
        </p>
      </div>

      {servers.map(server => {
        const ignoredCount = server.roles.filter(r => r.is_ignored).length
        const isExpanded = expandedServers.has(server.guild_id)
        const guildChannels = channelsByGuild[server.guild_id] || []
        const notif = notifByGuild[server.guild_id]
        return (
          <div key={server.guild_id} className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Server Header — clickable to expand */}
            <button
              onClick={() => setExpandedServers(prev => {
                const next = new Set(prev)
                if (next.has(server.guild_id)) {
                  next.delete(server.guild_id)
                } else {
                  next.add(server.guild_id)
                  loadNotificationConfig(server.guild_id)
                }
                return next
              })}
              className="w-full flex items-center gap-3 p-4 bg-accent/20 hover:bg-accent/40 transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              <Server className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">{server.guild_name}</h3>
                <p className="text-xs text-muted-foreground">
                  {server.roles.length} role{server.roles.length !== 1 ? 's' : ''}
                  {ignoredCount > 0 && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      ({ignoredCount} ignored)
                    </span>
                  )}
                </p>
              </div>
            </button>

            {/* Expanded: Notification Channels + Roles Table */}
            {isExpanded && (
              <>
                {/* Notification Channels */}
                <div className="border-t border-border p-4 space-y-3 bg-muted/20">
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1">Notification Channels</h4>
                    <p className="text-xs text-muted-foreground">
                      Choose where the bot posts moderation actions and user-feedback signals.
                      Channels must be synced first (see Channel Settings tab).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Actions log channel */}
                    <label className="block text-xs">
                      <span className="block mb-1 font-medium text-muted-foreground">Bot actions log channel</span>
                      <SearchableChannelSelect
                        value={notif?.actions_log_channel_id || null}
                        channels={guildChannels}
                        noneLabel="-- None (disabled) --"
                        onChange={(value) => updateNotificationField(server.guild_id, 'actions_log_channel_id', value)}
                      />
                    </label>

                    {/* User feedback channel + "Use previous channel" button */}
                    <div>
                      <label className="block text-xs">
                        <span className="block mb-1 font-medium text-muted-foreground flex items-center gap-2">
                          User feedback channel
                          <button
                            type="button"
                            onClick={() => updateNotificationField(server.guild_id, 'user_feedback_channel_id', notif?.actions_log_channel_id || null)}
                            disabled={!notif?.actions_log_channel_id}
                            className="ml-auto text-[11px] px-1.5 py-0.5 rounded border border-border bg-background hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Reuse the actions log channel above"
                          >
                            Use previous channel
                          </button>
                        </span>
                        <SearchableChannelSelect
                          value={notif?.user_feedback_channel_id || null}
                          channels={guildChannels}
                          noneLabel="-- None (falls back to actions log) --"
                          onChange={(value) => updateNotificationField(server.guild_id, 'user_feedback_channel_id', value)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => saveNotificationConfig(server.guild_id)}
                      disabled={savingNotif === server.guild_id || !notif}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {savingNotif === server.guild_id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Save channels
                    </button>
                  </div>
                </div>

                {/* Roles Table */}
                {server.roles.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground border-t border-border">
                    No roles found in this server. Roles will appear after the bot syncs them from Discord.
                  </div>
                ) : (
                  <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Position</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Ignore (Whitelist)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {server.roles.map(role => (
                    <tr key={role.id} className={`hover:bg-accent/30 transition-colors ${role.is_ignored ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}`}>
                      <td className="px-4 py-2.5">
                        <span className="font-medium" style={roleColorStyle(role.role_color)}>
                          {role.role_name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {role.role_position}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => toggleRoleIgnored(role)}
                          disabled={togglingId === role.id}
                          className="inline-flex items-center gap-1 text-sm disabled:opacity-50"
                          title={role.is_ignored ? 'Currently ignored (whitelisted) - click to start scanning' : 'Currently scanned - click to ignore (whitelist)'}
                        >
                          {role.is_ignored ? (
                            <ToggleRight className="h-5 w-5 text-amber-500" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className={`text-xs ${role.is_ignored ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                            {role.is_ignored ? 'Ignored' : 'Scanning'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Channel Settings Tab ─────────────────────────────────────────────

function ChannelSettingsTab() {
  const [servers, setServers] = useState<ServerChannelData[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const loadChannels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/api/guardian/servers/channels')
      setServers(res.data.servers || [])
    } catch (err) {
      console.error('Failed to load channels:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadChannels() }, [loadChannels])

  const syncChannels = async () => {
    setSyncing(true)
    try {
      await apiClient.post('/api/guardian/servers/channels/sync')
      await loadChannels()
    } catch (err) {
      console.error('Failed to sync channels:', err)
    } finally {
      setSyncing(false)
    }
  }

  const toggleChannelMonitored = async (channel: ServerChannel) => {
    setTogglingId(channel.id)
    try {
      await apiClient.put(`/api/guardian/servers/channels/${channel.id}/monitor`, {
        is_monitored: !channel.is_monitored,
      })
      setServers(prev => prev.map(s => ({
        ...s,
        channels: s.channels.map(c => c.id === channel.id ? { ...c, is_monitored: !c.is_monitored } : c),
      })))
    } catch (err) {
      console.error('Failed to toggle channel:', err)
    } finally {
      setTogglingId(null)
    }
  }

  /** Discord channel type label */
  const channelTypeLabel = (type: number) => {
    switch (type) {
      case 0: return 'Text'
      case 2: return 'Voice'
      case 4: return 'Category'
      case 5: return 'Announcement'
      case 10: case 11: case 12: return 'Thread'
      case 13: return 'Stage'
      case 15: return 'Forum'
      case 16: return 'Media'
      default: return 'Other'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-4">
        <Hash className="h-12 w-12 mx-auto opacity-30" />
        <p className="text-sm">No channels synced yet. Click "Sync Channels" to fetch channels from Discord, or invite the bot to a new server.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={syncChannels}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Channels'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
        <p className="font-medium mb-1">Channel Monitoring</p>
        <p className="text-blue-700 dark:text-blue-300">
          Disable monitoring on channels that don't need scanning (e.g. read-only announcement channels, bot command channels, or internal admin channels).
          All channels are monitored by default. Changes take effect within 60 seconds.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={syncChannels}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Channels'}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search channels..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {servers.map(server => {
        const filteredChannels = searchQuery
          ? server.channels.filter(c => c.channel_name.toLowerCase().includes(searchQuery.toLowerCase()))
          : server.channels
        if (searchQuery && filteredChannels.length === 0) return null

        const disabledCount = server.channels.filter(c => !c.is_monitored).length
        const isExpanded = expandedServers.has(server.guild_id)
        return (
          <div key={server.guild_id} className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Server Header */}
            <button
              onClick={() => setExpandedServers(prev => {
                const next = new Set(prev)
                if (next.has(server.guild_id)) next.delete(server.guild_id)
                else next.add(server.guild_id)
                return next
              })}
              className="w-full flex items-center gap-3 p-4 bg-accent/20 hover:bg-accent/40 transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              <Server className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">{server.guild_name}</h3>
                <p className="text-xs text-muted-foreground">
                  {server.channels.length} channel{server.channels.length !== 1 ? 's' : ''}
                  {disabledCount > 0 && (
                    <span className="ml-2 text-red-600 dark:text-red-400">
                      ({disabledCount} not monitored)
                    </span>
                  )}
                </p>
              </div>
            </button>

            {/* Expanded: Channels Table */}
            {isExpanded && (
              filteredChannels.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground border-t border-border">
                  {searchQuery ? 'No channels match your search.' : 'No channels found. Channels will appear after the bot syncs them from Discord.'}
                </div>
              ) : (
                <div className="overflow-x-auto border-t border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Channel</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Type</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Monitoring</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredChannels.map(channel => (
                        <tr key={channel.id} className={`hover:bg-accent/30 transition-colors ${!channel.is_monitored ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium text-foreground">{channel.channel_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {channelTypeLabel(channel.channel_type)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => toggleChannelMonitored(channel)}
                              disabled={togglingId === channel.id}
                              className="inline-flex items-center gap-1 text-sm disabled:opacity-50"
                              title={channel.is_monitored ? 'Currently monitored - click to disable' : 'Not monitored - click to enable'}
                            >
                              {channel.is_monitored ? (
                                <ToggleRight className="h-5 w-5 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                              )}
                              <span className={`text-xs ${channel.is_monitored ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {channel.is_monitored ? 'Monitored' : 'Disabled'}
                              </span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
