import { Endpoint, ParamTable, ResponseExample } from '../components/Endpoint'
import { CodeBlock } from '../components/CodeBlock'
import { Callout } from '../components/Callout'

export function ApiMeetingsPage() {
  return (
    <div className="prose-docs">
      <h1>Meetings API</h1>
      <p className="text-lg text-gray-400 mb-8">
        Create and list meetings for coordination calendars. Meetings are created as drafts — 
        importing/exporting and distribution require human action via the web UI.
      </p>

      <Callout variant="warning" title="Human-in-the-loop">
        The Agent API can create meeting drafts, but the calendar owner must approve and
        distribute them (e.g., export to Google Calendar, send invites) through the web UI.
        This is a deliberate safety measure.
      </Callout>

      <h2>List Meetings</h2>
      <Endpoint method="GET" path="/api/agent/calendars/:hash/meetings" description="List all meetings for a specific calendar, ordered by start time." scope="read">
        <ParamTable params={[
          { name: 'hash', type: 'string', required: true, description: 'Calendar hash (URL path parameter)' },
        ]} />
        <ResponseExample status={200} body={`{
  "meetings": [
    {
      "id": "meeting-uuid",
      "calendar_id": "calendar-uuid",
      "title": "Sprint Planning",
      "description": "Auto-proposed by agent. 5/7 participants available.",
      "start_time": "2026-03-05T09:00:00Z",
      "end_time": "2026-03-05T10:00:00Z",
      "duration_minutes": 60,
      "meeting_link": "https://meet.google.com/abc-defg-hij",
      "created_by": "user-uuid",
      "time_slots": { "2026-03-05": ["09:00"] },
      "created_at": "2026-03-03T14:00:00Z"
    }
  ]
}`} />
      </Endpoint>

      <h2>Create Meeting (Draft)</h2>
      <Endpoint method="POST" path="/api/agent/calendars/:hash/meetings" description="Create a new meeting draft on a calendar you own. The meeting will need human approval before distribution." scope="write:meetings">
        <ParamTable params={[
          { name: 'hash', type: 'string', required: true, description: 'Calendar hash (URL path parameter)' },
          { name: 'title', type: 'string', required: true, description: 'Meeting title' },
          { name: 'description', type: 'string', required: false, description: 'Meeting description' },
          { name: 'start_time', type: 'string', required: true, description: 'ISO 8601 start time' },
          { name: 'end_time', type: 'string', required: true, description: 'ISO 8601 end time' },
          { name: 'duration_minutes', type: 'number', required: true, description: 'Meeting duration in minutes' },
          { name: 'meeting_link', type: 'string', required: false, description: 'Video call link (Google Meet, Zoom, etc.)' },
          { name: 'time_slots', type: 'string[]', required: false, description: 'Array of slot strings ["YYYY-MM-DDTHH:MM"]. Auto-generated from start_time if omitted.' },
        ]} />
        <h4 className="text-sm font-medium text-gray-300 mt-3 mb-2">Example Request</h4>
        <CodeBlock language="json" title="POST body">{`{
  "title": "Sprint Planning",
  "description": "Weekly sprint planning session",
  "start_time": "2026-03-05T09:00:00Z",
  "end_time": "2026-03-05T10:00:00Z",
  "duration_minutes": 60,
  "meeting_link": "https://meet.google.com/abc-defg-hij"
}`}</CodeBlock>
        <Callout variant="info">
          The <code>time_slots</code> field is optional. If omitted, it is automatically generated from the <code>start_time</code>.
          If provided, it should be an array like <code>["2026-03-05T09:00"]</code>.
        </Callout>
        <ResponseExample status={201} body={`{
  "meeting": {
    "id": "new-meeting-uuid",
    "calendar_id": "calendar-uuid",
    "title": "Sprint Planning",
    "start_time": "2026-03-05T09:00:00Z",
    "end_time": "2026-03-05T10:00:00Z",
    "duration_minutes": 60,
    ...
  },
  "note": "Meeting created as draft. Importing/exporting and distribution require human action via the web UI."
}`} />
      </Endpoint>

      <h2>Automated Meeting Proposal Workflow</h2>
      <p>
        The typical agent workflow for proposing a meeting:
      </p>
      <ol>
        <li>
          <strong>Fetch availability</strong> — <code>GET /api/agent/calendars/:hash/availability</code>
        </li>
        <li>
          <strong>Analyze overlaps</strong> — count how many participants are available at each time slot.
          Find consecutive slots that fit the desired meeting duration.
        </li>
        <li>
          <strong>Create meeting draft</strong> — <code>POST /api/agent/calendars/:hash/meetings</code>
          with the optimal time.
        </li>
        <li>
          <strong>Human reviews</strong> — the calendar owner sees the draft in the web UI and approves
          or adjusts before distributing.
        </li>
      </ol>

      <CodeBlock language="python" title="propose_meeting.py">{`import os, requests
from collections import Counter
from datetime import datetime, timedelta

API_URL = os.getenv("COORDINATION_API_URL", "https://api.coordinationmanager.com")
API_KEY = os.getenv("COORDINATION_API_KEY")
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

calendar_hash = "abc123xyz"

# 1. Fetch availability
resp = requests.get(f"{API_URL}/api/agent/calendars/{calendar_hash}/availability", headers=HEADERS)
submissions = resp.json()["availability"]

# 2. Count slot overlaps
slot_counter = Counter()
for sub in submissions:
    for slot in sub["time_slots"]:
        # slots are "YYYY-MM-DD_HH:MM"
        date, time = slot.split("_")
        slot_counter[(date, time)] += 1

# 3. Find best slot with >= 3 participants
best_slots = [(s, c) for s, c in slot_counter.items() if c >= 3]
best_slots.sort(key=lambda x: (-x[1], x[0]))

if best_slots:
    (date, time), count = best_slots[0]
    start = f"{date}T{time}:00Z"
    end_dt = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M") + timedelta(minutes=60)
    end = f"{date}T{end_dt.strftime('%H:%M')}:00Z"

    # 4. Create meeting draft (time_slots auto-generated from start_time)
    meeting = requests.post(
        f"{API_URL}/api/agent/calendars/{calendar_hash}/meetings",
        headers=HEADERS,
        json={
            "title": "Sprint Planning",
            "description": f"Auto-proposed: {count}/{len(submissions)} available",
            "start_time": start,
            "end_time": end,
            "duration_minutes": 60,
        },
    ).json()
    print(f"Meeting created: {meeting}")
else:
    print("No slot with enough participants")`}</CodeBlock>
    </div>
  )
}
