"""
Meeting Scheduler uAgent — Fetch.ai autonomous agent for the Coordination Manager.

This agent connects to the Coordination Manager Agent API to automate
meeting scheduling workflows. It can:
  - List calendars
  - Read availability data
  - Propose optimal meeting times
  - Create draft announcements (human approves distribution)
  - Create new coordination calendars

Human-in-the-loop: The agent deliberately cannot distribute announcements. Those actions require manual approval via the web UI.
"""

import os
import json
from datetime import datetime, timedelta
from collections import Counter
from typing import Optional

import requests
from dotenv import load_dotenv
from uagents import Agent, Context, Model, Protocol

load_dotenv()

# ─── Configuration ──────────────────────────────────────────────────────────────

API_URL = os.getenv("COORDINATION_API_URL", "http://localhost:3001")
API_KEY = os.getenv("COORDINATION_API_KEY", "")
AGENT_SEED = os.getenv("AGENT_SEED", "meeting-scheduler-default-seed")
AGENT_PORT = int(os.getenv("AGENT_PORT", "8001"))

agent = Agent(
    name="meeting-scheduler",
    seed=AGENT_SEED,
    port=AGENT_PORT,
    endpoint=[f"http://127.0.0.1:{AGENT_PORT}/submit"],
)

# ─── API Client Helper ─────────────────────────────────────────────────────────


def api_request(method: str, path: str, data: dict = None) -> dict:
    """Make an authenticated request to the Coordination Manager Agent API."""
    url = f"{API_URL}/api/agent{path}"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, timeout=15)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=data or {}, timeout=15)
        else:
            return {"error": f"Unsupported method: {method}"}

        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.HTTPError as e:
        error_body = e.response.text if e.response else str(e)
        return {"error": f"API error ({e.response.status_code}): {error_body}"}
    except requests.exceptions.RequestException as e:
        return {"error": f"Connection error: {str(e)}"}


# ─── Message Models ────────────────────────────────────────────────────────────


class ListCalendarsRequest(Model):
    """Request to list all coordination calendars."""
    pass


class ListCalendarsResponse(Model):
    calendars: list
    error: Optional[str] = None


class GetAvailabilityRequest(Model):
    """Request availability data for a specific calendar."""
    calendar_hash: str


class GetAvailabilityResponse(Model):
    calendar_hash: str
    availability: list
    participant_count: int
    error: Optional[str] = None


class ProposeMeetingRequest(Model):
    """Request the agent to analyze availability and propose a meeting."""
    calendar_hash: str
    title: str
    duration_minutes: int = 60
    meeting_link: str = ""
    min_participants: int = 2


class ProposeMeetingResponse(Model):
    success: bool
    meeting: Optional[dict] = None
    proposed_slot: Optional[dict] = None
    overlap_score: int = 0
    note: str = ""
    error: Optional[str] = None


class CreateCalendarRequest(Model):
    """Request to create a new coordination calendar."""
    title: str
    description: str = ""
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None
    start_hour: int = 8
    end_hour: int = 18
    time_interval: int = 30
    timezone: str = "UTC"
    visibility: str = "unlisted"


class CreateCalendarResponse(Model):
    success: bool
    calendar: Optional[dict] = None
    share_url: str = ""
    error: Optional[str] = None


# ─── Meeting Scheduling Protocol ───────────────────────────────────────────────

scheduling_protocol = Protocol("MeetingScheduler")


@scheduling_protocol.on_message(model=ListCalendarsRequest)
async def handle_list_calendars(ctx: Context, sender: str, msg: ListCalendarsRequest):
    """List all coordination calendars for the API key owner."""
    ctx.logger.info(f"Listing calendars for {sender}")
    result = api_request("GET", "/calendars")

    if "error" in result:
        await ctx.send(sender, ListCalendarsResponse(calendars=[], error=result["error"]))
    else:
        await ctx.send(
            sender,
            ListCalendarsResponse(calendars=result.get("calendars", [])),
        )


