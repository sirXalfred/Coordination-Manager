import { Callout } from '../components/Callout'

export function ZoomIntegrationPage() {
  return (
    <div className="prose-docs">
      <h1>Zoom Integration</h1>
      <p className="text-lg text-gray-400 mb-8">
        Connect your Zoom account to create meeting links directly from Coordination Manager
        calendars. This guide covers adding, using, and removing the integration.
      </p>

      {/* ── Adding the Integration ─────────────────────── */}
      <h2>Connecting Your Zoom Account</h2>
      <ol>
        <li>
          Navigate to <strong>Settings</strong> in the Coordination Manager web app.
        </li>
        <li>
          Open the <strong>Calendar &amp; Integrations</strong> tab and scroll to the
          <strong> Video Conferencing</strong> section.
        </li>
        <li>
          Click <strong>Connect Zoom Account</strong>. You will be redirected to Zoom's
          authorization page.
        </li>
        <li>
          Sign in with your Zoom account (or confirm if already signed in) and click
          <strong> Allow</strong> to grant Coordination Manager access.
        </li>
        <li>
          You will be redirected back to Settings. A success message confirms the connection,
          and your Zoom display name and email appear in the integration card.
        </li>
      </ol>

      <Callout variant="info" title="Permissions requested">
        Coordination Manager requests only two Zoom permissions:
        <ul className="mt-2 mb-0">
          <li><strong>Create meetings</strong> -- to generate Zoom meeting links when you schedule events.</li>
          <li><strong>View your profile</strong> -- to display your Zoom name and email in Settings.</li>
        </ul>
        No other data is accessed.
      </Callout>

      {/* ── Using the Integration ──────────────────────── */}
      <h2>Creating Zoom Meetings</h2>
      <p>
        Once connected, you can generate Zoom meeting links when confirming or creating
        calendar events:
      </p>
      <ol>
        <li>
          Open a calendar and select a confirmed meeting time, or create a new event.
        </li>
        <li>
          In the event details, click the <strong>Add Zoom Meeting</strong> button
          (or toggle the Zoom option when creating an event).
        </li>
        <li>
          A Zoom meeting is created automatically with the event title, date, time, and
          duration. The join link is attached to the event and visible to all participants.
        </li>
      </ol>

      <Callout variant="tip" title="Instant vs. scheduled meetings">
        If you provide a start time, a <em>scheduled</em> Zoom meeting is created.
        If no start time is set, an <em>instant</em> meeting link is generated instead.
      </Callout>

      {/* ── Data & Security ────────────────────────────── */}
      <h2>Data &amp; Security</h2>
      <ul>
        <li>
          <strong>OAuth tokens</strong> (access and refresh) are stored encrypted using
          AES-256-GCM on the server. They are never sent to the frontend.
        </li>
        <li>
          <strong>Profile info</strong> (Zoom display name and email) is stored so you can
          see which account is connected. No other Zoom data is stored.
        </li>
        <li>
          <strong>Meeting data</strong> -- only the join URL and meeting ID are shown in
          calendar events. Full meeting details remain in your Zoom account.
        </li>
        <li>
          Tokens are automatically refreshed when they expire. If a refresh fails, you
          will be prompted to reconnect.
        </li>
      </ul>

      {/* ── Removing the Integration ───────────────────── */}
      <h2>Disconnecting Zoom</h2>
      <ol>
        <li>
          Go to <strong>Settings &gt; Calendar &amp; Integrations &gt; Video Conferencing</strong>.
        </li>
        <li>
          Click <strong>Disconnect</strong> next to your connected Zoom account.
        </li>
        <li>
          All stored tokens and Zoom account metadata are immediately deleted from
          Coordination Manager.
        </li>
      </ol>
      <p>
        You can also revoke access from your Zoom account directly at{' '}
        <a
          href="https://marketplace.zoom.us/user/installed"
          target="_blank"
          rel="noopener noreferrer"
        >
          marketplace.zoom.us/user/installed
        </a>. When you uninstall the app from Zoom, Coordination Manager automatically
        removes your stored integration data.
      </p>

      <Callout variant="info" title="Re-connecting">
        You can reconnect at any time by clicking <strong>Connect Zoom Account</strong> again.
        No data from a previous connection is retained after disconnecting.
      </Callout>

      {/* ── Troubleshooting ────────────────────────────── */}
      <h2>Troubleshooting</h2>

      <h3>{"\"Application not found\" when connecting"}</h3>
      <p>
        This usually means the Zoom app has not been activated for your account. If you are
        not the app owner, ask the Coordination Manager administrator to add your Zoom email
        as a test user, or wait until the app is published on the Zoom Marketplace.
      </p>

      <h3>{"\"Token refresh failed\""}</h3>
      <p>
        Your Zoom authorization may have expired or been revoked. Disconnect and reconnect
        your Zoom account from Settings to resolve this.
      </p>

      <h3>Meeting creation fails</h3>
      <p>
        Verify that your Zoom account has permission to create meetings (most accounts do
        by default). If you hit a rate limit, wait a moment and try again.
      </p>

      {/* ── FAQ ────────────────────────────────────────── */}
      <h2>Frequently Asked Questions</h2>

      <h3>Do participants need a Zoom account?</h3>
      <p>
        No. Participants can join via the meeting link without a Zoom account, depending on
        the meeting host's Zoom settings.
      </p>

      <h3>Can multiple users connect their Zoom accounts?</h3>
      <p>
        Yes. Each user connects their own Zoom account independently. When that user creates
        an event with a Zoom meeting, the meeting is hosted under their Zoom account.
      </p>

      <h3>What happens to existing Zoom meetings if I disconnect?</h3>
      <p>
        Existing Zoom meetings remain active in your Zoom account. Only the integration link
        in Coordination Manager is removed. The meeting links already shared with participants
        continue to work.
      </p>
    </div>
  )
}
