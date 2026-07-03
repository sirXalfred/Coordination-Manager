---
name: coordination-calendar
description: Implement calendar features with availability, meetings, recurrence, and hash-based URLs
---

# coordination-calendar

## Purpose

Guides development of the core domain: coordination calendars with shared availability, meeting suggestions, confirmed meetings with recurrence rules, and iCal export. This skill captures the unique business logic that connects frontend grid UI, API endpoints, and database patterns.

## When to Use

- Creating or editing calendar CRUD features
- Working with availability submission (add/remove time slots)
- Implementing meeting creation with recurrence rules (RFC 5545 RRULE)
- Building time slot overlap detection for meeting suggestions
- Implementing iCal export or calendar import features
- Working with the CalendarPage grid UI
- Modifying calendar config (time intervals, meeting hours, date ranges)
- Adding Zoom or other meeting link integrations

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Feature description | User describes the calendar feature | yes |
| Calendar hash | Existing calendar identifier if modifying | no |
| Recurrence pattern | Type and frequency if creating meetings | no |

## Workflow

1. **Understand the calendar data model**:
   - Calendar: `{ id, hash, title, config, visibility, created_by, creator_account_type }`
   - Config (JSONB): `{ eventName, timeInterval (15/30/60), meetingHours, dateRange, notes }`
   - `title` is canonical; `config.eventName` must stay in sync
   - Hash: nanoid(10) for public URLs (`/calendar/{hash}`)
   - Visibility: `'public'` (listed on events page) or `'unlisted'` (URL-only access)

2. **Availability patterns**:
   - Table: `availability { id, calendar_id, username, time_slots (JSONB) }`
   - Time slots: array of ISO 8601 cell IDs: `["2025-01-15T09:00", "2025-01-15T09:30"]`
   - Submission modes: `add` (merge with existing) or `remove` (subtract from existing)
   - Unique constraint: `(calendar_id, username)` -- one submission per participant
   - Anonymous usernames allowed (no auth required for guests on the `/join/:hash` route)
   - Import from external calendars: `ImportAvailabilityModal` uses iCal/ICS parsing

3. **Meeting creation with recurrence**:
   - Meeting: `{ id, calendar_id, title, start_time, end_time, meeting_link, recurrence_rule }`
   - RecurrenceRule interface:
     ```
     type: 'none' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
     interval?: number
     unit?: 'day' | 'week' | 'month'
     weekDays?: number[]  (0=Mon..6=Sun)
     endType?: 'never' | 'on' | 'after'
     endDate?: string (YYYY-MM-DD)
     endCount?: number
     ```
   - Build RRULE: `buildRRule(rule, dtStartISO)` produces RFC 5545 format
   - Example: `"FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20260630T235959Z"`
   - Use `ical-expander` library for expanding recurrence occurrences
   - Meeting links: manual URL or auto-generated via Zoom OAuth integration

4. **Frontend CalendarPage grid**:
   - View modes: `'visitor'` (submit availability) vs `'admin'` (manage calendar)
   - Time intervals: 15, 30, or 60 minutes (configurable per calendar)
   - Overlap detection: count participants available per slot, highlight optimal times
   - DualThumbSlider: for selecting meeting hour ranges
   - `getRecurringOccurrencesInWeek()` generates visible occurrences (max 500 guard)
   - `getDayIndexFromISO()` converts ISO date to 0=Mon..6=Sun
   - MeetingSidePanel: opens from calendar to show meeting details + actions

5. **Guest booking flow** (`/join/:hash` route):
   - Distraction-free layout (no main navigation)
   - No auth required; uses anonymous username
   - Submit availability directly to the calendar
   - Return to calendar view after submission

6. **Governance and event discovery**:
   - `/events` page: public calendar listing with search and filters
   - `/events-calendar` page: calendar-grid view of public events
   - `/governance` page: GovernanceHeatmap, GovernanceMatrix (impact vs changeability), GovernanceSummaryTables

7. **Calendar ownership and permissions**:
   - `created_by` field: may be UUID, email, traveler_name, or wallet_address
   - Server computes `is_owner` and `has_edit_permission` flags per request
   - Display names resolved via `buildCreatorNameMap()` to avoid leaking emails
   - Calendar permissions stored as JSONB for fine-grained access control

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Calendar API routes | .ts | `Code/apps/api/src/routes/calendars.ts` |
| Availability routes | .ts | `Code/apps/api/src/routes/availability.ts` |
| Meeting routes | .ts | `Code/apps/api/src/routes/meetings.ts` |
| CalendarPage UI | .tsx | `Code/apps/web/src/pages/CalendarPage.tsx` |
| Calendar utils | .ts | `Code/apps/web/src/lib/calendar-utils.ts` |

## Constraints

- Calendar hash is the public identifier; NEVER expose raw UUIDs in URLs
- `config.eventName` MUST stay in sync with `title` (server enforces this)
- Time slots MUST use ISO 8601 format: `YYYY-MM-DDThh:mm`
- Recurrence rules MUST follow RFC 5545 RRULE format
- Guard against infinite loops in recurrence expansion (max 500 occurrences)
- Anonymous availability submissions MUST be allowed (no auth required)
- Zoom OAuth tokens are private; only expose generated meeting links

## Self-Validation

### Trigger Indicators
- [ ] User asked to work on calendars, availability, meetings, or scheduling
- [ ] Task involves time slots, recurrence, or overlap detection
- [ ] User mentioned CalendarPage, RRULE, iCal, or governance

### Completion Markers
- [ ] Calendar hash used for public URLs (not UUIDs)
- [ ] Time slots stored as ISO 8601 JSONB arrays
- [ ] Recurrence rules follow RFC 5545 format
- [ ] Availability add/remove modes implemented correctly

### Quality Signals
- [ ] config.eventName stays in sync with title
- [ ] Creator name resolved without leaking emails
- [ ] Recurrence expansion has max-iteration guard
- [ ] Guest booking works without authentication
- [ ] ImportAvailabilityModal handles iCal parsing errors gracefully

### Lint Checks
- [ ] No raw UUIDs in frontend URL construction
- [ ] Time slot arrays contain valid ISO 8601 strings
- [ ] RRULE strings are valid RFC 5545 format
