import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api-client'
import { getPrimaryTimezone, formatDateInTimezone } from '../lib/timezone-data'
import LearnerHelpIcon from '../components/LearnerHelpIcon'
import SentimentGrid from '../components/SentimentGrid'
import {
  MessageSquare,
  Shield,
  Filter,
  Circle,
  CheckCircle2,
  XCircle,
  Eye,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  Bot,
  Sparkles,
  Reply,
  AlertTriangle,
  ClipboardCopy,
  Check,
  Trash2,
} from 'lucide-react'

interface AiFeedbackItem {
  id: string
  user_id: string
  user_display_name: string | null
  user_email: string | null
  user_avatar_url: string | null
  user_prompt: string
  ai_answer: string
  sentiment_valence: number
  sentiment_trust: number
  feedback_text: string | null
  status: string
  admin_response: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle; color: string }> = {
  open: { label: 'Open', icon: Circle, color: 'text-blue-500' },
  reviewed: { label: 'Reviewed', icon: Eye, color: 'text-amber-500' },
  affirmed: { label: 'Affirmed', icon: UserCheck, color: 'text-green-500' },
  resolved: { label: 'Resolved', icon: CheckCircle2, color: 'text-emerald-600' },
  dismissed: { label: 'Dismissed', icon: XCircle, color: 'text-gray-400' },
}

const VALID_STATUSES = ['open', 'reviewed', 'resolved', 'dismissed', 'affirmed'] as const

