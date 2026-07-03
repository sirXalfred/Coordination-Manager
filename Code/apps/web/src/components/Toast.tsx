import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'
import { Check, X, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

// eslint-disable-next-line react-refresh/only-export-components -- hook intentionally co-located with its provider
export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId.current++
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastNotification key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastNotification({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  const icon = toast.type === 'success' ? <Check className="w-4 h-4" /> :
    toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> :
    <Info className="w-4 h-4" />

  const colors = toast.type === 'success'
    ? 'bg-green-600 text-white'
    : toast.type === 'error'
    ? 'bg-red-600 text-white'
    : 'bg-blue-600 text-white'

  return (
    <div className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${colors} animate-slide-in-right min-w-[250px] max-w-[400px]`}>
      {icon}
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="p-0.5 rounded hover:bg-white/20 transition-colors shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
