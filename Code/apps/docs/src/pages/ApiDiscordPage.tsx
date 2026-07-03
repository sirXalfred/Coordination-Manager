import { Endpoint, ResponseExample } from '../components/Endpoint'
import { CodeBlock } from '../components/CodeBlock'
import { Callout } from '../components/Callout'

export function ApiDiscordPage() {
  return (
    <div className="prose-docs">
      <h1>Discord API</h1>
      <p className="text-lg text-gray-400 mb-8">
        Read-only endpoints for discovering Discord servers, channels, and DM-eligible members
        that are available for announcement distribution. The user must have linked their Discord
        account via the web UI before these endpoints return data.
      </p>

      <Callout variant="info">
        All Discord endpoints require a valid API key with the <code>read</code> scope.
        These are read-only — agents cannot send messages directly. Distribution happens
        when the human sends or schedules an announcement via the web UI.
      </Callout>

      <h2>List Servers &amp; Channels</h2>
      <Endpoint method="GET" path="/api/agent/discord/servers" description="List Discord servers (guilds) the user has connected, with their text channels available for announcement distribution." scope="read">
        <p className="text-xs text-gray-400 mb-2">No query parameters.</p>
        <ResponseExample status={200} body={`{
  "servers": [
    {
      "guild_id": "123456789",
      "guild_name": "SingularityNET",
      "channels": [
        {
          "channel_id": "987654321",
          "channel_name": "announcements",
          "is_active": true,
          "bot_can_send": true
        },
        {
          "channel_id": "987654322",
          "channel_name": "general",
          "is_active": false,
          "bot_can_send": true
        }
      ]
    }
  ]
}`} />
        <Callout variant="warning">
          If the user has not linked Discord, the response will contain an empty <code>servers</code> array
          and a <code>note</code> explaining the user must link Discord via the web UI.
        </Callout>
      </Endpoint>

      <h2>List DM-Eligible Members</h2>
      <Endpoint method="GET" path="/api/agent/discord/members" description="List members from shared Discord servers who can receive DM announcements. Members who have opted out of DMs are flagged." scope="read">
        <p className="text-xs text-gray-400 mb-2">No query parameters. Queries the bot service for members from guilds shared with the user.</p>
        <ResponseExample status={200} body={`{
  "members": [
    {
      "user_id": "111222333",
      "username": "alice",
      "display_name": "Alice",
      "guild_names": ["SingularityNET", "Swarm"],
      "opted_out": false
    },
    {
      "user_id": "444555666",
      "username": "bob",
      "display_name": "Bob",
      "guild_names": ["SingularityNET"],
      "opted_out": true
    }
  ]
}`} />
        <Callout variant="info">
          Members with <code>opted_out: true</code> have requested not to receive DM announcements.
          Respect this flag when planning distribution targets.
        </Callout>
      </Endpoint>

      <h2>cURL Examples</h2>
      <CodeBlock language="bash" title="List servers and channels">{`curl -s https://api.coordinationmanager.com/api/agent/discord/servers \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" | jq`}</CodeBlock>

      <CodeBlock language="bash" title="List DM-eligible members">{`curl -s https://api.coordinationmanager.com/api/agent/discord/members \\
  -H "Authorization: Bearer $COORDINATION_API_KEY" | jq`}</CodeBlock>
    </div>
  )
}