export default function AiFeedbackPage({ embedded = false, statusOrder }: { embedded?: boolean; statusOrder?: string[] }) {
  const { user } = useAuth()
  const isAdmin = user?.roles?.includes('admin')

  const [feedbackList, setFeedbackList] = useState<AiFeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' }
      if (statusFilter !== 'all') params.status = statusFilter
      if (statusOrder?.length) params.statusOrder = JSON.stringify(statusOrder)
      const { data } = await apiClient.get('/api/ai-feedback', { params })
      setFeedbackList(data.feedback || [])
      setTotal(data.total || 0)
    } catch (err) {
      setLoadError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to load AI feedback')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, statusOrder])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!isAdmin) return
    setUpdatingId(id)
    try {
      await apiClient.patch(`/api/ai-feedback/${id}`, { status: newStatus })
      setFeedbackList(prev =>
        prev.map(f => (f.id === id ? { ...f, status: newStatus } : f)),
      )
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleAdminRespond = async (id: string) => {
    if (!isAdmin || !adminResponse.trim()) return
    setUpdatingId(id)
    try {
      await apiClient.patch(`/api/ai-feedback/${id}`, { admin_response: adminResponse.trim() })
      setFeedbackList(prev =>
        prev.map(f => (f.id === id ? { ...f, admin_response: adminResponse.trim() } : f)),
      )
      setAdminResponse('')
    } catch (err) {
      console.error('Failed to submit admin response:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteFeedback = async (id: string) => {
    setUpdatingId(id)
    try {
      await apiClient.delete(`/api/ai-feedback/${id}`)
      setFeedbackList(prev => prev.filter(f => f.id !== id))
      setTotal(prev => Math.max(0, prev - 1))
      setConfirmDeleteId(null)
      if (expandedId === id) setExpandedId(null)
    } catch (err) {
      console.error('Failed to delete AI feedback:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const buildImprovementPrompt = (item: AiFeedbackItem) => {
    const sentimentLabel = getSentimentLabel(item.sentiment_valence, item.sentiment_trust)
    return [
      'COORDINATION MANAGER -- AI FEEDBACK IMPROVEMENT REQUEST',
      '========================================================',
      '',
      `FEEDBACK ID     : ${item.id}`,
      `SUBMITTED       : ${item.created_at}`,
      `STATUS          : ${item.status}`,
      '',
      '--- SENTIMENT SCORES ---',
      `Valence (quality)  : ${item.sentiment_valence > 0 ? '+' : ''}${item.sentiment_valence}   (negative = bad answer, positive = good)`,
      `Trust (reliability) : ${item.sentiment_trust > 0 ? '+' : ''}${item.sentiment_trust}   (negative = distrust, positive = trust)`,
      `Sentiment Label    : ${sentimentLabel}`,
      '',
      '--- CONVERSATION CONTEXT ---',
      'USER PROMPT:',
      item.user_prompt,
      '',
      'AI ANSWER:',
      item.ai_answer,
      '',
      '--- USER FEEDBACK ---',
      item.feedback_text || '(none)',
      '',
      '--- ADMIN RESPONSE ---',
      item.admin_response || '(none)',
      '',
      '========================================================',
      'TASK: Use the ai-feedback-loop skill to analyse this feedback and propose concrete improvements to AI behaviour, prompts, documentation, or UI copy in the Coordination Manager codebase.',
    ].join('\n')
  }

  const handleCopyPrompt = async (item: AiFeedbackItem) => {
    const prompt = buildImprovementPrompt(item)
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea')
      textarea.value = prompt
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleItemHeaderClick = (event: React.MouseEvent<HTMLButtonElement>, id: string, isExpanded: boolean) => {
    const selectedText = window.getSelection()?.toString().trim()
    if (selectedText) return
    setExpandedId(isExpanded ? null : id)
  }

  // Sentiment position label
  const getSentimentLabel = (valence: number, trust: number) => {
    const yLabels = ['Good', 'Positive', 'Unknown', 'Negative', 'Bad']
    const xLabels = ['Untrust', 'Doubt', "Don't know", 'Believe', 'Trust']
    const yIdx = Math.round((1 - valence) * 2)
    const xIdx = Math.round((trust + 1) * 2)
    const y = yLabels[Math.max(0, Math.min(4, yIdx))]
    const x = xLabels[Math.max(0, Math.min(4, xIdx))]
    return `${y} · ${x}`
  }

  // Sentiment colour class
  const getSentimentColor = (valence: number, trust: number) => {
    const avg = (valence + trust) / 2
    if (avg > 0.3) return 'text-green-600 dark:text-green-400'
    if (avg < -0.3) return 'text-red-600 dark:text-red-400'
    return 'text-amber-600 dark:text-amber-400'
  }

  const totalPages = Math.max(1, Math.ceil(total / 20))

  const content = (
    <>
      {/* Header — hide when embedded in FeedbackPage */}
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">AI Feedback</h1>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? 'All sentiment feedback from AI chat' : 'Your sentiment feedback on AI responses'}
              </p>
            </div>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Statuses</option>
              {VALID_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Embedded status filter */}
      {embedded && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Statuses</option>
            {VALID_STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
            ))}
          </select>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {loadError && (
        <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {loadError}
        </div>
      )}

      {/* Empty state */}
      {!loading && !loadError && feedbackList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Bot className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg font-medium mb-1">No AI Feedback Yet</p>
          <p className="text-sm max-w-md">
            {isAdmin
              ? 'No sentiment feedback has been submitted yet. Oversight and admin users can submit feedback from the AI Chat page.'
              : 'Use the sentiment tool on AI Chat responses to submit detailed feedback about AI answer quality.'}
          </p>
        </div>
      )}

      {/* Feedback list */}
      {!loading && feedbackList.length > 0 && (
        <div className="space-y-3">
          {feedbackList.map(item => {
            const isExpanded = expandedId === item.id
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.open
            const StatusIcon = statusCfg.icon

            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card overflow-hidden relative"
              >
                <LearnerHelpIcon
                  description={<><p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Sentiment Feedback Entry</p><p className="mb-1.5">Each card represents feedback that was submitted on an AI chat response. It captures how the user felt about the AI’s answer.</p><p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">What’s inside</p><ul className="list-disc list-inside space-y-0.5"><li><strong>Sentiment grid</strong> — a 2D rating of valence (positive/negative) and trust.</li><li><strong>Written comments</strong> — optional text elaborating on the rating.</li><li><strong>Conversation context</strong> — the original AI exchange that was rated.</li></ul></>}
                  size={4}
                  className="absolute top-3 right-3 z-10"
                />
                {/* Header row */}
                <button
                  onClick={(event) => handleItemHeaderClick(event, item.id, isExpanded)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/30 transition-colors select-text"
                >
                  {/* Status icon */}
                  <StatusIcon className={`h-4 w-4 shrink-0 ${statusCfg.color}`} />

                  {/* User info (admin view) */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      {item.user_avatar_url ? (
                        <img src={item.user_avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {(item.user_display_name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {item.user_display_name || item.user_email || 'Unknown'}
                      </span>
                    </div>
                  )}

                  {/* Prompt preview */}
                  <span className="flex-1 text-sm truncate select-text">
                    {item.user_prompt.length > 80
                      ? item.user_prompt.slice(0, 80) + '…'
                      : item.user_prompt}
                  </span>

                  {/* Sentiment badge */}
                  <span className={`text-xs font-medium shrink-0 ${getSentimentColor(item.sentiment_valence, item.sentiment_trust)}`}>
                    {getSentimentLabel(item.sentiment_valence, item.sentiment_trust)}
                  </span>

                  {/* Timestamp */}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDateInTimezone(item.created_at, getPrimaryTimezone())}
                  </span>

                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="p-4 border-t border-border space-y-4">
                    {/* User prompt */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">User Prompt</h4>
                      <div className="p-3 rounded-lg bg-primary/10 text-sm whitespace-pre-wrap">
                        {item.user_prompt}
                      </div>
                    </div>

                    {/* AI Answer */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AI Answer
                      </h4>
                      <div className="p-3 rounded-lg bg-card border border-border text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {item.ai_answer}
                      </div>
                    </div>

                    {/* Sentiment — visual grid + values */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground">Sentiment</h4>
                      <div className="flex items-start gap-4">
                        <SentimentGrid
                          valence={item.sentiment_valence}
                          trust={item.sentiment_trust}
                          onChange={() => {}}
                          size={160}
                          disabled
                        />
                        <div className="space-y-2 pt-1">
                          <div>
                            <span className="text-xs text-muted-foreground">Valence:</span>{' '}
                            <span className="font-medium">{item.sentiment_valence > 0 ? '+' : ''}{item.sentiment_valence}</span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Trust:</span>{' '}
                            <span className="font-medium">{item.sentiment_trust > 0 ? '+' : ''}{item.sentiment_trust}</span>
                          </div>
                          <div className={`font-medium ${getSentimentColor(item.sentiment_valence, item.sentiment_trust)}`}>
                            {getSentimentLabel(item.sentiment_valence, item.sentiment_trust)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Written feedback */}
                    {item.feedback_text && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">Feedback</h4>
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
                          {item.feedback_text}
                        </div>
                      </div>
                    )}

                    {/* Copy Improvement Prompt */}
                    {isAdmin && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleCopyPrompt(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-green-500" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <ClipboardCopy className="h-3.5 w-3.5" />
                              Copy Improvement Prompt
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Admin response (if exists) */}
                    {item.admin_response && (
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Shield className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Admin Response</span>
                        </div>
                        <p className="text-sm">{item.admin_response}</p>
                      </div>
                    )}

                    {/* Admin controls */}
                    {isAdmin && (
                      <div className="pt-3 border-t border-border space-y-3">
                        {/* Status selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Status:</span>
                          <div className="flex gap-1">
                            {VALID_STATUSES.map(s => {
                              const cfg = STATUS_CONFIG[s]
                              const Icon = cfg.icon
                              return (
                                <button
                                  key={s}
                                  onClick={() => handleStatusChange(item.id, s)}
                                  disabled={updatingId === item.id}
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                                    item.status === s
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted hover:bg-accent text-muted-foreground'
                                  } disabled:opacity-50`}
                                >
                                  <Icon className="h-3 w-3" />
                                  {cfg.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Admin response input */}
                        <div className="flex gap-2">
                          <textarea
                            value={expandedId === item.id ? adminResponse : ''}
                            onChange={(e) => setAdminResponse(e.target.value)}
                            placeholder="Write an admin response..."
                            rows={2}
                            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <button
                            onClick={() => handleAdminRespond(item.id)}
                            disabled={!adminResponse.trim() || updatingId === item.id}
                            className="self-end flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {updatingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Reply className="h-4 w-4" />
                            )}
                            Respond
                          </button>
                        </div>

                        {/* Delete controls */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                          {confirmDeleteId === item.id ? (
                            <>
                              <span className="text-xs text-red-500">Delete permanently?</span>
                              <button
                                onClick={() => handleDeleteFeedback(item.id)}
                                disabled={updatingId === item.id}
                                className="px-2 py-1 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                              >
                                {updatingId === item.id ? 'Deleting...' : 'Delete'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded-md text-xs border border-border hover:bg-accent/50 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              title="Delete this entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-accent transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-accent transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </>
  )

  if (embedded) return content

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {content}
    </div>
  )
}
