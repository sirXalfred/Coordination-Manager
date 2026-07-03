import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSearchParams } from 'react-router-dom'
import { apiClient } from '../lib/api-client'
import { getPrimaryTimezone, formatDateTimeInTimezone } from '../lib/timezone-data'
import LearnerHelpIcon from '../components/LearnerHelpIcon'
import { MessageSquare, Send, CheckCircle, AlertTriangle, Shield, ChevronDown, ChevronUp, Filter, Reply, Circle, CheckCircle2, XCircle, Eye, UserCheck, Globe, GripVertical, BarChart3, LifeBuoy, Paperclip, ImageIcon, X as XIcon, Trash2, ZoomIn } from 'lucide-react'
import AiFeedbackPage from './AiFeedbackPage'

interface FeedbackResponseItem {
  id: string
  admin_id: string
  message: string
  created_at: string
  admin_display_name: string | null
  admin_avatar_url: string | null
}

interface FeedbackItem {
  id: string
  user_id: string | null
  discord_user_id: string | null
  discord_username: string | null
  user_display_name: string | null
  user_email: string | null
  user_avatar_url: string | null
  message: string
  source: string
  status: string
  created_at: string
  attachments?: string[]
  feedback_responses: FeedbackResponseItem[]
}

export default function FeedbackPage() {
  const { user } = useAuth()
  const isAdminFromAuth = user?.roles?.includes('admin')
  const canViewAiFeedback = user?.roles?.includes('admin') || user?.roles?.includes('oversight') || user?.themePreferences?.aiSettings?.sentimentToolEnabled === true
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'support' ? 'support' : searchParams.get('tab') === 'ai' ? 'ai' : 'general'
  const [feedbackTab, setFeedbackTab] = useState<'general' | 'ai' | 'support'>(initialTab)

  // ── Support form fields ──
  const [supportSubject, setSupportSubject] = useState('')
  const [supportType, setSupportType] = useState<'bug' | 'access' | 'integration' | 'other'>('bug')
  const [supportDescription, setSupportDescription] = useState('')
  const [supportSteps, setSupportSteps] = useState('')
  const [supportSubmitting, setSupportSubmitting] = useState(false)
  const [supportSuccess, setSupportSuccess] = useState(false)
  const [supportError, setSupportError] = useState('')

  // ── Submit form ──
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const attachFileRef = useRef<HTMLInputElement>(null)

  // ── Support form attachments ──
  const [supportAttachments, setSupportAttachments] = useState<string[]>([])
  const supportAttachFileRef = useRef<HTMLInputElement>(null)

  // ── Image lightbox ──
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!previewSrc) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewSrc(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previewSrc])

  // ── Feedback list ──
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<{ open: number; reviewed: number }>({ open: 0, reviewed: 0 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  // ── Admin panel ──
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const DEFAULT_STATUS_ORDER = ['open', 'reviewed', 'affirmed', 'resolved', 'dismissed']
  const [statusOrder, setStatusOrder] = useState<string[]>(DEFAULT_STATUS_ORDER)
  const statusOrderInitialisedRef = useRef(false)
  const skipStatusOrderFetchRef = useRef(false)
  const [draggedStatus, setDraggedStatus] = useState<string | null>(null)
  // Use API-returned isAdmin (authoritative from DB) with auth context as fallback
  const [isAdminFromApi, setIsAdminFromApi] = useState<boolean | null>(null)
  const isAdmin = isAdminFromApi ?? isAdminFromAuth

  // Admin: All Feedback section is collapsed by default (contains private info)
  const [allFeedbackExpanded, setAllFeedbackExpanded] = useState(false)

  const fetchFeedback = useCallback(async () => {
    // Skip this invocation if it was triggered by our own status-order initialisation
    if (skipStatusOrderFetchRef.current) {
      skipStatusOrderFetchRef.current = false
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const params: Record<string, string> = { page: String(page), limit: String(pageSize), statusOrder: JSON.stringify(statusOrder) }
      if (statusFilter !== 'all') params.status = statusFilter
      // Filter by category based on active tab
      if (feedbackTab === 'support') {
        params.category = 'support'
      } else {
        params.category = '!support'
      }
      const { data } = await apiClient.get('/api/feedback', { params })
      setFeedbackList(data.feedback || [])
      setTotal(data.total || 0)
      if (data.statusCounts) setStatusCounts(data.statusCounts)
      // Initialise statusOrder from the user's saved preference (once, using ref to avoid re-fetch)
      if (!statusOrderInitialisedRef.current) {
        statusOrderInitialisedRef.current = true
        if (data.savedStatusOrder) {
          // Flag that the next fetchFeedback (triggered by statusOrder state change) should be skipped
          skipStatusOrderFetchRef.current = true
          setStatusOrder(data.savedStatusOrder)
        }
      }
      // The API tells us authoritatively whether we're admin
      if (typeof data.isAdmin === 'boolean') {
        setIsAdminFromApi(data.isAdmin)
      }
    } catch (err) {
      setLoadError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, statusFilter, statusOrder, feedbackTab])

  // Sync tab state when URL search params change (e.g. navigating from /support link)
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const newTab = tabParam === 'support' ? 'support' : tabParam === 'ai' ? 'ai' : 'general'
    setFeedbackTab(newTab)
  }, [searchParams])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  // Reset page when switching tabs
  useEffect(() => {
    setPage(1)
    setAllFeedbackExpanded(false)
  }, [feedbackTab])

  /** Read image files into base64 data URLs and append to an existing array (capped at 3). */
  const readImageFiles = (files: FileList | File[], existing: string[]): Promise<string[]> => {
    const remaining = 3 - existing.length
    const toRead = Array.from(files).slice(0, remaining)
    return Promise.all(toRead.map(file => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })))
  }

  const handleAttachFiles = async (files: FileList | null, setter: React.Dispatch<React.SetStateAction<string[]>>, current: string[]) => {
    if (!files || files.length === 0) return
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    const newImages = await readImageFiles(imageFiles, current)
    setter(prev => [...prev, ...newImages].slice(0, 3))
  }

  const handlePasteImage = async (
    e: React.ClipboardEvent,
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(i => i.kind === 'file' && i.type.startsWith('image/'))
    if (imageItems.length === 0) return
    const files = imageItems.map(i => i.getAsFile()).filter(Boolean) as File[]
    const newImages = await readImageFiles(files, current)
    setter(prev => [...prev, ...newImages].slice(0, 3))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setSubmitting(true)
    setSubmitError('')
    setSubmitSuccess(false)

    try {
      const resp = await apiClient.post('/api/feedback', {
        message: message.trim(),
        category: 'general',
        attachments,
      })
      if (!resp.data?.feedback?.id) {
        // Server returned 2xx but no feedback object — treat as failure
        throw new Error('Unexpected response — feedback may not have been saved')
      }
      setMessage('')
      setAttachments([])
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 5000)
      // Refresh the list so the new item appears immediately
      if (page === 1) await fetchFeedback()
      else setPage(1)
    } catch (err) {
      console.error('Feedback submit error:', err)
      setSubmitError((err as { response?: { data?: { error?: string } } }).response?.data?.error || (err as { message?: string }).message || 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supportDescription.trim()) return

    setSupportSubmitting(true)
    setSupportError('')
    setSupportSuccess(false)

    const typeLabel = { bug: 'Bug Report', access: 'Access Issue', integration: 'Integration Help', other: 'Other' }[supportType]
    const fullMessage = [
      supportSubject ? `Subject: ${supportSubject}` : '',
      `Type: ${typeLabel}`,
      '',
      supportDescription.trim(),
      supportSteps.trim() ? `\nSteps to reproduce / additional context:\n${supportSteps.trim()}` : '',
    ].filter(Boolean).join('\n')

    try {
      const resp = await apiClient.post('/api/feedback', {
        message: fullMessage,
        category: 'support',
        attachments: supportAttachments,
      })
      if (!resp.data?.feedback?.id) {
        throw new Error('Unexpected response - support request may not have been saved')
      }
      setSupportSubject('')
      setSupportType('bug')
      setSupportDescription('')
      setSupportSteps('')
      setSupportAttachments([])
      setSupportSuccess(true)
      setTimeout(() => setSupportSuccess(false), 5000)
      if (page === 1) await fetchFeedback()
      else setPage(1)
    } catch (err) {
      setSupportError((err as { response?: { data?: { error?: string } } }).response?.data?.error || (err as { message?: string }).message || 'Failed to submit support request')
    } finally {
      setSupportSubmitting(false)
    }
  }

  const handleSetStatus = async (feedbackId: string, status: string) => {
    setUpdatingId(feedbackId)
    try {
      await apiClient.patch(`/api/feedback/${feedbackId}`, { status })
      fetchFeedback()
    } catch { /* ignore */ } finally {
      setUpdatingId(null)
    }
  }

  const handleStatusOrderChange = async (newOrder: string[]) => {
    setStatusOrder(newOrder)
    setPage(1)
    // Persist the preference to the user's account
    try {
      await apiClient.put('/api/auth/profile', { feedbackStatusOrder: newOrder })
    } catch {
      // Non-critical — the order still applies for the current session
    }
  }

  // ── Drag-and-drop handlers for status order ──
  const handleDragStart = (status: string) => {
    setDraggedStatus(status)
  }

  const handleDragOver = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    if (!draggedStatus || draggedStatus === targetStatus) return
    const newOrder = [...statusOrder]
    const fromIdx = newOrder.indexOf(draggedStatus)
    const toIdx = newOrder.indexOf(targetStatus)
    if (fromIdx === -1 || toIdx === -1) return
    newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, draggedStatus)
    setStatusOrder(newOrder)
  }

  const handleDragEnd = () => {
    if (draggedStatus) {
      handleStatusOrderChange(statusOrder)
    }
    setDraggedStatus(null)
  }

  const STATUS_LABELS: Record<string, string> = {
    open: 'Received',
    reviewed: 'Acknowledged',
    affirmed: 'Affirmed',
    resolved: 'Resolved',
    dismissed: 'Dismissed',
  }

  const STATUS_COLORS: Record<string, string> = {
    open: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
    reviewed: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    affirmed: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700',
    resolved: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
    dismissed: 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600',
  }

  const STATUS_TEXT_COLORS: Record<string, string> = {
    open: 'text-yellow-800 dark:text-yellow-200',
    reviewed: 'text-blue-800 dark:text-blue-200',
    affirmed: 'text-indigo-800 dark:text-indigo-200',
    resolved: 'text-green-800 dark:text-green-200',
    dismissed: 'text-gray-600 dark:text-gray-400',
  }

  const handleRespond = async (feedbackId: string) => {
    if (!adminResponse.trim()) return
    setUpdatingId(feedbackId)
    try {
      await apiClient.post(`/api/feedback/${feedbackId}/responses`, {
        message: adminResponse.trim(),
      })
      setAdminResponse('')
      setExpandedId(null)
      fetchFeedback()
    } catch { /* ignore */ } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteFeedback = async (id: string) => {
    setUpdatingId(id)
    try {
      await apiClient.delete(`/api/feedback/${id}`)
      setFeedbackList(prev => prev.filter(f => f.id !== id))
      setTotal(prev => Math.max(0, prev - 1))
      setConfirmDeleteId(null)
      if (expandedId === id) setExpandedId(null)
    } catch { /* ignore */ } finally {
      setUpdatingId(null)
    }
  }

  // ── Status progression helpers ────────────────────────────────────
  type StatusStep = { key: string; label: string }
  const STATUS_STEPS: StatusStep[] = [
    { key: 'open', label: 'Received' },
    { key: 'reviewed', label: 'Acknowledged' },
    { key: 'affirmed', label: 'Affirmed' },
    { key: 'resolved', label: 'Resolved' },
  ]

  /** Which steps are "completed" given the current status */
  const getCompletedSteps = (status: string): Set<string> => {
    const completed = new Set<string>()
    completed.add('open') // always received
    if (status === 'reviewed' || status === 'affirmed' || status === 'resolved') {
      completed.add('reviewed')
    }
    if (status === 'affirmed') completed.add('affirmed')
    if (status === 'resolved') {
      completed.add('affirmed')
      completed.add('resolved')
    }
    return completed
  }

  /** The currently active step (the one that was most recently set) */
  const getActiveStep = (status: string): string => {
    if (status === 'dismissed') return 'dismissed'
    return status
  }

  /** Render the visual progress stepper */
  const renderProgressStepper = (item: FeedbackItem) => {
    const completed = getCompletedSteps(item.status)
    const activeStep = getActiveStep(item.status)
    const isDismissed = item.status === 'dismissed'
    const isUpdating = updatingId === item.id

    if (isDismissed) {
      return (
        <div className="py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
            <XCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Dismissed</span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-muted-foreground">Move to:</span>
              {STATUS_STEPS.map(step => (
                <button
                  key={step.key}
                  onClick={() => handleSetStatus(item.id, step.key)}
                  disabled={isUpdating}
                  className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent/60 disabled:opacity-50 transition-colors"
                >
                  {step.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="flex items-center gap-0 py-2 overflow-x-auto">
        {STATUS_STEPS.map((step, idx) => {
          const isCompleted = completed.has(step.key)
          const isActive = activeStep === step.key
          const canClick = isAdmin && !isUpdating

          // Clicking any step sets the status directly to that step
          const handleClick = () => {
            if (!canClick) return
            handleSetStatus(item.id, step.key)
          }

          // Colors -- only the ACTIVE step shows its status colour.
          // Completed (but not active) steps stay neutral so users see a single
          // current status at a glance.
          let iconColor = 'text-gray-300 dark:text-gray-600'
          let textColor = 'text-muted-foreground'
          let lineColor = 'bg-gray-200 dark:bg-gray-700'

          if (isCompleted) {
            // Faint indicator that the step has been reached, but no status colour.
            iconColor = 'text-muted-foreground'
            textColor = 'text-muted-foreground'
            lineColor = 'bg-border'
          }

          if (isActive) {
            iconColor = step.key === 'affirmed'
              ? 'text-blue-500 dark:text-blue-400'
              : step.key === 'resolved'
                ? 'text-green-500 dark:text-green-400'
                : step.key === 'open'
                  ? 'text-yellow-500 dark:text-yellow-400'
                  : 'text-primary'
            textColor = step.key === 'affirmed'
              ? 'text-blue-700 dark:text-blue-300 font-medium'
              : step.key === 'resolved'
                ? 'text-green-700 dark:text-green-300 font-medium'
                : step.key === 'open'
                  ? 'text-yellow-700 dark:text-yellow-300 font-medium'
                  : 'text-foreground font-medium'
          }

          return (
            <div key={step.key} className="flex items-center">
              {/* Connector line (before item, except first) */}
              {idx > 0 && (
                <div className={`w-4 sm:w-6 h-0.5 ${isCompleted ? lineColor : 'bg-gray-200 dark:bg-gray-700'} flex-shrink-0`} />
              )}

              {/* Step */}
              <button
                type="button"
                disabled={!canClick}
                onClick={handleClick}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all flex-shrink-0 ${
                  canClick
                    ? 'hover:bg-accent/60 cursor-pointer'
                    : 'cursor-default'
                } ${isActive ? 'bg-accent/40 ring-1 ring-primary/20' : ''}`}
                title={isAdmin ? `Set status to ${step.label}` : step.label}
              >
                {isCompleted ? (
                  <CheckCircle2 className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
                ) : (
                  <Circle className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
                )}
                <span className={`text-xs whitespace-nowrap ${textColor}`}>
                  {step.label}
                </span>
              </button>
            </div>
          )
        })}

        {/* Dismiss option for admin (far right) */}
        {isAdmin && (
          <div className="flex items-center ml-auto pl-2 flex-shrink-0">
            <button
              onClick={() => handleSetStatus(item.id, 'dismissed')}
              disabled={isUpdating}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
              title="Dismiss this feedback"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dismiss</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  const getSubmitterLabel = (item: FeedbackItem): string => {
    if (item.user_display_name) return item.user_display_name
    if (item.user_email) return item.user_email
    if (item.discord_username) return `@${item.discord_username}`
    return 'Unknown'
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <>
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          Feedback
          {isAdmin ? (
            <span className="inline-flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 px-2 py-0.5 rounded-full font-medium">
              <Shield className="w-3 h-3" />
              Admin
            </span>
          ) : user?.accountType === 'traveler' ? (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 px-2 py-0.5 rounded-full font-medium">
              <Globe className="w-3 h-3" />
              Traveler
            </span>
          ) : user ? (
            <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 px-2 py-0.5 rounded-full font-medium">
              <UserCheck className="w-3 h-3" />
              Verified
            </span>
          ) : null}
        </h1>
        <p className="text-muted-foreground mt-1">
          Share your thoughts, report bugs, or suggest features.
          {isAdmin && (
            <span className="inline-flex items-center gap-1 ml-2 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 px-2 py-0.5 rounded-full">
              <Shield className="w-3 h-3" />
              Viewing all feedback
            </span>
          )}
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setSearchParams({}, { replace: true })}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            feedbackTab === 'general'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Feedback
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'support' }, { replace: true })}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            feedbackTab === 'support'
              ? 'border-blue-500 text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          Support Request
        </button>
        {canViewAiFeedback && (
          <button
            onClick={() => setSearchParams({ tab: 'ai' }, { replace: true })}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              feedbackTab === 'ai'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            AI Feedback
          </button>
        )}
      </div>

      {/* AI Feedback Tab */}
      {feedbackTab === 'ai' && canViewAiFeedback ? (
        <AiFeedbackPage embedded statusOrder={statusOrder} />
      ) : feedbackTab === 'support' ? (
      <>
        {/* ── Support Request Form ── */}
        <form
          onSubmit={handleSupportSubmit}
          onPaste={e => handlePasteImage(e, supportAttachments, setSupportAttachments)}
          className="rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-card p-5 space-y-4 relative"
        >
          <LearnerHelpIcon
            description="Submit a support request for technical issues, access problems, or integration help. Provide as much detail as possible so we can assist you quickly."
            size={4}
            className="absolute top-3 right-3 z-10"
          />
          <div className="flex items-center gap-2 mb-1">
            <LifeBuoy className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold">Submit a Support Request</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Describe your issue below. The more detail you provide, the faster we can help.
          </p>

          {/* Issue Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5">What type of issue are you experiencing?</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'bug' as const, label: 'Bug / Something broken', icon: '🐛' },
                { value: 'access' as const, label: 'Access / Login issue', icon: '🔑' },
                { value: 'integration' as const, label: 'Integration help (Zoom, Calendar, etc.)', icon: '🔗' },
                { value: 'other' as const, label: 'Other', icon: '💬' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSupportType(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-all ${
                    supportType === opt.value
                      ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950 ring-1 ring-blue-300 dark:ring-blue-700'
                      : 'border-border hover:border-blue-200 dark:hover:border-blue-800 hover:bg-accent/30'
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Subject <span className="text-muted-foreground font-normal">(brief summary)</span></label>
            <input
              type="text"
              value={supportSubject}
              onChange={e => setSupportSubject(e.target.value)}
              placeholder="e.g. Cannot connect Zoom account"
              maxLength={200}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Describe the issue <span className="text-red-500">*</span></label>
            <textarea
              value={supportDescription}
              onChange={e => setSupportDescription(e.target.value)}
              placeholder="What happened? What did you expect to happen? Please include any error messages you saw."
              rows={4}
              maxLength={2000}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>

          {/* Steps to reproduce */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Steps to reproduce <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              value={supportSteps}
              onChange={e => setSupportSteps(e.target.value)}
              placeholder={"1. Go to...\n2. Click on...\n3. See error..."}
              rows={3}
              maxLength={1000}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>

          {/* Screenshot attachments */}
          {supportAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {supportAttachments.map((src, i) => (
                <div key={i} className="relative group w-20 h-20 rounded-md overflow-hidden border border-border">
                  <img src={src} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewSrc(src)} />
                  <button
                    type="button"
                    onClick={() => setPreviewSrc(src)}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Enlarge"
                  >
                    <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupportAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Remove image"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input for support */}
          <input
            ref={supportAttachFileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={e => handleAttachFiles(e.target.files, setSupportAttachments, supportAttachments)}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{supportDescription.length} / 2000</span>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => supportAttachFileRef.current?.click()}
                  disabled={supportAttachments.length >= 3}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Attach a screenshot (or paste from clipboard)"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  {supportAttachments.length > 0 ? `${supportAttachments.length}/3 screenshots` : 'Add screenshot'}
                </button>
                {supportAttachments.length < 3 && (
                  <span className="text-xs text-muted-foreground/60 pl-1">or paste from clipboard (Ctrl+V)</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {supportError && (
                <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {supportError}
                </span>
              )}
              {supportSuccess && (
                <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Support request submitted!
                </span>
              )}
              <button
                type="submit"
                disabled={supportSubmitting || !supportDescription.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
                {supportSubmitting ? 'Sending...' : 'Submit Request'}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <span className="font-medium">Response time:</span> We aim to respond to support requests within 48 hours.
              For urgent issues you can also email us at{' '}
              <a href="mailto:support@coordinationmanager.com" className="underline">support@coordinationmanager.com</a>.
            </p>
          </div>
        </form>
      </>
      ) : feedbackTab === 'general' ? (
      <>

      {/* ── Submit Form ── */}
      <form
        onSubmit={handleSubmit}
        onPaste={e => handlePasteImage(e, attachments, setAttachments)}
        className="rounded-lg border border-border bg-card p-5 space-y-3 relative"
      >
        <LearnerHelpIcon
          description="Share your thoughts with the platform team. Report bugs, suggest features, or leave general comments. Your feedback helps improve the platform for everyone."
          size={4}
          className="absolute top-3 right-3 z-10"
        />
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="What's on your mind? Report a bug, suggest a feature, or share general feedback..."
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />

        {/* Image previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((src, i) => (
              <div key={i} className="relative group w-20 h-20 rounded-md overflow-hidden border border-border">
                <img src={src} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewSrc(src)} />
                <button
                  type="button"
                  onClick={() => setPreviewSrc(src)}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Enlarge"
                >
                  <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                </button>
                <button
                  type="button"
                  onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="Remove image"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={attachFileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={e => handleAttachFiles(e.target.files, setAttachments, attachments)}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{message.length} / 2000</span>
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => attachFileRef.current?.click()}
                disabled={attachments.length >= 3}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Attach image (or paste from clipboard)"
              >
                <Paperclip className="w-3.5 h-3.5" />
                {attachments.length > 0 ? `${attachments.length}/3 images` : 'Attach image'}
              </button>
              {attachments.length < 3 && (
                <span className="text-xs text-muted-foreground/60 pl-1">or paste from clipboard (Ctrl+V)</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {submitError && (
              <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                {submitError}
              </span>
            )}
            {submitSuccess && (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="w-3.5 h-3.5" />
                Submitted!
              </span>
            )}
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Sending...' : 'Submit'}
            </button>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <span className="font-medium">Privacy:</span> Your feedback is visible only to platform administrators. 
            It will not be shared publicly or with other users.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          You can also submit feedback via Discord using the <code className="bg-accent px-1 rounded">/feedback</code> command.
        </p>
      </form>
      </>
      ) : null}

      {/* ── Feedback / Support List (shared across general & support tabs) ── */}
      {feedbackTab !== 'ai' && (
      <div className={isAdmin ? 'rounded-lg border-2 border-red-400 dark:border-red-600 p-4' : ''}>
        {/* Section header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setAllFeedbackExpanded(prev => !prev)}
              className="flex items-center gap-2 text-lg font-semibold hover:opacity-80 transition-opacity"
            >
              {allFeedbackExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              {feedbackTab === 'support' ? 'All Support Requests' : 'All Feedback'}
              <span className={`inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full ${
                statusCounts.open > 0
                  ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}>
                {statusCounts.open} open
              </span>
              {statusCounts.reviewed > 0 && (
                <span className="text-sm text-muted-foreground font-normal">
                  {statusCounts.reviewed} acknowledged
                </span>
              )}
            </button>
          ) : (
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {feedbackTab === 'support' ? 'Your Support Requests' : 'Your Submissions'}
              <span className={`inline-flex items-center text-sm font-bold px-2 py-0.5 rounded-full ${
                statusCounts.open > 0
                  ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}>
                {statusCounts.open} open
              </span>
              {statusCounts.reviewed > 0 && (
                <span className="text-sm text-muted-foreground font-normal">
                  {statusCounts.reviewed} acknowledged
                </span>
              )}
            </h2>
          )}
          {/* Status filter (admin only, visible when expanded) */}
          {isAdmin && allFeedbackExpanded && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                className="px-2 py-1 border border-input rounded text-xs bg-background text-foreground focus:ring-1 focus:ring-ring outline-none"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="reviewed">Acknowledged</option>
                <option value="affirmed">Affirmed</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          )}
        </div>

        {/* Admin collapsed summary */}
        {isAdmin && !allFeedbackExpanded && (
          <div className="text-sm text-muted-foreground flex items-center gap-2 py-2">
            <Shield className="w-4 h-4 text-red-400 dark:text-red-500" />
            {statusCounts.open > 0
              ? <span>Contains private user {feedbackTab === 'support' ? 'support requests' : 'feedback'}. <span className="font-medium text-red-600 dark:text-red-400">{statusCounts.open} open</span> item{statusCounts.open !== 1 ? 's' : ''} to review.{statusCounts.reviewed > 0 && <span className="ml-1 text-blue-600 dark:text-blue-400">{statusCounts.reviewed} acknowledged.</span>}</span>
              : <span>Nothing new to review -- all {feedbackTab === 'support' ? 'support requests have' : 'feedback has'} been addressed.</span>
            }
          </div>
        )}

        {/* Expandable content (always visible for non-admins) */}
        {(!isAdmin || allFeedbackExpanded) && (<>

        {/* ── Drag-to-reorder status groups ── */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Order by:</span>
          {statusOrder.map(status => (
            <div
              key={status}
              draggable
              onDragStart={() => handleDragStart(status)}
              onDragOver={e => handleDragOver(e, status)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium cursor-grab active:cursor-grabbing select-none transition-all ${
                STATUS_COLORS[status] || 'bg-accent text-foreground border-border'
              } ${draggedStatus === status ? 'opacity-50 scale-95' : 'hover:shadow-sm'}`}
            >
              <GripVertical className="w-3 h-3 opacity-40" />
              {STATUS_LABELS[status] || status}
            </div>
          ))}
        </div>

        {/* ── Top pagination controls ── */}
        {!loading && !loadError && (total > 0 || feedbackList.length > 0) && (
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Show:</span>
              {[5, 10, 25, 50].map(size => (
                <button
                  key={size}
                  onClick={() => { setPageSize(size); setPage(1) }}
                  className={`px-2 py-1 rounded border text-xs transition-colors ${
                    pageSize === size
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  {size}
                </button>
              ))}
              <span>per page</span>
              <span className="ml-2 text-muted-foreground/60">{total} total</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-md border border-border text-sm disabled:opacity-50 hover:bg-accent/50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-md border border-border text-sm disabled:opacity-50 hover:bg-accent/50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading feedback...</div>
        ) : loadError ? (
          <div className="text-center py-8 text-sm text-red-600 dark:text-red-400 flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {loadError}
          </div>
        ) : feedbackList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {feedbackTab === 'support' ? 'No support requests yet.' : 'No feedback yet. Be the first to share your thoughts!'}
          </div>
        ) : (
          <div className="space-y-3">
            {feedbackList.map(item => {
              const isExpanded = expandedId === item.id
              const hasResponses = item.feedback_responses?.length > 0
              const responseCount = item.feedback_responses?.length || 0

              return (
                <div
                  key={item.id}
                  className={`rounded-lg border transition-colors ${
                    item.status === 'dismissed'
                      ? 'border-border/50 bg-card/50 opacity-70'
                      : item.status === 'affirmed'
                        ? 'border-blue-200 dark:border-blue-800/60 bg-card'
                        : item.status === 'resolved'
                          ? 'border-green-200 dark:border-green-800/60 bg-card'
                          : 'border-border bg-card'
                  }`}
                >
                  {/* ── Card body ── */}
                  <div className="p-4 pb-2">
                    {/* Header: who + when + source */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.user_avatar_url ? (
                          <img src={item.user_avatar_url} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[10px] font-medium">
                            {getSubmitterLabel(item).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-foreground">{getSubmitterLabel(item)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          item.source === 'bot'
                            ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}>
                          {item.source === 'bot' ? 'Discord' : 'Web'}
                        </span>
                        {item.attachments && item.attachments.length > 0 && (
                          <span className="flex items-center gap-0.5 text-muted-foreground" title={`${item.attachments.length} image${item.attachments.length !== 1 ? 's' : ''} attached`}>
                            <Paperclip className="w-3 h-3" />
                            <span className="text-[10px]">{item.attachments.length}</span>
                          </span>
                        )}
                      </div>
                      <time className="flex-shrink-0">{formatDateTimeInTimezone(item.created_at, getPrimaryTimezone())}</time>
                    </div>

                    {/* Message */}
                    <p className={`text-sm whitespace-pre-wrap mb-1 ${STATUS_TEXT_COLORS[item.status] || ''}`}>{item.message}</p>

                    {/* Attachments */}
                    {item.attachments && item.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {item.attachments.map((src, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={src}
                              alt={`Attachment ${i + 1}`}
                              className="w-24 h-24 object-cover rounded-md border border-border cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setPreviewSrc(src)}
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewSrc(src)}
                              className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
                              title="Enlarge"
                            >
                              <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Progress stepper ── */}
                  <div className="px-4 border-t border-border/50">
                    {renderProgressStepper(item)}
                  </div>

                  {/* ── Admin response thread (visible to everyone) ── */}
                  {hasResponses && (
                    <div className="px-4 pb-1 border-t border-border/50">
                      {/* Threaded responses */}
                      {hasResponses && (
                        <div className="mt-2 space-y-2 pb-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Reply className="w-3 h-3" />
                            <span>{responseCount} {responseCount === 1 ? 'reply' : 'replies'}</span>
                          </div>
                          {item.feedback_responses.map(resp => (
                            <div key={resp.id} className="ml-2 rounded-md bg-accent/20 border-l-2 border-primary/40 p-3 text-sm">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <div className="flex items-center gap-2">
                                  {resp.admin_avatar_url ? (
                                    <img src={resp.admin_avatar_url} alt="" className="w-4 h-4 rounded-full" />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-medium">
                                      {(resp.admin_display_name || 'A').charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span className="font-medium text-foreground">
                                    {resp.admin_display_name || 'Admin'}
                                  </span>
                                  <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200">
                                    Admin
                                  </span>
                                </div>
                                <time>{formatDateTimeInTimezone(resp.created_at, getPrimaryTimezone())}</time>
                              </div>
                              <p className="whitespace-pre-wrap">{resp.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Admin reply toggle ── */}
                  {isAdmin && (
                    <div className="px-4 py-2 border-t border-border/50 flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedId(null)
                          } else {
                            setExpandedId(item.id)
                            setAdminResponse('')
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        {isExpanded ? 'Cancel reply' : 'Reply'}
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {/* Delete controls */}
                      <div className="ml-auto flex items-center gap-1">
                        {confirmDeleteId === item.id ? (
                          <>
                            <span className="text-xs text-red-500 mr-1">Delete permanently?</span>
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
                            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Delete this entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Admin reply form ── */}
                  {isAdmin && isExpanded && (
                    <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
                      <textarea
                        value={adminResponse}
                        onChange={e => setAdminResponse(e.target.value)}
                        placeholder="Write a reply..."
                        rows={2}
                        maxLength={2000}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespond(item.id)}
                          disabled={updatingId === item.id || !adminResponse.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          <Send className="w-3 h-3" />
                          {updatingId === item.id ? 'Sending...' : 'Send Reply'}
                        </button>
                        <button
                          onClick={() => { setExpandedId(null); setAdminResponse('') }}
                          className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent/50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── User-facing "Your feedback is being tracked" indicator ── */}
                  {!isAdmin && item.status !== 'open' && !hasResponses && (
                    <div className="px-4 py-2 border-t border-border/50">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Eye className="w-3.5 h-3.5 text-primary/60" />
                        <span>Your feedback has been seen by an admin</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-md border border-border text-sm disabled:opacity-50 hover:bg-accent/50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-md border border-border text-sm disabled:opacity-50 hover:bg-accent/50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
        </>)}
      </div>
      )}
    </div>

      {/* Lightbox overlay */}
      {previewSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewSrc(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewSrc(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            title="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
          <img
            src={previewSrc}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
