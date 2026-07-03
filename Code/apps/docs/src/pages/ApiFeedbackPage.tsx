import { Endpoint, ParamTable, ResponseExample } from '../components/Endpoint'
import { CodeBlock } from '../components/CodeBlock'

export function ApiFeedbackPage() {
  return (
    <div className="prose-docs">
      <h1>Feedback API</h1>
      <p className="text-lg text-gray-400 mb-8">
        Submit feedback on behalf of the API key owner and list previously submitted feedback.
        Feedback is reviewed by admins through the Coordination Manager web UI.
      </p>

      <h2>List Feedback</h2>
      <Endpoint method="GET" path="/api/agent/feedback" description="List feedback previously submitted by this agent. Supports pagination and status filtering." scope="read">
        <ParamTable params={[
          { name: 'page', type: 'number', required: false, description: 'Page number (default: 1)' },
          { name: 'limit', type: 'number', required: false, description: 'Items per page (default: 20, max: 50)' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status (e.g., "pending", "reviewed")' },
        ]} />
        <ResponseExample status={200} body={`{
  "feedback": [
    {
      "id": "feedback-uuid",
      "message": "The calendar timezone selector could include more zones.",
      "source": "agent",
      "status": "pending",
      "created_at": "2026-03-01T12:00:00Z",
      "updated_at": "2026-03-01T12:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}`} />
      </Endpoint>

      <h2>Submit Feedback</h2>
      <Endpoint method="POST" path="/api/agent/feedback" description="Submit feedback on behalf of the user associated with the API key. An admin will review it." scope="write:feedback">
        <ParamTable params={[
          { name: 'message', type: 'string', required: true, description: 'Feedback message (max 2000 characters)' },
        ]} />
        <h4 className="text-sm font-medium text-gray-300 mt-3 mb-2">Example Request</h4>
        <CodeBlock language="json" title="POST body">{`{
  "message": "The meeting proposal algorithm should consider timezone preferences when ranking slots."
}`}</CodeBlock>
        <ResponseExample status={201} body={`{
  "feedback": {
    "id": "new-feedback-uuid",
    "message": "The meeting proposal algorithm should consider timezone preferences when ranking slots.",
    "source": "agent",
    "status": "pending",
    "created_at": "2026-03-03T08:00:00Z",
    "updated_at": "2026-03-03T08:00:00Z"
  },
  "note": "Feedback submitted. An admin will review it."
}`} />
      </Endpoint>

      <h2>cURL Examples</h2>
      <CodeBlock language="bash" title="Submit feedback">{`curl -s -X POST https://api.coordinationmanager.com/api/agent/feedback \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Add timezone auto-detection for meeting proposals"}' | jq`}</CodeBlock>

      <CodeBlock language="bash" title="List feedback">{`curl -s "https://api.coordinationmanager.com/api/agent/feedback?page=1&limit=10" \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" | jq`}</CodeBlock>
    </div>
  )
}
