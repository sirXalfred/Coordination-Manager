import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface AiPageContext {
  /** Display name shown in panel header subtitle */
  pageName: string
  /** Suggested prompts shown when chat is empty */
  suggestions: string[]
  /** Input placeholder text */
  placeholder: string
  /**
   * Custom submit handler. If provided, the panel calls this instead of the
   * default /api/ai-chat endpoint. Should return the assistant's response text
   * and an optional action label for display.
   */
  onSubmit: (
    message: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) => Promise<{ message: string; action?: string; systemPrompt?: string }>
}

interface AiAssistantContextValue {
  pageContext: AiPageContext | null
  setPageContext: (ctx: AiPageContext | null) => void
}

// ── Context ─────────────────────────────────────────────────────────────────────

const AiAssistantContext = createContext<AiAssistantContextValue>({
  pageContext: null,
  setPageContext: () => {},
})

// ── Provider ────────────────────────────────────────────────────────────────────

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContextRaw] = useState<AiPageContext | null>(null)

  const setPageContext = useCallback((ctx: AiPageContext | null) => {
    setPageContextRaw(ctx)
  }, [])

  const value = useMemo(() => ({ pageContext, setPageContext }), [pageContext, setPageContext])

  return (
    <AiAssistantContext.Provider value={value}>
      {children}
    </AiAssistantContext.Provider>
  )
}

// ── Hook ────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components -- hook intentionally co-located with its provider
export function useAiAssistant() {
  return useContext(AiAssistantContext)
}
