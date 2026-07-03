import { createContext, useContext, ReactNode } from 'react'
import { useSetupStatus, SetupStatus, shouldTakeOverHome } from '../lib/setup-api'

interface SetupContextValue {
  status: SetupStatus | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  /** True when the homepage should be replaced by the wizard takeover. */
  shouldTakeOver: boolean
}

const SetupContext = createContext<SetupContextValue | undefined>(undefined)

export function SetupProvider({ children }: { children: ReactNode }) {
  const { status, loading, error, refresh } = useSetupStatus()
  const shouldTakeOver = shouldTakeOverHome(status, error)
  return (
    <SetupContext.Provider value={{ status, loading, error, refresh, shouldTakeOver }}>
      {children}
    </SetupContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook intentionally co-located with its provider
export function useSetup(): SetupContextValue {
  const ctx = useContext(SetupContext)
  if (!ctx) throw new Error('useSetup must be used inside <SetupProvider>')
  return ctx
}