@scheduling_protocol.on_message(model=GetAvailabilityRequest)
async def handle_get_availability(ctx: Context, sender: str, msg: GetAvailabilityRequest):
    """Get availability submissions for a specific calendar."""
    ctx.logger.info(f"Fetching availability for calendar {msg.calendar_hash}")
    result = api_request("GET", f"/calendars/{msg.calendar_hash}/availability")

    if "error" in result:
        await ctx.send(
            sender,
            GetAvailabilityResponse(
                calendar_hash=msg.calendar_hash,
                availability=[],
                participant_count=0,
                error=result["error"],
            ),
        )
    else:
        avail = result.get("availability", [])
        await ctx.send(
            sender,
            GetAvailabilityResponse(
                calendar_hash=msg.calendar_hash,
                availability=avail,
                participant_count=len(avail),
            ),
        )


@scheduling_protocol.on_message(model=ProposeMeetingRequest)
async def handle_propose_meeting(ctx: Context, sender: str, msg: ProposeMeetingRequest):
    """Analyze availability overlaps and create a meeting draft at the best time."""
    ctx.logger.info(
        f"Proposing meeting '{msg.title}' for calendar {msg.calendar_hash} "
        f"(min {msg.min_participants} participants, {msg.duration_minutes}min)"
    )

    # 1. Fetch availability
    avail_result = api_request("GET", f"/calendars/{msg.calendar_hash}/availability")
    if "error" in avail_result:
        await ctx.send(
            sender,
            ProposeMeetingResponse(
                success=False,
                error=f"Failed to fetch availability: {avail_result['error']}",
            ),
        )
        return

    submissions = avail_result.get("availability", [])
    if len(submissions) < msg.min_participants:
        await ctx.send(
            sender,
            ProposeMeetingResponse(
                success=False,
                error=f"Not enough participants ({len(submissions)}/{msg.min_participants}). "
                f"Wait for more people to submit availability.",
            ),
        )
        return

    # 2. Find the best overlapping time slot
    # Each submission has time_slots: { "YYYY-MM-DD": ["HH:MM", ...] }
    slot_counter: Counter = Counter()
    for sub in submissions:
        time_slots = sub.get("time_slots", {})
        if isinstance(time_slots, dict):
            for date_str, slots in time_slots.items():
                if isinstance(slots, list):
                    for slot in slots:
                        slot_counter[(date_str, slot)] += 1

    if not slot_counter:
        await ctx.send(
            sender,
            ProposeMeetingResponse(
                success=False,
                error="No time slot data found in submissions.",
            ),
        )
        return

    # Find slots that have the most overlap (at least min_participants)
    qualifying_slots = [
        (slot, count) for slot, count in slot_counter.items() if count >= msg.min_participants
    ]

    if not qualifying_slots:
        # Fall back to the best available slot even if below min_participants
        best_slot, best_count = slot_counter.most_common(1)[0]
        await ctx.send(
            sender,
            ProposeMeetingResponse(
                success=False,
                overlap_score=best_count,
                proposed_slot={"date": best_slot[0], "time": best_slot[1]},
                note=f"Best slot has {best_count}/{len(submissions)} participants "
                f"(need {msg.min_participants}). Consider collecting more availability.",
            ),
        )
        return

    # Sort by count (desc), then by date/time (asc) for tie-breaking
    qualifying_slots.sort(key=lambda x: (-x[1], x[0]))

    # Group consecutive slots to find duration-compatible windows
    best_window = None
    needed_slots = msg.duration_minutes // 30  # Assume 30-min intervals

    for (date_str, start_time), count in qualifying_slots:
        # Check if we have enough consecutive slots
        try:
            start_dt = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M")
        except ValueError:
            continue

        consecutive = 1
        for i in range(1, needed_slots):
            next_time = (start_dt + timedelta(minutes=30 * i)).strftime("%H:%M")
            next_key = (date_str, next_time)
            if slot_counter.get(next_key, 0) >= msg.min_participants:
                consecutive += 1
            else:
                break

        if consecutive >= needed_slots:
            end_dt = start_dt + timedelta(minutes=msg.duration_minutes)
            best_window = {
                "date": date_str,
                "start_time": start_time,
                "end_time": end_dt.strftime("%H:%M"),
                "participant_count": count,
            }
            break

    if not best_window:
        # Use the single best slot as a starting point
        (best_date, best_time), best_count = qualifying_slots[0]
        try:
            start_dt = datetime.strptime(f"{best_date} {best_time}", "%Y-%m-%d %H:%M")
            end_dt = start_dt + timedelta(minutes=msg.duration_minutes)
            best_window = {
                "date": best_date,
                "start_time": best_time,
                "end_time": end_dt.strftime("%H:%M"),
                "participant_count": best_count,
            }
        except ValueError:
            await ctx.send(
                sender,
                ProposeMeetingResponse(
                    success=False,
                    error="Failed to parse time slot data.",
                ),
            )
            return

    # 3. Create the meeting draft via the API
    start_iso = f"{best_window['date']}T{best_window['start_time']}:00Z"
    end_iso = f"{best_window['date']}T{best_window['end_time']}:00Z"

    meeting_data = {
        "title": msg.title,
        "description": f"Auto-proposed by Meeting Scheduler agent. "
        f"{best_window['participant_count']}/{len(submissions)} participants available.",
        "start_time": start_iso,
        "end_time": end_iso,
        "duration_minutes": msg.duration_minutes,
        "meeting_link": msg.meeting_link,
        "time_slots": {
            best_window["date"]: [best_window["start_time"]],
        },
    }

    create_result = api_request(
        "POST", f"/calendars/{msg.calendar_hash}/meetings", meeting_data
    )

    if "error" in create_result:
        await ctx.send(
            sender,
            ProposeMeetingResponse(
                success=False,
                proposed_slot=best_window,
                overlap_score=best_window["participant_count"],
                error=f"Found optimal slot but failed to create meeting: {create_result['error']}",
            ),
        )
    else:
        await ctx.send(
            sender,
            ProposeMeetingResponse(
                success=True,
                meeting=create_result.get("meeting"),
                proposed_slot=best_window,
                overlap_score=best_window["participant_count"],
                note=create_result.get(
                    "note",
                    "Meeting created as draft. Human approval required for distribution.",
                ),
            ),
        )


