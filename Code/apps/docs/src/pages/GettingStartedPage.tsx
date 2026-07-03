import { CodeBlock } from '../components/CodeBlock'
import { Callout } from '../components/Callout'
import { Link } from 'react-router-dom'

export function GettingStartedPage() {
  return (
    <div className="prose-docs">
      <h1>Getting Started</h1>
      <p className="text-lg text-gray-400 mb-8">
        Get your API key and make your first request to the Coordination Manager Agent API.
      </p>

      <h2>Step 1: Get an API Key</h2>
      <ol>
        <li>Log into the <strong>Coordination Manager</strong> web app.</li>
        <li>Go to <a href="https://coordinationmanager.com/settings?tab=ai&section=agent-api-keys" target="_blank" rel="noopener noreferrer"><strong>Settings -&gt; AI -&gt; Agent API Keys</strong></a> (the deep link scrolls straight to the Agent API Keys section of the AI tab).</li>
        <li>Click <strong>"Create New API Key"</strong>.</li>
        <li>Give your key a name (e.g., "My Scheduler Agent") and select the scopes you need (see <a href="#available-scopes">Available Scopes</a> below).</li>
        <li>Copy the key -- it will only be shown once. Store it in an environment variable such as <code>COORDINATION_API_KEY</code>.</li>
      </ol>

      <Callout variant="warning" title="Keep your key safe">
        Your API key grants access to your calendars and data. Never commit it to version control.
        Store it in environment variables or a secrets manager.
      </Callout>

      <h2>Step 2: Set Your Base URL</h2>
      <p>
        All Agent API endpoints are under <code>/api/agent</code>. Use the hosted base URL:
      </p>
      <CodeBlock language="text" title="Base URL">{`https://api.coordinationmanager.com/api/agent`}</CodeBlock>

      <Callout variant="info" title="Self-hosting?">
        Coordination Manager is fully open-source. If you deploy your own instance, replace the
        base URL with your API server address (e.g. <code>http://localhost:3001/api/agent</code> for
        local development).
      </Callout>

      <h2>Step 3: Verify Your Key</h2>
      <p>Make a simple request to the <code>/me</code> endpoint to verify your key works:</p>

      <CodeBlock language="bash" title="cURL">{`curl -s https://api.coordinationmanager.com/api/agent/me \\
  -H "Authorization: Bearer cm_agent_YOUR_KEY_HERE" | jq`}</CodeBlock>

      <p>Expected response:</p>
      <CodeBlock language="json" title="Response">{`{
  "agentKeyId": "abc123",
  "agentName": "My Scheduler Agent",
  "userId": "user-uuid-here",
  "scopes": ["read", "write:calendars", "write:meetings"]
}`}</CodeBlock>

      <h2>Step 4: List Your Calendars</h2>
      <CodeBlock language="bash" title="cURL">{`curl -s https://api.coordinationmanager.com/api/agent/calendars \\
  -H "Authorization: Bearer cm_agent_YOUR_KEY_HERE" | jq`}</CodeBlock>

      <CodeBlock language="json" title="Response">{`{
  "calendars": [
    {
      "id": "calendar-uuid",
      "hash": "abc123xyz",
      "title": "Team Standup",
      "visibility": "unlisted",
      "start_date": "2026-03-01",
      "end_date": "2026-03-07",
      "start_hour": 8,
      "end_hour": 18,
      "time_interval": 30,
      "timezone": "UTC",
      "created_at": "2026-02-28T10:00:00Z",
      "updated_at": "2026-02-28T10:00:00Z"
    }
  ]
}`}</CodeBlock>

      <h2>Step 5: Endpoint Summary</h2>
      <p>Here are all the Agent API endpoints available:</p>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>GET</td><td><code>/me</code></td><td>Verify API key and see scopes</td></tr>
          <tr><td>GET</td><td><code>/calendars</code></td><td>List your coordination calendars</td></tr>
          <tr><td>POST</td><td><code>/calendars</code></td><td>Create a coordination calendar</td></tr>
          <tr><td>GET</td><td><code>/calendars/:hash</code></td><td>Get calendar details</td></tr>
          <tr><td>GET</td><td><code>/calendars/:hash/availability</code></td><td>Read availability submissions</td></tr>
          <tr><td>POST</td><td><code>/calendars/:hash/availability</code></td><td>Submit availability for a participant</td></tr>
          <tr><td>GET</td><td><code>/calendars/:hash/meetings</code></td><td>List meetings on a calendar</td></tr>
          <tr><td>POST</td><td><code>/calendars/:hash/meetings</code></td><td>Create a meeting draft</td></tr>
          <tr><td>GET</td><td><code>/calendar-sources</code></td><td>List integrated Google Calendar sources</td></tr>
          <tr><td>GET</td><td><code>/calendar-sources/events</code></td><td>Read events from Google Calendars</td></tr>
          <tr><td>GET</td><td><code>/announcements/templates</code></td><td>List announcement templates</td></tr>
          <tr><td>POST</td><td><code>/announcements/templates</code></td><td>Create an announcement template</td></tr>
          <tr><td>PUT</td><td><code>/announcements/templates/:id</code></td><td>Update a template (partial)</td></tr>
          <tr><td>DELETE</td><td><code>/announcements/templates/:id</code></td><td>Delete a template</td></tr>
          <tr><td>GET</td><td><code>/discord/servers</code></td><td>List Discord servers and channels</td></tr>
          <tr><td>GET</td><td><code>/discord/members</code></td><td>List DM-eligible members</td></tr>
          <tr><td>GET</td><td><code>/feedback</code></td><td>List submitted feedback</td></tr>
          <tr><td>POST</td><td><code>/feedback</code></td><td>Submit feedback</td></tr>
          <tr><td>GET</td><td><code>/openapi.json</code></td><td>OpenAPI 3.0 specification</td></tr>
        </tbody>
      </table>

      <h2>Step 6: Choose Your Integration Path</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 not-prose">
        <Link
          to="/examples"
          className="border border-surface-700 rounded-lg p-4 hover:border-brand-600/50 transition-colors block"
        >
          <h3 className="text-sm font-semibold text-gray-100 mb-1">Code Examples</h3>
          <p className="text-xs text-gray-400">
            Full Python, JavaScript, and cURL examples for common workflows.
          </p>
        </Link>
        <Link
          to="/api/calendars"
          className="border border-surface-700 rounded-lg p-4 hover:border-brand-600/50 transition-colors block"
        >
          <h3 className="text-sm font-semibold text-gray-100 mb-1">API Reference</h3>
          <p className="text-xs text-gray-400">
            Full endpoint documentation with parameters, responses, and scopes.
          </p>
        </Link>
      </div>

      <h2 id="available-scopes">Available Scopes</h2>
      <table>
        <thead>
          <tr>
            <th>Scope</th>
            <th>Permissions</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>read</code></td><td>List calendars, view availability, view meetings, read Google Calendar events, list templates, list Discord servers/members, list feedback</td></tr>
          <tr><td><code>write:calendars</code></td><td>Create coordination calendars, submit availability for participants</td></tr>
          <tr><td><code>write:meetings</code></td><td>Create meeting drafts on calendars you own</td></tr>
          <tr><td><code>write:announcements</code></td><td>Create announcement template drafts (sending requires human approval)</td></tr>
          <tr><td><code>write:feedback</code></td><td>Submit feedback on behalf of the API key owner</td></tr>
          <tr><td><code>*</code></td><td>All permissions (wildcard)</td></tr>
        </tbody>
      </table>

      <Callout variant="tip" title="OpenAPI Spec">
        The Agent API also serves an OpenAPI 3.0 specification at{' '}
        <code>GET /api/agent/openapi.json</code>. You can use this with tools like Swagger UI
        or import it into Postman for interactive testing.
      </Callout>
    </div>
  )
}
