import { useState, useRef, useEffect } from 'react'
import { X, Sparkles, Send, Loader2, Trash2, MessageSquare, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import { apiClient } from '../lib/api-client'
import SentimentGrid from './SentimentGrid'
import LearnerHelpIcon from './LearnerHelpIcon'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface AiMessage {
  id: string
  userPrompt: string
  aiResponse: string
  timestamp: Date
  action?: string
}

interface SentimentState {
  valence: number
  trust: number
  feedbackText: string
  submitted: boolean
  submitting: boolean
}

interface CalendarAiPanelProps {
  isOpen: boolean
  onClose: () => void
  messages: AiMessage[]
  onClearMessages: () => void
  // Input & submission
  inputValue: string
  onInputChange: (value: string) => void
  onSubmit: () => void
  isSending: boolean
  error: string
  onClearError: () => void
  remaining: number | null
  limit: number | null
  // Context
  isRoomMode: boolean
  placeholder?: string
}

// ── Component ───────────────────────────────────────────────────────────────────

export function CalendarAiPanel({
  isOpen,
  onClose,
  messages,
  onClearMessages,
  inputValue,
  onInputChange,
  onSubmit,
  isSending,
  error,
  onClearError,
  remaining,
  limit,
  isRoomMode,
  placeholder,
}: CalendarAiPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [expandedFeedbackIdx, setExpandedFeedbackIdx] = useState<number | null>(null)
  const [sentimentStates, setSentimentStates] = useState<Record<number, SentimentState>>({})

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350)
    }
  }, [isOpen])

  // Scroll to bottom on new messages (within the panel only, not the page)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  const toggleFeedback = (idx: number) => {
    setExpandedFeedbackIdx(prev => prev === idx ? null : idx)
    // Initialise sentiment state if not exists
    if (!sentimentStates[idx]) {
      setSentimentStates(prev => ({
        ...prev,
        [idx]: { valence: 0, trust: 0, feedbackText: '', submitted: false, submitting: false },
      }))
    }
  }

  const handleSubmitFeedback = async (idx: number) => {
    const msg = messages[idx]
    const state = sentimentStates[idx]
    if (!msg || !state || state.submitted || state.submitting) return

    setSentimentStates(prev => ({ ...prev, [idx]: { ...prev[idx], submitting: true } }))

    try {
      await apiClient.post('/api/ai-feedback', {
        user_prompt: msg.userPrompt,
        ai_answer: msg.aiResponse,
        sentiment_valence: state.valence,
        sentiment_trust: state.trust,
        feedback_text: state.feedbackText || null,
      })
      setSentimentStates(prev => ({ ...prev, [idx]: { ...prev[idx], submitted: true, submitting: false } }))
    } catch {
      setSentimentStates(prev => ({ ...prev, [idx]: { ...prev[idx], submitting: false } }))
    }
  }

  const defaultPlaceholder = isRoomMode
    ? 'e.g. "mark me available everywhere except where I\'m busy"'
    : 'Share context — I\'ll help draft your Coordination Calendar'

  return (
    <>
      {/* Backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`
          fixed top-0 right-0 z-50 h-full w-[22rem] sm:w-96
          bg-card border-l border-border
          flex flex-col
          shadow-xl dark:shadow-[var(--shadow-elevated)]
          dark:border-[hsl(217.2,32.6%,22.5%)]
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{ boxShadow: 'var(--shadow-elevated)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-semibold text-foreground">
              {isRoomMode ? 'AI Availability Assistant' : 'AI Calendar Assistant'}
            </span>
            <LearnerHelpIcon size={4} description={<><p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Side Panel — Calendar AI</p><p className="mb-1.5">Side panels slide in from the right on every page, giving you quick access to conversational tools without leaving what you’re doing.</p><p className="mb-1.5">This <strong>Calendar AI Assistant</strong> can analyze participant availability, suggest optimal meeting times, and help you configure your coordination calendar using natural language.</p><p><strong>Try asking:</strong> “When can most people meet?” or “Set the time range to business hours.”</p></>} />
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={onClearMessages}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Clear history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <div className="text-center py-6">
                <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">
                  {isRoomMode ? 'Availability Assistant' : 'Calendar Assistant'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRoomMode
                    ? 'Tell me how you\'d like to set your availability and I\'ll fill in the calendar for you.'
                    : 'Describe your event and I\'ll configure the calendar settings.'}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-1">Try saying:</p>
                {(isRoomMode
                  ? [
                      'Mark me available everywhere except where I\'m busy',
                      'Only mark mornings (9 AM – 12 PM)',
                      'Remove weekends from my availability',
                      'Clear my availability',
                    ]
                  : [
                      'Set hours to business hours',
                      'Call it Team Standup and make it public',
                      'Skip weekends next week',
                      'Make it a generic week',
                    ]
                ).map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      onInputChange(q)
                      setTimeout(() => onSubmit(), 50)
                    }}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border text-muted-foreground
                               hover:border-purple-300 dark:hover:border-purple-700 hover:text-foreground transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={msg.id} className="space-y-2">
                {/* User prompt */}
                <div className="rounded-lg p-3 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-800/30 ml-6">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageSquare className="w-3 h-3 text-purple-500" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">You</span>
                  </div>
                  <p className="text-xs text-foreground">{msg.userPrompt}</p>
                </div>

                {/* AI Response */}
                <div className="rounded-lg p-3 bg-muted/50 border border-border mr-6">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">AI</span>
                    {msg.action && msg.action !== 'none' && (
                      <span className="ml-auto text-[9px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 rounded">
                        {msg.action === 'set_availability' ? 'Applied' : msg.action === 'clear_availability' ? 'Cleared' : msg.action === 'configure' ? 'Configured' : msg.action}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{msg.aiResponse}</p>

                  {/* Feedback toggle */}
                  <button
                    onClick={() => toggleFeedback(idx)}
                    className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expandedFeedbackIdx === idx ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {sentimentStates[idx]?.submitted ? 'Feedback submitted' : 'Give feedback'}
                  </button>

                  {/* Feedback panel */}
                  {expandedFeedbackIdx === idx && sentimentStates[idx] && (
                    <div className="mt-2 pt-2 border-t border-border space-y-2">
                      {sentimentStates[idx].submitted ? (
                        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Thank you for your feedback!
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-center">
                            <SentimentGrid
                              valence={sentimentStates[idx].valence}
                              trust={sentimentStates[idx].trust}
                              onChange={(v, t) =>
                                setSentimentStates(prev => ({
                                  ...prev,
                                  [idx]: { ...prev[idx], valence: v, trust: t },
                                }))
                              }
                              size={160}
                              disabled={sentimentStates[idx].submitting}
                            />
                          </div>
                          <textarea
                            value={sentimentStates[idx].feedbackText}
                            onChange={(e) =>
                              setSentimentStates(prev => ({
                                ...prev,
                                [idx]: { ...prev[idx], feedbackText: e.target.value },
                              }))
                            }
                            placeholder="Optional: any additional thoughts..."
                            rows={2}
                            disabled={sentimentStates[idx].submitting}
                            className="w-full px-2 py-1.5 border border-border rounded text-xs bg-background text-foreground resize-none focus:ring-1 focus:ring-purple-400 outline-none disabled:opacity-50"
                          />
                          <button
                            onClick={() => handleSubmitFeedback(idx)}
                            disabled={sentimentStates[idx].submitting}
                            className="w-full px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                          >
                            {sentimentStates[idx].submitting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            Submit Feedback
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
              Thinking...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error bar */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-950/50 border-y border-red-200 dark:border-red-800 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-red-600 dark:text-red-400 flex-1">{error}</p>
              <button onClick={onClearError} className="text-red-400 hover:text-red-600 shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="px-3 py-3 border-t border-border flex-shrink-0">
          {remaining !== null && limit !== null && (
            <p className="text-[10px] text-muted-foreground mb-1.5 px-1">
              {remaining}/{limit} AI prompts remaining today
            </p>
          )}
          <div className="flex gap-2 items-center border border-border rounded-lg px-3 py-2
                          focus-within:border-purple-400 dark:focus-within:border-purple-600 transition-colors bg-background">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={remaining === 0 ? 'Daily AI limit reached' : (placeholder || defaultPlaceholder)}
              disabled={remaining === 0}
              className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder-muted-foreground/50 disabled:opacity-50"
            />
            <button
              onClick={onSubmit}
              disabled={!inputValue.trim() || isSending || remaining === 0}
              className="p-1.5 rounded-md text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6, #6366F1, #3B82F6)',
              }}
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
