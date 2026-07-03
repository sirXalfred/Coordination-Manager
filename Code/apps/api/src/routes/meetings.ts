import { Router, Response } from 'express';
import type { Router as RouterType } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { optionalAuthMiddleware, AuthenticatedRequest, hasCalendarEditPermission } from '../middleware/auth.js';

/** Ensure a timestamp string has a UTC suffix (meetings table uses plain TIMESTAMP) */
const ensureUTC = (ts: string) =>
  ts && !ts.endsWith('Z') && !ts.includes('+') ? ts + 'Z' : ts;

const router: RouterType = Router();

// Apply optional auth to all routes
router.use(optionalAuthMiddleware);

// Create a new meeting (requires being the calendar creator)
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { calendar_hash, title, description, start_time, end_time, duration_minutes, meeting_link, time_slots, recurrence_rule } = req.body;

  if (!calendar_hash || !title || !start_time || !end_time || !duration_minutes || !time_slots) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get calendar from hash
    const { data: calendar, error: calendarError } = await supabaseAdmin
      .from('calendars')
      .select('id, created_by, permissions')
      .eq('hash', calendar_hash)
      .single();

    if (calendarError || !calendar) {
      return res.status(404).json({ error: 'Calendar not found' });
    }

    // Verify the requester is the calendar creator or has edit permission
    const { canEdit } = hasCalendarEditPermission(calendar, req);
    if (!canEdit) {
      return res.status(403).json({ error: 'Only the calendar creator can create meetings' });
    }

    // Use server-verified identity for created_by
    const created_by = req.userEmail || req.userId;

    // Create meeting
    const { data, error } = await supabaseAdmin
      .from('meetings')
      .insert([
        {
          calendar_id: calendar.id,
          title,
          description,
          start_time,
          end_time,
          duration_minutes,
          meeting_link,
          created_by,
          time_slots,
          recurrence_rule: recurrence_rule || null
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch {
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

// Get a single meeting by ID (public)
router.get('/single/:meetingId', async (req: AuthenticatedRequest, res: Response) => {
  const { meetingId } = req.params;

  try {
    const { data: meeting, error } = await supabaseAdmin
      .from('meetings')
      .select('*, calendars!inner(hash, title, visibility)')
      .eq('id', meetingId)
      .single();

    if (error || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({
      meeting: {
        id: meeting.id,
        title: meeting.title,
        description: meeting.description,
        start_time: ensureUTC(meeting.start_time),
        end_time: ensureUTC(meeting.end_time),
        duration_minutes: meeting.duration_minutes,
        meeting_link: meeting.meeting_link,
        calendar_hash: (meeting.calendars as { hash?: string; title?: string } | null)?.hash,
        calendar_title: (meeting.calendars as { hash?: string; title?: string } | null)?.title,
      },
    });
  } catch {
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

// Get all meetings for a calendar (public read)
router.get('/:hash', async (req: AuthenticatedRequest, res: Response) => {
  const { hash } = req.params;

  try {
    // Get calendar ID from hash
    const { data: calendar, error: calendarError } = await supabaseAdmin
      .from('calendars')
      .select('id')
      .eq('hash', hash)
      .single();

    if (calendarError || !calendar) {
      return res.status(404).json({ error: 'Calendar not found' });
    }

    // Get all meetings for this calendar
    const { data, error } = await supabaseAdmin
      .from('meetings')
      .select('*')
      .eq('calendar_id', calendar.id)
      .order('start_time', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Ensure timestamps have UTC suffix (meetings uses plain TIMESTAMP column)
    const normalized = (data || []).map(m => ({
      ...m,
      start_time: ensureUTC(m.start_time),
      end_time: ensureUTC(m.end_time),
    }));

    res.json(normalized);
  } catch {
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

// Update a meeting (requires being the calendar creator)
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { title, description, start_time, end_time, duration_minutes, meeting_link, time_slots, recurrence_rule } = req.body;

  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Get the meeting and its calendar to verify ownership
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from('meetings')
      .select('id, calendar_id')
      .eq('id', id)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const { data: calendar, error: calError } = await supabaseAdmin
      .from('calendars')
      .select('created_by, permissions')
      .eq('id', meeting.calendar_id)
      .single();

    if (calError || !calendar) {
      return res.status(404).json({ error: 'Calendar not found' });
    }

    const { canEdit: hasPermission } = hasCalendarEditPermission(calendar, req);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only the calendar creator can update meetings' });
    }

    const { data, error } = await supabaseAdmin
      .from('meetings')
      .update({
        title,
        description,
        start_time,
        end_time,
        duration_minutes,
        meeting_link,
        time_slots,
        recurrence_rule: recurrence_rule !== undefined ? (recurrence_rule || null) : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch {
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

// Delete a meeting (requires being the calendar creator)
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Get the meeting and its calendar to verify ownership
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from('meetings')
      .select('id, calendar_id')
      .eq('id', id)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const { data: calendar, error: calError } = await supabaseAdmin
      .from('calendars')
      .select('created_by, permissions')
      .eq('id', meeting.calendar_id)
      .single();

    if (calError || !calendar) {
      return res.status(404).json({ error: 'Calendar not found' });
    }

    const { canEdit: hasPermission } = hasCalendarEditPermission(calendar, req);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only the calendar creator can delete meetings' });
    }

    const { error } = await supabaseAdmin
      .from('meetings')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

export default router;