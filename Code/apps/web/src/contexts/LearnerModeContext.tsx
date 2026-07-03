import React, { createContext, useContext, useState } from 'react'

interface LearnerModeContextType {
  learnerMode: boolean
  setLearnerMode: (enabled: boolean) => void
}

const LearnerModeContext = createContext<LearnerModeContextType | undefined>(undefined)

const STORAGE_KEY = 'learner-mode'

export function LearnerModeProvider({ children }: { children: React.ReactNode }) {
  const [learnerMode, setLearnerModeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      // Default to true for new users (no stored preference yet)
      return stored === null ? true : stored === 'true'
    } catch {
      return true
    }
  })

  const setLearnerMode = (enabled: boolean) => {
    setLearnerModeState(enabled)
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled))
    } catch { /* ignore */ }
  }

  return (
    <LearnerModeContext.Provider value={{ learnerMode, setLearnerMode }}>
      {children}
    </LearnerModeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook intentionally co-located with its provider
export function useLearnerMode() {
  const ctx = useContext(LearnerModeContext)
  if (!ctx) throw new Error('useLearnerMode must be used within LearnerModeProvider')
  return ctx
}