@scheduling_protocol.on_message(model=CreateCalendarRequest)
async def handle_create_calendar(ctx: Context, sender: str, msg: CreateCalendarRequest):
    """Create a new coordination calendar."""
    ctx.logger.info(f"Creating calendar '{msg.title}' for {sender}")

    data = {
        "title": msg.title,
        "description": msg.description,
        "start_date": msg.start_date,
        "end_date": msg.end_date,
        "start_hour": msg.start_hour,
        "end_hour": msg.end_hour,
        "time_interval": msg.time_interval,
        "timezone": msg.timezone,
        "visibility": msg.visibility,
    }

    result = api_request("POST", "/calendars", data)

    if "error" in result:
        await ctx.send(
            sender,
            CreateCalendarResponse(success=False, error=result["error"]),
        )
    else:
        await ctx.send(
            sender,
            CreateCalendarResponse(
                success=True,
                calendar=result.get("calendar"),
                share_url=result.get("shareUrl", ""),
            ),
        )


# ─── Register Protocol & Start ─────────────────────────────────────────────────

agent.include(scheduling_protocol)


@agent.on_event("startup")
async def on_startup(ctx: Context):
    ctx.logger.info(f"Meeting Scheduler Agent started")
    ctx.logger.info(f"Agent address: {agent.address}")
    ctx.logger.info(f"API URL: {API_URL}")

    # Verify API connection
    result = api_request("GET", "/me")
    if "error" in result:
        ctx.logger.warning(f"⚠️  API connection check failed: {result['error']}")
        ctx.logger.warning("Make sure COORDINATION_API_KEY is set correctly.")
    else:
        ctx.logger.info(
            f"✅ Connected to Coordination Manager as '{result.get('agentName', 'unknown')}' "
            f"(scopes: {result.get('scopes', [])})"
        )


if __name__ == "__main__":
    agent.run()
