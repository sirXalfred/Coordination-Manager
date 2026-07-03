import { CodeBlock } from '../components/CodeBlock'
import { Callout } from '../components/Callout'
import { Link } from 'react-router-dom'

export function AuthenticationPage() {
  return (
    <div className="prose-docs">
      <h1>Authentication</h1>
      <p className="text-lg text-gray-400 mb-8">
        The Agent API uses Bearer token authentication with scoped API keys.
        Every request must include an <code>Authorization</code> header.
      </p>

      <h2>How It Works</h2>
      <ol>
        <li>You create an API key in the Coordination Manager web UI at <a href="https://coordinationmanager.com/settings?tab=ai&section=agent-api-keys" target="_blank" rel="noopener noreferrer"><strong>Settings -&gt; AI -&gt; Agent API Keys</strong></a>. See the <Link to="/getting-started">Getting Started</Link> guide for step-by-step instructions.</li>
        <li>Each key is associated with your user account and has specific <strong>scopes</strong> that control what it can access.</li>
        <li>Include the key in every API request as a Bearer token.</li>
        <li>The server validates the key, checks scopes, and processes your request in the context of your user account.</li>
      </ol>

      <h2>Request Format</h2>
      <CodeBlock language="http" title="HTTP Header">{`GET /api/agent/calendars HTTP/1.1
Host: api.coordinationmanager.com
Authorization: Bearer cm_agent_fe4d6d93ffbd4a3788b23d196c71bee0a9dc9eeda76840fd
Content-Type: application/json`}</CodeBlock>

      <Callout variant="danger" title="Never expose your API key">
        Do not hardcode API keys in client-side code, public repositories, or shared documents.
        Use environment variables (<code>COORDINATION_API_KEY</code>) and keep the key server-side only.
      </Callout>

      <h2>Key Properties</h2>
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>api_key</code></td><td>The Bearer token string (prefixed with <code>cm_agent_</code>)</td></tr>
          <tr><td><code>name</code></td><td>A human-readable label you choose when creating the key</td></tr>
          <tr><td><code>scopes</code></td><td>Array of permission scopes granted to this key</td></tr>
          <tr><td><code>is_active</code></td><td>Whether the key is active (can be disabled in the UI)</td></tr>
          <tr><td><code>expires_at</code></td><td>Optional expiration date (null = never expires)</td></tr>
          <tr><td><code>last_used_at</code></td><td>Timestamp of the last API call using this key</td></tr>
        </tbody>
      </table>

      <h2>Error Responses</h2>
      <h3>401 Unauthorized</h3>
      <p>Returned when the API key is missing, invalid, inactive, or expired.</p>
      <CodeBlock language="json" title="Missing key">{`{
  "error": "Missing API key. Use Authorization: Bearer <key>"
}`}</CodeBlock>
      <CodeBlock language="json" title="Invalid key">{`{
  "error": "Invalid or inactive API key"
}`}</CodeBlock>
      <CodeBlock language="json" title="Expired key">{`{
  "error": "API key has expired"
}`}</CodeBlock>

      <h3>403 Forbidden</h3>
      <p>Returned when the key is valid but lacks the required scope for the requested endpoint.</p>
      <CodeBlock language="json" title="Insufficient scope">{`{
  "error": "Insufficient scope. Required: 'write:calendars'. Your key has: [read]"
}`}</CodeBlock>

      <h2>Python Example</h2>
      <CodeBlock language="python" title="auth_example.py">{`import os
import requests

API_URL = os.getenv("COORDINATION_API_URL", "https://api.coordinationmanager.com")
API_KEY = os.getenv("COORDINATION_API_KEY")

def api_request(method: str, path: str, data: dict = None) -> dict:
    """Make an authenticated request to the Agent API."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    url = f"{API_URL}/api/agent{path}"

    if method == "GET":
        resp = requests.get(url, headers=headers, timeout=15)
    elif method == "POST":
        resp = requests.post(url, headers=headers, json=data or {}, timeout=15)

    resp.raise_for_status()
    return resp.json()

# Verify connection
info = api_request("GET", "/me")
print(f"Connected as: {info['agentName']}")
print(f"Scopes: {info['scopes']}")`}</CodeBlock>

      <h2>JavaScript / TypeScript Example</h2>
      <CodeBlock language="typescript" title="auth_example.ts">{`const API_URL = process.env.COORDINATION_API_URL || 'https://api.coordinationmanager.com'
const API_KEY = process.env.COORDINATION_API_KEY!

async function apiRequest(method: string, path: string, body?: object) {
  const res = await fetch(\`\${API_URL}/api/agent\${path}\`, {
    method,
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(\`API error \${res.status}: \${await res.text()}\`)
  return res.json()
}

// Verify connection
const info = await apiRequest('GET', '/me')
console.log(\`Connected as: \${info.agentName}\`)
console.log(\`Scopes: \${info.scopes}\`)`}</CodeBlock>
    </div>
  )
}
