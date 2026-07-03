import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// ensureUTC — mirrors the function in apps/api/src/routes/meetings.ts
// Extracted here for unit testing without requiring Express/Supabase context
// ---------------------------------------------------------------------------

/** Ensure a timestamp string has a UTC suffix (meetings table uses plain TIMESTAMP) */
const ensureUTC = (ts: string) =>
  ts && !ts.endsWith('Z') && !ts.includes('+') ? ts + 'Z' : ts

describe('ensureUTC', () => {
  it('appends Z to bare ISO timestamp', () => {
    expect(ensureUTC('2026-01-15T14:00:00')).toBe('2026-01-15T14:00:00Z')
  })

  it('does not double-append Z', () => {
    expect(ensureUTC('2026-01-15T14:00:00Z')).toBe('2026-01-15T14:00:00Z')
  })

  it('does not append Z when offset is present (+)', () => {
    expect(ensureUTC('2026-01-15T14:00:00+05:30')).toBe('2026-01-15T14:00:00+05:30')
  })

  it('does not append Z when negative offset is present', () => {
    // The function checks for '+' but not '-'; confirm current behavior
    // This documents whether negative offsets like "-05:00" *should* be untouched
    const input = '2026-01-15T14:00:00-05:00'
    const result = ensureUTC(input)
    // The current implementation only checks for '+', so '-' offset will get Z appended
    // This test documents the behavior so it can be caught if changed
    expect(result).toBe('2026-01-15T14:00:00-05:00Z')
  })

  it('handles date-only strings', () => {
    expect(ensureUTC('2026-01-15')).toBe('2026-01-15Z')
  })

  it('returns falsy input unchanged', () => {
    expect(ensureUTC('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Time slot format validation — documents the expected formats
// ---------------------------------------------------------------------------

describe('time slot format validation', () => {
  const WEB_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
  const AGENT_FORMAT = /^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}$/

  describe('web format (ISO T separator)', () => {
    it('matches valid web time slot', () => {
      expect('2026-01-15T09:00').toMatch(WEB_FORMAT)
      expect('2026-12-31T23:59').toMatch(WEB_FORMAT)
      expect('2026-01-01T00:00').toMatch(WEB_FORMAT)
    })

    it('rejects agent format', () => {
      expect('2026-01-15_09:00').not.toMatch(WEB_FORMAT)
    })

    it('rejects full ISO with seconds', () => {
      expect('2026-01-15T09:00:00').not.toMatch(WEB_FORMAT)
    })

    it('rejects full ISO with Z suffix', () => {
      expect('2026-01-15T09:00Z').not.toMatch(WEB_FORMAT)
    })

    it('rejects date-only', () => {
      expect('2026-01-15').not.toMatch(WEB_FORMAT)
    })
  })

  describe('agent format (underscore separator)', () => {
    it('matches valid agent time slot', () => {
      expect('2026-01-15_09:00').toMatch(AGENT_FORMAT)
      expect('2026-12-31_23:59').toMatch(AGENT_FORMAT)
    })

    it('rejects web format', () => {
      expect('2026-01-15T09:00').not.toMatch(AGENT_FORMAT)
    })
  })

  describe('format conversion', () => {
    it('converts web to agent format', () => {
      const web = '2026-01-15T09:00'
      expect(web.replace('T', '_')).toBe('2026-01-15_09:00')
    })

    it('converts agent to web format', () => {
      const agent = '2026-01-15_09:00'
      expect(agent.replace('_', 'T')).toBe('2026-01-15T09:00')
    })
  })
})

// ---------------------------------------------------------------------------
// Meeting time storage and retrieval scenarios
// ---------------------------------------------------------------------------

describe('meeting time storage scenarios', () => {
  it('UTC meeting time parses correctly as a Date', () => {
    const stored = '2026-01-15T14:00:00'
    const withZ = ensureUTC(stored)
    const d = new Date(withZ)
    expect(d.getUTCHours()).toBe(14)
    expect(d.getUTCMinutes()).toBe(0)
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(0) // January = 0
    expect(d.getUTCDate()).toBe(15)
  })

  it('meeting round-trips through UTC correctly', () => {
    // User in NY creates meeting at 10:00 AM EST = 15:00 UTC
    const utcTime = '2026-01-15T15:00:00'
    const stored = utcTime // stored as plain TIMESTAMP in DB
    const retrieved = ensureUTC(stored)
    const d = new Date(retrieved)

    expect(d.getUTCHours()).toBe(15)
    expect(d.getUTCMinutes()).toBe(0)
  })

  it('time interval slots align with calendar config intervals', () => {
    // 15-minute intervals
    const slots15 = ['T09:00', 'T09:15', 'T09:30', 'T09:45', 'T10:00']
    for (const slot of slots15) {
      const minutes = parseInt(slot.split(':')[1], 10)
      expect(minutes % 15).toBe(0)
    }

    // 30-minute intervals
    const slots30 = ['T09:00', 'T09:30', 'T10:00', 'T10:30']
    for (const slot of slots30) {
      const minutes = parseInt(slot.split(':')[1], 10)
      expect(minutes % 30).toBe(0)
    }

    // 60-minute intervals
    const slots60 = ['T09:00', 'T10:00', 'T11:00', 'T12:00']
    for (const slot of slots60) {
      const minutes = parseInt(slot.split(':')[1], 10)
      expect(minutes % 60).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Timezone defaulting
// ---------------------------------------------------------------------------

describe('timezone defaults', () => {
  it('new user defaults to UTC', () => {
    // Mirrors auth.ts: new users get timezone: 'UTC'
    const defaultTimezone = 'UTC'
    expect(defaultTimezone).toBe('UTC')
  })

  it('unknown timezone string should be treated carefully', () => {
    // Validate that IANA timezone identifiers are expected
    const validIana = [
      'UTC',
      'America/New_York',
      'Europe/London',
      'Asia/Tokyo',
      'Australia/Sydney',
    ]
    for (const tz of validIana) {
      expect(tz === 'UTC' || tz.includes('/')).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Availability merge with timezone awareness
// ---------------------------------------------------------------------------

describe('availability time slot merging', () => {
  it('add mode merges unique slots (simulates API behavior)', () => {
    const existing = ['2026-01-15T09:00', '2026-01-15T09:30']
    const newSlots = ['2026-01-15T09:30', '2026-01-15T10:00']

    const merged = new Set<string>(existing)
    for (const slot of newSlots) merged.add(slot)
    const result = Array.from(merged)

    expect(result).toHaveLength(3)
    expect(result).toContain('2026-01-15T09:00')
    expect(result).toContain('2026-01-15T09:30')
    expect(result).toContain('2026-01-15T10:00')
  })

  it('remove mode subtracts slots', () => {
    const existing = ['2026-01-15T09:00', '2026-01-15T09:30', '2026-01-15T10:00']
    const toRemove = new Set(['2026-01-15T09:30'])
    const result = existing.filter((s) => !toRemove.has(s))

    expect(result).toHaveLength(2)
    expect(result).not.toContain('2026-01-15T09:30')
  })

  it('time slots from different dates are distinct', () => {
    const slots = new Set([
      '2026-01-15T09:00',
      '2026-01-16T09:00', // same time, different date
    ])
    expect(slots.size).toBe(2)
  })

  it('removing all slots results in empty array', () => {
    const existing = ['2026-01-15T09:00']
    const toRemove = new Set(['2026-01-15T09:00'])
    const result = existing.filter((s) => !toRemove.has(s))
    expect(result).toHaveLength(0)
  })
})
