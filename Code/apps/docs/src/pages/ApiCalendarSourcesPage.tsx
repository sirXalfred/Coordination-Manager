import { Endpoint, ParamTable, ResponseExample } from '../components/Endpoint'
import { CodeBlock } from '../components/CodeBlock'
import { Callout } from '../components/Callout'

export function ApiCalendarSourcesPage() {
  return (
    <div className="prose-docs">
      <h1>Calendar Sources API</h1>
      <p className="text-lg text-gray-400 mb-8">
        Calendar sources are external calendar connections (Google Calendar accounts or public
        iCal URLs) that users link via the Settings page. The Agent API provides
        <strong> read-only</strong> access to list sources and fetch their events.
      </p>

      <Callout variant="info">
        Calendar sources must be connected by the user through the web UI (Settings → Calendar Connections).
        The Agent API cannot create or modify source connections — it can only read the events from
        already-connected calendars.
      </Callout>

      <h2>List Calendar Sources</h2>
      <Endpoint method="GET" path="/api/agent/calendar-sources" description="List the user's connected calendar sources (Google OAuth accounts and public iCal URLs)." scope="read">
        <p className="text-xs text-gray-400 mb-2">No query parameters.</p>
        <ResponseExample status={200} body={`{
  "sources": [
    {
      "id": "source-uuid-1",
      "source_type": "google_oauth",
      "google_email": "user@gmail.com",
      "public_url": null,
      "display_name": "Personal Google Calendar",
      "color": "#3B82F6",
      "is_active": true,
      "last_synced": "2026-03-02T10:00:00Z",
      "sync_error": null,
      "created_at": "2026-02-01T08:00:00Z"
    },
    {
      "id": "source-uuid-2",
      "source_type": "google_public_url",
      "google_email": null,
      "public_url": "https://calendar.google.com/calendar/ical/...",
      "display_name": "SingularityNET Meetings",
      "color": "#10B981",
      "is_active": true,
      "last_synced": null,
      "sync_error": null,
      "created_at": "2026-02-15T12:00:00Z"
    }
  ]
}`} />
      </Endpoint>

      <h2>Read Events from Calendar Sources</h2>
      <Endpoint method="GET" path="/api/agent/calendar-sources/events" description="Fetch actual calendar events from the user's connected Google Calendar sources within a date range. Supports both OAuth-connected calendars (via Google Calendar API) and public iCal URL feeds. Read-only — agents cannot create events on Google Calendar." scope="read">
        <ParamTable params={[
          { name: 'timeMin', type: 'string', required: true, description: 'Start of date range (ISO 8601, e.g. "2026-03-09T00:00:00Z")' },
          { name: 'timeMax', type: 'string', required: true, description: 'End of date range (ISO 8601, e.g. "2026-03-16T00:00:00Z")' },
          { name: 'sourceId', type: 'string', required: false, description: 'Filter to a specific source by UUID. Omit to query all active sources.' },
        ]} />
        <ResponseExample status={200} body={`{
  "events": [
    {
      "source_id": "source-uuid-1",
      "source_name": "Personal Google Calendar",
      "google_email": "user@gmail.com",
      "summary": "Team Standup",
      "description": "Daily sync with the team",
      "start": "2026-03-10T09:00:00Z",
      "end": "2026-03-10T09:30:00Z",
      "location": "https://meet.google.com/abc-defg-hij",
      "html_link": "https://www.google.com/calendar/event?eid=...",
      "status": "confirmed"
    },
    {
      "source_id": "source-uuid-1",
      "source_name": "Personal Google Calendar",
      "google_email": "user@gmail.com",
      "summary": "SingularityNET Ambassador Call",
      "start": "2026-03-11T14:00:00Z",
      "end": "2026-03-11T15:00:00Z",
      "location": "https://us02web.zoom.us/j/123456789",
      "html_link": "https://www.google.com/calendar/event?eid=...",
      "status": "confirmed"
    },
    {
      "source_id": "source-uuid-2",
      "source_name": "SingularityNET Meetings",
      "summary": "Process Guild Weekly",
      "start": "2026-03-12T12:00:00Z",
      "end": "2026-03-12T13:00:00Z"
    }
  ],
  "total": 3,
  "timeMin": "2026-03-09T00:00:00Z",
  "timeMax": "2026-03-16T00:00:00Z"
}`} />
      </Endpoint>

      <Callout variant="warning" title="Source errors">
        If a source fails to fetch (e.g. expired OAuth token), a <code>sourceErrors</code> array
        is included in the response alongside the successfully fetched events.
        The user may need to re-authorize the source in Settings.
      </Callout>

      <h2>Typical Agent Workflow</h2>
      <ol>
        <li>
          <strong>List sources</strong> — <code>GET /api/agent/calendar-sources</code> to discover
          which calendars are connected.
        </li>
        <li>
          <strong>Fetch events</strong> — <code>GET /api/agent/calendar-sources/events?timeMin=...&timeMax=...</code>
          to read upcoming meetings from the user's Google Calendar.
        </li>
        <li>
          <strong>Cross-reference</strong> — compare Google Calendar events with Coordination Calendar
          availability to find scheduling conflicts or optimal meeting times.
        </li>
      </ol>

      <h2>cURL Examples</h2>
      <CodeBlock language="bash" title="List calendar sources">{`curl -s https://api.coordinationmanager.com/api/agent/calendar-sources \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" | jq`}</CodeBlock>

      <CodeBlock language="bash" title="Fetch events for next week">{`curl -s "https://api.coordinationmanager.com/api/agent/calendar-sources/events?timeMin=2026-03-09T00:00:00Z&timeMax=2026-03-16T00:00:00Z" \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" | jq`}</CodeBlock>

      <CodeBlock language="bash" title="Fetch events from a specific source">{`curl -s "https://api.coordinationmanager.com/api/agent/calendar-sources/events?timeMin=2026-03-09T00:00:00Z&timeMax=2026-03-16T00:00:00Z&sourceId=source-uuid-1" \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" | jq`}</CodeBlock>
    </div>
  )
}
