import { useEffect } from 'react'

const CANONICAL_PRIVACY_URL = '/docs/legal/privacy-policy'

export default function PrivacyPolicyPage() {
  useEffect(() => {
    window.location.replace(CANONICAL_PRIVACY_URL)
  }, [])

  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center min-h-screen">
      <h1 className="text-2xl font-semibold mb-3">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Redirecting to the canonical policy source.
      </p>
      <a href={CANONICAL_PRIVACY_URL} className="text-blue-600 hover:underline">
        Continue to /docs/legal/privacy-policy
      </a>
    </div>
  )
}
