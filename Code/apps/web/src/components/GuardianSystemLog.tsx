import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../lib/api-client'
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Trash2, VolumeX, Gavel, Flag, ExternalLink } from 'lucide-react'

interface SystemLogEntry {
  id: string
  created_at: string
  action: 'flag' | 'delete' | 'mute' | 'ban'
  failure_reason: string | null
  author_id: string | null
  author_username: string | null
  guild_name: string | null
  channel_name: string | null
  channel_id: string | null
  message_id: string | null
  matched_rule_group_name: string | null
}

interface Props {
  guildIdLookup?: (guildName: string | null) => string | null
  /** Optional: when provided, the panel's Refresh button triggers a full
   *  page refresh starting from this section (instead of just reloading
   *  the system log in isolation). */
  onRefreshAll?: () => void
  /** Optional: parent-driven loading flag (mirrors the page-level refresh
   *  so the spinner keeps animating during the sequential refresh). */
  externalLoading?: boolean
}

function actionIcon(action: SystemLogEntry['action']) {
  if (action === 'delete') return <Trash2 className="h-3.5 w-3.5 text-amber-500" />
  if (action === 'mute') return <VolumeX className="h-3.5 w-3.5 text-yellow-500" />
  if (action === 'ban') return <Gavel className="h-3.5 w-3.5 text-red-500" />
  return <Flag className="h-3.5 w-3.5 text-muted-foreground" />
}

function actionLabel(action: SystemLogEntry['action']) {
  if (action === 'delete') return 'Delete message'
  if (action === 'mute') return 'Mute user'
  if (action === 'ban') return 'Ban user'
  return 'Flag'
}

/**
 * Collapsible "System Log" panel showing recent intent-vs-result mismatches
 * (rows from guardian_action_log where success = false). Default collapsed
 * to keep the dashboard quiet when everything is healthy.
 */

import React, { forwardRef, useImperativeHandle } from 'react'
export interface GuardianSystemLogRef {
  refresh: () => Promise<void>
}
const GuardianSystemLog = forwardRef<GuardianSystemLogRef, Props>(({ guildIdLookup, onRefreshAll, externalLoading }, ref) => {
  const [expanded, setExpanded] = useState(false)
  const [entries, setEntries] = useState<SystemLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get('/api/guardian/system-log?limit=50')
      setEntries(res.data.entries || [])
      setCount((res.data.entries || []).length)
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load system log')
    } finally {
      await new Promise(res => setTimeout(res, 1500))
      setLoading(false)
    }
  }, [])

  useImperativeHandle(ref, () => ({ refresh: load }), [load])
  useEffect(() => { load() }, [load])

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <AlertTriangle className={`h-4 w-4 ${count && count > 0 ? 'text-rose-500' : 'text-muted-foreground'}`} />
          System Log
          <span className="text-muted-foreground font-normal">
            ({count === null ? '...' : count}{count === 50 ? '+' : ''})
          </span>
          <span className="text-xs text-muted-foreground font-normal ml-2">
            -- failed bot actions (permission gaps, intent vs result mismatches)
          </span>
        </button>
        <button
          onClick={onRefreshAll ?? load}
          disabled={loading || externalLoading}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-50"
          title={onRefreshAll ? 'Refresh -- updates this panel first, then the rest of the page' : 'Refresh'}
        >
          <RefreshCw className={`h-3 w-3 ${(loading || externalLoading) ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {expanded && (
        <div className="p-4">
          {error && (
            <div className="text-sm text-rose-600 dark:text-rose-400 mb-2">{error}</div>
          )}
          {!error && entries.length === 0 && !loading && (
            <div className="text-xs text-muted-foreground italic py-2">
              No failed actions in the recent log. Everything is healthy.
            </div>
          )}
          {entries.length > 0 && (
            <ul className="space-y-2">
              {entries.map(e => {
                const guildId = guildIdLookup?.(e.guild_name) || null
                const discordUrl = guildId && e.channel_id && e.message_id
                  ? `https://discord.com/channels/${guildId}/${e.channel_id}/${e.message_id}`
                  : null
                return (
                  <li
                    key={e.id}
                    className="rounded border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {actionIcon(e.action)}
                        <span className="font-semibold text-foreground">FAILED to {actionLabel(e.action).toLowerCase()}</span>
                        {e.author_username && (
                          <span className="text-muted-foreground">
                            -- target: <span className="text-foreground">{e.author_username}</span>
                          </span>
                        )}
                        {e.channel_name && (
                          <span className="text-muted-foreground">
                            in <span className="text-foreground">#{e.channel_name}</span>
                          </span>
                        )}
                        {e.matched_rule_group_name && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[10px] font-medium">
                            {e.matched_rule_group_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                        <span title={new Date(e.created_at).toISOString()}>
                          {new Date(e.created_at).toLocaleString()}
                        </span>
                        {discordUrl && (
                          <a
                            href={discordUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 hover:text-primary"
                            title="Open message in Discord"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    {e.failure_reason && (
                      <div className="mt-1.5 font-mono text-[11px] text-rose-700 dark:text-rose-300 whitespace-pre-wrap break-words">
                        {e.failure_reason}
                      </div>
                    )}
                    {/* Helpful hint for the most common failure */}
                    {e.failure_reason && /missing permissions/i.test(e.failure_reason) && (
                      <div className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                        {'-->'} Demon X likely lacks the required permission in this channel.
                        Grant it via Server Settings &rarr; Roles &rarr; Demon X, or via the
                        channel-level permission overrides.
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
})
GuardianSystemLog.displayName = 'GuardianSystemLog'
export default GuardianSystemLog
