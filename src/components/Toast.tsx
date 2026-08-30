import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface ToastItem {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
}

interface ToastOptions {
  actionLabel?: string
  onAction?: () => void
  /** ms até sumir sozinho; 0 desativa o auto-dismiss */
  duration?: number
}

type ShowToast = (message: string, opts?: ToastOptions) => void

const ToastContext = createContext<ShowToast | null>(null)

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const timerRef = useRef<number | null>(null)
  const nextId = useRef(0)

  const show = useCallback<ShowToast>((message, opts) => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    const id = ++nextId.current
    setToast({ id, message, actionLabel: opts?.actionLabel, onAction: opts?.onAction })
    const duration = opts?.duration ?? (opts?.onAction ? 6000 : 3000)
    if (duration > 0) {
      timerRef.current = window.setTimeout(() => {
        setToast((cur) => (cur?.id === id ? null : cur))
      }, duration)
    }
  }, [])

  const dismiss = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    setToast(null)
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="toastwrap" role="status" aria-live="polite">
          <div className="toast">
            <span>{toast.message}</span>
            {toast.actionLabel && (
              <button
                className="toast-action"
                onClick={() => {
                  toast.onAction?.()
                  dismiss()
                }}
              >
                {toast.actionLabel}
              </button>
            )}
            <button className="toast-close" onClick={dismiss} aria-label="Fechar aviso"><X /></button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
