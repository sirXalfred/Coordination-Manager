# Meeting Scheduler uAgent

A Fetch.ai uAgent that integrates with the Coordination Manager Agent API to help automate meeting scheduling workflows.

## What it does

This agent can:
- **List calendars** — Query coordination calendars from your account
- **Check availability** — Read availability submissions to find optimal meeting times
- **Propose meetings** — Create meeting drafts based on the best overlapping time slots
- **Create calendars** — Set up new coordination calendars for availability collection

> **Human-in-the-loop:** The agent creates draft meetings, calendars and announcment messages. Importing/exporting and distribution (e.g., sending announcements) always require human approval via the web UI.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

3. Fill in your `.env`:
   - `COORDINATION_API_URL` — Your Coordination Manager API URL (e.g., `https://api.coordinationmanager.com`)
   - `COORDINATION_API_KEY` — Your Agent API key (generate one in **Settings → Privacy → Agent API Keys**)
   - `AGENT_SEED` — A secret seed phrase for your agent's identity (see below)
   - `AGENT_PORT` — Port for the agent to listen on (default: 8001)

### Getting your AGENT_SEED

The `AGENT_SEED` determines your agent's unique identity on the ASI network:

- **Option A (Recommended):** Create an agent on [ASI:One / Agentverse](https://agentverse.ai) — go to "My Agents" → Create Agent, and use the seed from your agent's settings.
- **Option B:** Generate any random secret string locally (e.g., `python -c "import secrets; print(secrets.token_hex(32))"`).

Keep this seed secret and consistent — changing it will change your agent's address.

4. Run the agent:
   ```bash
   python agent.py
   ```

## Available Message Handlers

| Message | Description |
|---|---|
| `ListCalendarsRequest` | Returns all coordination calendars for your account |
| `GetAvailabilityRequest` | Returns availability submissions for a specific calendar |
| `ProposeMeetingRequest` | Analyzes availability overlaps and creates a meeting draft |
| `CreateCalendarRequest` | Creates a new coordination calendar |

## Registering on Agentverse

Once running locally, you can register this agent on [Agentverse](https://agentverse.ai/) to make it discoverable by ASI:One and other agents. See the [registration guide](https://docs.agentverse.ai/documentation/launch-agents/connect-your-agents-chat-protocol-integration).

## Architecture

```
┌──────────────────────┐      ┌──────────────────────────┐
│   ASI:One / Other    │      │   Coordination Manager   │
│   Agents / Users     │────▶│   Agent API (/api/agent)  │
│                      │      │   Bearer Token Auth      │
└──────────────────────┘      └──────────────────────────┘
         │                              │
         ▼                              ▼
┌──────────────────────┐     ┌──────────────────────────┐
│  Meeting Scheduler   │     │      Supabase DB         │
│  uAgent (this)       │     │  calendars, meetings,    │
│  Port 8001           │     │  availability, templates │
└──────────────────────┘     └──────────────────────────┘
```
