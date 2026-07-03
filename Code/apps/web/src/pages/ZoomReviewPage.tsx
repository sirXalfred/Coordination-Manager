import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Video, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const SETTINGS_ZOOM_URL = '/settings?tab=calendar&section=integrations'

/**
 * Hidden page for Zoom Marketplace reviewers to test the OAuth integration.
 * Provides one-click guest login and redirects to the Zoom integration settings.
 */
export default function ZoomReviewPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading, loginAsTraveler } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingRedirect, setPendingRedirect] = useState(false)

  // Navigate only after React has committed the auth state update,
  // so ProtectedRoute sees isAuthenticated=true and doesn't redirect to login.
  // Also wait for authLoading to settle to avoid stale-session races.
  useEffect(() => {
    if (pendingRedirect && isAuthenticated && !authLoading) {
      navigate(SETTINGS_ZOOM_URL)
    }
  }, [pendingRedirect, isAuthenticated, authLoading, navigate])

  // While auth is still initialising, show a spinner
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-blue-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  const handleStartReview = async () => {
    if (isAuthenticated) {
      navigate(SETTINGS_ZOOM_URL)
      return
    }

    setError(null)
    setIsLoading(true)
    try {
      await loginAsTraveler()
      setPendingRedirect(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create test account'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-blue-950 flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center gap-2">
        <Calendar className="h-6 w-6 text-blue-600" />
        <span className="font-semibold text-lg text-gray-900 dark:text-white">Coordination Manager</span>
        <span className="ml-2 px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full uppercase tracking-wider">
          Zoom Review
        </span>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-lg">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8">
            {/* Icon */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-2xl flex items-center justify-center">
                <Video className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
              Zoom Integration Review
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              Welcome, Zoom Marketplace reviewer. This page will help you test the Zoom OAuth integration in Coordination Manager.
            </p>

            {/* Steps */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Click "Start Testing" below</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    A guest test account will be created automatically -- no email or password needed.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Connect your Zoom account</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    You will be redirected to Settings where you can click "Connect Zoom" to start the OAuth flow.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">3</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Verify the integration</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Once connected, the settings page will show your Zoom account details. You can also disconnect at any time.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleStartReview}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 text-white font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating test account...
                </>
              ) : isAuthenticated ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Go to Zoom Integration Settings
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  Start Testing
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
            )}

            {/* Info box */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">About this app</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Coordination Manager is a meeting coordination platform for the Cardano blockchain community. The Zoom integration allows users to generate Zoom meeting links directly when scheduling events on their coordination calendars.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
