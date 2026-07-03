/**
 * HomeRoute -- route-level wrapper for the `/` index.
 *
 * Renders the normal HomePage in the common case, but when running on
 * localhost AND the app is unconfigured / has missing env, it shows a
 * prominent takeover panel pointing the user at /setup. This is the
 * "most meaningful next action" replacement requested for new local users.
 */
import { Link } from 'react-router-dom'
import { useSetup } from '../contexts/SetupContext'

interface Props {
  children: React.ReactNode
}

export default function HomeRoute({ children }: Props) {
  const { status, error, shouldTakeOver, loading } = useSetup()

  if (loading) return <>{children}</>
  if (!shouldTakeOver) return <>{children}</>

  const apiMissing = status?.missing.api ?? []
  const webMissing = status?.missing.web ?? []

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
          Local development -- setup required
        </p>
        <h1 className="text-2xl md:text-3xl font-bold mb-3">
          Finish setting up Coordination Manager
        </h1>
        <p className="text-muted-foreground mb-6">
          The app is running, but it has no database connection yet. Pick a deployment mode
          to make the app usable.
        </p>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 mb-4 text-sm text-destructive">
            The API at <code>{import.meta.env.VITE_API_URL || 'http://localhost:3001'}</code> is
            not responding. Make sure it is running (e.g. <code>pnpm dev:api</code>).
          </div>
        )}

        {(apiMissing.length > 0 || webMissing.length > 0) && (
          <div className="rounded-md bg-muted/40 border border-border p-3 mb-4 text-sm">
            <p className="font-medium mb-1">Missing environment variables:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {apiMissing.map(k => (
                <li key={`api-${k}`}>
                  <code>{k}</code> (API)
                </li>
              ))}
              {webMissing.map(k => (
                <li key={`web-${k}`}>
                  <code>{k}</code> (Web)
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Link
            to="/setup"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium"
          >
            Open Setup Wizard
          </Link>
          <Link
            to="/settings?tab=ai&section=agent-api-keys"
            className="px-4 py-2 rounded-md border border-border"
          >
            Open Agent API Keys
          </Link>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          You see this because you are on localhost and required env vars are missing.
          In production this takeover never appears -- missing env is a deployment problem.
        </p>
      </div>
    </div>
  )
}
