import { Endpoint, ParamTable, ResponseExample } from '../components/Endpoint'
import { CodeBlock } from '../components/CodeBlock'
import { Callout } from '../components/Callout'

export function ApiAnnouncementsPage() {
  return (
    <div className="prose-docs">
      <h1>Announcements API</h1>
      <p className="text-lg text-gray-400 mb-8">
        Create and manage announcement templates with optional poll support. Agents can prepare
        and update templates, but sending (distribution to Discord) always requires human approval.
      </p>

      <Callout variant="warning" title="Agents cannot send announcements">
        This is by design. Agents can create and update announcement templates with full formatting and poll
        options, but a human must review and click "Send" in the web UI. This prevents accidental
        or unauthorized mass notifications.
      </Callout>

      <Callout variant="info" title="Templates vs Distribution">
        <strong>Templates</strong> contain the announcement content (title, body, poll options).
        <strong>Distribution</strong> (which Discord channels to post to, which members to DM) is
        configured by the human when they send the announcement via the web UI.
        The API does not handle channel or DM targeting — agents prepare the content, humans choose
        where it goes. To see which channels and members are available, use the{' '}
        <code>GET /api/agent/discord/servers</code> and <code>GET /api/agent/discord/members</code> endpoints.
      </Callout>

      <h2>List Templates</h2>
      <Endpoint method="GET" path="/api/agent/announcements/templates" description="List all announcement templates created by the API key owner." scope="read">
        <ResponseExample status={200} body={`{
  "templates": [
    {
      "id": "template-uuid",
      "title": "Sprint Review Announcement",
      "body": "Join us for the Sprint 12 review! We'll demo the new agent API and discuss Q2 roadmap.",
      "is_poll": false,
      "poll_options": [],
      "created_at": "2026-03-01T10:00:00Z",
      "updated_at": "2026-03-01T10:00:00Z"
    },
    {
      "id": "template-uuid-2",
      "title": "Meeting Time Poll",
      "body": "When should we schedule the architecture review?",
      "is_poll": true,
      "poll_options": ["Monday 10am", "Tuesday 2pm", "Wednesday 11am"],
      "created_at": "2026-03-02T14:00:00Z",
      "updated_at": "2026-03-02T14:00:00Z"
    }
  ]
}`} />
      </Endpoint>

      <h2>Create Template</h2>
      <Endpoint method="POST" path="/api/agent/announcements/templates" description="Create a new announcement template. The template will be available in the web UI for the user to review and send." scope="write:announcements">
        <ParamTable params={[
          { name: 'title', type: 'string', required: false, description: 'Template title (optional)' },
          { name: 'body', type: 'string', required: true, description: 'Announcement body text' },
          { name: 'is_poll', type: 'boolean', required: false, description: 'Whether this is a poll (default: false)' },
          { name: 'poll_options', type: 'string[]', required: false, description: 'Array of poll option strings (required if is_poll is true)' },
        ]} />
        <h4 className="text-sm font-medium text-gray-300 mt-3 mb-2">Example: Simple Announcement</h4>
        <CodeBlock language="json" title="POST body">{`{
  "title": "Sprint Review",
  "body": "Sprint 12 review is scheduled for Friday at 3pm UTC. We'll demo the new Agent API features and discuss the Q2 roadmap. See you there!"
}`}</CodeBlock>
        <h4 className="text-sm font-medium text-gray-300 mt-3 mb-2">Example: Poll</h4>
        <CodeBlock language="json" title="POST body">{`{
  "title": "Architecture Review Time",
  "body": "When should we schedule the architecture review session?",
  "is_poll": true,
  "poll_options": [
    "Monday 10:00 UTC",
    "Tuesday 14:00 UTC",
    "Wednesday 11:00 UTC",
    "Thursday 09:00 UTC"
  ]
}`}</CodeBlock>
        <ResponseExample status={201} body={`{
  "template": {
    "id": "new-template-uuid",
    "title": "Architecture Review Time",
    "body": "When should we schedule the architecture review session?",
    "is_poll": true,
    "poll_options": ["Monday 10:00 UTC", "Tuesday 14:00 UTC", "Wednesday 11:00 UTC", "Thursday 09:00 UTC"],
    "created_at": "2026-03-03T08:00:00Z",
    "updated_at": "2026-03-03T08:00:00Z"
  },
  "note": "Template created. Distribution (sending) requires human action via the web UI."
}`} />
      </Endpoint>

      <h2>Update Template</h2>
      <Endpoint method="PUT" path="/api/agent/announcements/templates/:id" description="Update an existing announcement template. Only fields you include will be changed. You can only update templates you created." scope="write:announcements">
        <ParamTable params={[
          { name: 'title', type: 'string', required: false, description: 'New template title' },
          { name: 'body', type: 'string', required: false, description: 'New announcement body text' },
          { name: 'is_poll', type: 'boolean', required: false, description: 'Whether this is a poll' },
          { name: 'poll_options', type: 'string[]', required: false, description: 'New poll options (required if is_poll is true)' },
        ]} />
        <CodeBlock language="json" title="PUT body">{`{
  "title": "Updated Sprint Review",
  "body": "Sprint 12 review moved to Monday at 2pm UTC."
}`}</CodeBlock>
        <ResponseExample status={200} body={`{
  "template": {
    "id": "template-uuid",
    "title": "Updated Sprint Review",
    "body": "Sprint 12 review moved to Monday at 2pm UTC.",
    "is_poll": false,
    "poll_options": [],
    "created_at": "2026-03-01T10:00:00Z",
    "updated_at": "2026-03-04T09:30:00Z"
  },
  "note": "Template updated. Distribution (channel/DM targeting and sending) is handled by the human in the web UI."
}`} />
      </Endpoint>

      <h2>Delete Template</h2>
      <Endpoint method="DELETE" path="/api/agent/announcements/templates/:id" description="Delete an announcement template. You can only delete templates you created." scope="write:announcements">
        <ResponseExample status={200} body={`{
  "deleted": {
    "id": "template-uuid",
    "title": "Old Template",
    "body": "This template is no longer needed.",
    "is_poll": false,
    "poll_options": []
  }
}`} />
      </Endpoint>

      <h2>cURL Examples</h2>
      <CodeBlock language="bash" title="List templates">{`curl -s https://api.coordinationmanager.com/api/agent/announcements/templates \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" | jq`}</CodeBlock>

      <CodeBlock language="bash" title="Create announcement">{`curl -s -X POST https://api.coordinationmanager.com/api/agent/announcements/templates \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Team Update",
    "body": "New agent API is live! Check the docs at /docs"
  }' | jq`}</CodeBlock>

      <CodeBlock language="bash" title="Create poll">{`curl -s -X POST https://api.coordinationmanager.com/api/agent/announcements/templates \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "body": "Preferred meeting day?",
    "is_poll": true,
    "poll_options": ["Monday", "Wednesday", "Friday"]
  }' | jq`}</CodeBlock>

      <CodeBlock language="bash" title="Update template">{`curl -s -X PUT https://api.coordinationmanager.com/api/agent/announcements/templates/TEMPLATE_ID \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Updated Title",
    "body": "Updated body text"
  }' | jq`}</CodeBlock>

      <CodeBlock language="bash" title="Delete template">{`curl -s -X DELETE https://api.coordinationmanager.com/api/agent/announcements/templates/TEMPLATE_ID \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" | jq`}</CodeBlock>
    </div>
  )
}
