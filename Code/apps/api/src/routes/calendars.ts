import { Router, Response } from 'express';
import type { Router as RouterType } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { nanoid } from 'nanoid';
import { optionalAuthMiddleware, AuthenticatedRequest, hasCalendarEditPermission } from '../middleware/auth.js';

const router: RouterType = Router();

// Apply optional auth to all routes — extracts user info when token present
router.use(optionalAuthMiddleware);

// Create a new calendar
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { title, config, permissions, created_by, visibility, creator_account_type } = req.body;
  const hash = nanoid(10);

  // Use server-verified identity when authenticated, fall back to client-supplied for travelers
  const verifiedCreatedBy = req.userEmail || req.userId || created_by;

  // Enforce title ↔ config.eventName sync: they must always match.
  // Title is the canonical name; config.eventName mirrors it for the calendar view.
  const syncedConfig = { ...(config || {}), eventName: title };

  const { data, error } = await supabaseAdmin
    .from('calendars')
    .insert([
      { hash, title, config: syncedConfig, permissions, created_by: verifiedCreatedBy, visibility: visibility || 'unlisted', creator_account_type: creator_account_type || 'google' }
    ])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// Get calendar by hash
router.get('/:hash', async (req: AuthenticatedRequest, res: Response) => {
  const { hash } = req.params;
  const { data, error } = await supabaseAdmin
    .from('calendars')
    .select('*')
    .eq('hash', hash)
    .single();

  if (error) return res.status(404).json({ error: 'Calendar not found' });

  // Compute ownership flags server-side so frontend doesn't need to guess identity formats
  let is_owner = false;
  let has_edit_permission = false;

  if (req.userId) {
    const { isCreator, canEdit } = hasCalendarEditPermission(data, req);
    is_owner = isCreator;
    has_edit_permission = canEdit;
  }

  // Resolve creator display name so frontend never shows raw emails
  const creator_display_name = await resolveCreatorDisplayName(data.created_by);

  // Check if the requesting user is friends with the calendar creator
  let is_friend_with_creator = false;
  if (req.userId && !is_owner && data.created_by) {
    is_friend_with_creator = await checkFriendWithCreator(req.userId, data.created_by);
  }

  res.json({ ...data, is_owner, has_edit_permission, creator_display_name, is_friend_with_creator });
});

/**
 * Resolve a single created_by value to its public display name.
 * Returns the display_name, traveler_name, or wallet_address — never the raw email.
 * Falls back to null if no user is found or no public name is set.
 */
async function resolveCreatorDisplayName(createdBy: string | null | undefined): Promise<string | null> {
  if (!createdBy) return null;
  const map = await buildCreatorNameMap([createdBy]);
  return map.get(createdBy) || null;
}

/**
 * Build a map from created_by values to public display names.
 * created_by may be a UUID (userId), email, traveler_name, or wallet_address —
 * we run separate queries per type to avoid UUID cast errors in Supabase.
 */
async function buildCreatorNameMap(creatorIds: string[]): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  if (!creatorIds.length) return nameMap;

  // Partition creator IDs by type so each query targets the correct column
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Fake-email patterns used for non-Google accounts (e.g. wallet-xxx@cardano.wallet, traveler-xxx@traveler.local)
  const fakeEmailPattern = /@(cardano\.wallet|traveler\.local)$/i;
  const uuids: string[] = [];
  const emails: string[] = [];
  const fakeEmails: string[] = []; // wallet / traveler pseudo-emails
  const names: string[] = [];
  for (const id of creatorIds) {
    if (uuidPattern.test(id)) uuids.push(id);
    else if (fakeEmailPattern.test(id)) fakeEmails.push(id);
    else if (id.includes('@')) emails.push(id);
    else names.push(id);
  }

  // Run queries in parallel — one per column type
  const selectCols = 'id, email, display_name, traveler_name, wallet_address';
  type UserLookupRow = { id?: string; email?: string; display_name?: string | null; traveler_name?: string | null; wallet_address?: string | null };
  const queries: PromiseLike<UserLookupRow[]>[] = [];
  if (uuids.length) {
    queries.push(
      supabaseAdmin.from('users').select(selectCols).in('id', uuids).then(r => r.data || [])
    );
  }
  if (emails.length) {
    queries.push(
      supabaseAdmin.from('users').select(selectCols).in('email', emails).then(r => r.data || [])
    );
  }
  // Fake emails (wallet / traveler) — the user's id column holds the UUID that was used
  // to create the fake email, so look up by id extracted from the prefix, or by email column
  // since some implementations store the fake email there too
  if (fakeEmails.length) {
    queries.push(
      supabaseAdmin.from('users').select(selectCols).in('email', fakeEmails).then(r => r.data || [])
    );
    // Also try traveler_name for traveler accounts
    queries.push(
      supabaseAdmin.from('users').select(selectCols).in('traveler_name', fakeEmails).then(r => r.data || [])
    );
  }
  if (names.length) {
    // Names could be traveler_name or wallet_address — check both
    queries.push(
      supabaseAdmin.from('users').select(selectCols).in('traveler_name', names).then(r => r.data || [])
    );
    queries.push(
      supabaseAdmin.from('users').select(selectCols).in('wallet_address', names).then(r => r.data || [])
    );
  }

  const results = await Promise.all(queries);
  const allUsers = results.flat();

  // Build lookup: created_by value → public display name.
  // Priority: display_name > traveler_name > wallet_address (truncated).
  // Never expose raw emails.
  for (const u of allUsers) {
    const displayName = u.display_name || u.traveler_name || null;
    const walletShort = u.wallet_address
      ? `${u.wallet_address.slice(0, 8)}...${u.wallet_address.slice(-6)}`
      : null;
    const publicName = displayName || walletShort || null;
    if (publicName) {
      if (u.id) nameMap.set(u.id, publicName);
      if (u.email) nameMap.set(u.email, publicName);
      if (u.traveler_name) nameMap.set(u.traveler_name, publicName);
      if (u.wallet_address) nameMap.set(u.wallet_address, publicName);
    }
  }

  // For any fake-email created_by values that weren't found via DB lookup,
  // generate a readable fallback from the fake email itself
  for (const fe of fakeEmails) {
    if (!nameMap.has(fe)) {
      if (fe.endsWith('@cardano.wallet')) {
        // Extract "wallet-0161985f4b18302a7035" → show truncated wallet ID
        const prefix = fe.replace('@cardano.wallet', '');
        const walletId = prefix.replace(/^wallet-/, '');
        nameMap.set(fe, walletId.length > 14 ? `${walletId.slice(0, 8)}...${walletId.slice(-6)}` : walletId);
      } else if (fe.endsWith('@traveler.local')) {
        const prefix = fe.replace('@traveler.local', '');
        nameMap.set(fe, prefix.replace(/^traveler-/, ''));
      }
    }
  }

  return nameMap;
}

/**
 * Check if the requesting user is friends (connected) with the calendar creator.
 * Resolves the created_by value to a user UUID first, then checks user_connections.
 */
async function checkFriendWithCreator(requestingUserId: string, createdBy: string): Promise<boolean> {
  // Resolve created_by to a user UUID
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let creatorUserId: string | null = null;

  if (uuidPattern.test(createdBy)) {
    creatorUserId = createdBy;
  } else {
    // Look up user by email, traveler_name, or wallet_address
    const lookupField = createdBy.includes('@') ? 'email'
      : createdBy.startsWith('stake') || createdBy.startsWith('addr') ? 'wallet_address'
      : 'traveler_name';
    const { data } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq(lookupField, createdBy)
      .maybeSingle();
    creatorUserId = data?.id || null;
  }

  if (!creatorUserId || creatorUserId === requestingUserId) return false;

  // Check if there's an active connection in either direction
  const { data: conn } = await supabaseAdmin
    .from('user_connections')
    .select('id')
    .eq('status', 'connected')
    .or(
      `and(user_a_id.eq.${requestingUserId},user_b_id.eq.${creatorUserId}),and(user_a_id.eq.${creatorUserId},user_b_id.eq.${requestingUserId})`
    )
    .maybeSingle();

  return !!conn;
}

/**
 * Enrich an array of calendars with creator_display_name and has_recurring_meetings.
 */
type CalendarRow = { id: string; created_by?: string | null; [key: string]: unknown };
async function enrichWithCreatorDisplayNames(calendars: CalendarRow[]): Promise<CalendarRow[]> {
  if (!calendars.length) return calendars;
  const creatorIds = [...new Set(calendars.map(c => c.created_by).filter((v): v is string => Boolean(v)))];
  const nameMap = await buildCreatorNameMap(creatorIds);

  // Find which calendars have at least one recurring meeting
  const calendarIds = calendars.map(c => c.id);
  const { data: recurringMeetings } = await supabaseAdmin
    .from('meetings')
    .select('calendar_id')
    .in('calendar_id', calendarIds)
    .not('recurrence_rule', 'is', null);
  const recurringCalIds = new Set((recurringMeetings || []).map((m: { calendar_id: string }) => m.calendar_id));

  return calendars.map(cal => ({
    ...cal,
    creator_display_name: nameMap.get(cal.created_by || '') || null,
    has_recurring_meetings: recurringCalIds.has(cal.id),
  }));
}

// List all calendars (optionally by user)
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { created_by, include_own } = req.query;
  
  if (created_by) {
    // Filter by specific user
    const query = supabaseAdmin.from('calendars').select('*').eq('created_by', created_by);
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.json(await enrichWithCreatorDisplayNames(data || []));
  }
  
  if (include_own) {
    // Return public calendars + user's own unlisted calendars
    // Use server-verified identity (from auth token) instead of client-supplied value
    // so that traveler accounts (whose created_by is a fake email) can find their calendars
    const ownerIdentity = req.userEmail || req.userId || (include_own as string);

    const { data: publicCals, error: pubError } = await supabaseAdmin
      .from('calendars')
      .select('*')
      .eq('visibility', 'public');
    
    if (pubError) return res.status(400).json({ error: pubError.message });
    
    // Query by both email and userId to cover all identity formats
    const ownQueries = [
      supabaseAdmin.from('calendars').select('*').eq('created_by', ownerIdentity).eq('visibility', 'unlisted'),
    ];
    // Also check userId if it differs from email
    if (req.userId && req.userId !== ownerIdentity) {
      ownQueries.push(
        supabaseAdmin.from('calendars').select('*').eq('created_by', req.userId).eq('visibility', 'unlisted')
      );
    }

    const ownResults = await Promise.all(ownQueries);
    const ownCals = ownResults.flatMap(r => r.data || []);
    
    // Merge and deduplicate by id
    const allCals = [...(publicCals || [])];
    const existingIds = new Set(allCals.map(c => c.id));
    for (const cal of ownCals) {
      if (!existingIds.has(cal.id)) {
        allCals.push(cal);
        existingIds.add(cal.id);
      }
    }
    
    return res.json(await enrichWithCreatorDisplayNames(allCals));
  }
  
  // Default: only public calendars
  const { data, error } = await supabaseAdmin.from('calendars').select('*').eq('visibility', 'public');
  if (error) return res.status(400).json({ error: error.message });
  res.json(await enrichWithCreatorDisplayNames(data || []));
});

// Transfer ownership when a traveler upgrades to a Google account
router.patch('/:hash/transfer-ownership', async (req: AuthenticatedRequest, res: Response) => {
  const { hash } = req.params;
  const { previousCreatorId } = req.body;

  // Require authentication
  if (!req.userId || !req.userEmail) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!previousCreatorId) {
    return res.status(400).json({ error: 'previousCreatorId is required' });
  }

  try {
    // Get the calendar
    const { data: calendar, error: fetchError } = await supabaseAdmin
      .from('calendars')
      .select('*')
      .eq('hash', hash)
      .single();

    if (fetchError || !calendar) {
      return res.status(404).json({ error: 'Calendar not found' });
    }

    // Verify the calendar was created by the traveler (previousCreatorId must match created_by)
    if (calendar.created_by !== previousCreatorId) {
      return res.status(403).json({ error: 'Previous creator ID does not match' });
    }

    // Only allow transfer from traveler accounts
    if (calendar.creator_account_type !== 'traveler') {
      return res.status(403).json({ error: 'Ownership transfer is only allowed from traveler accounts' });
    }

    // Update the calendar: transfer ownership to the new authenticated user
    const canEdit = calendar.permissions?.canEdit || [];
    const newCanEdit = [...new Set([...canEdit, req.userEmail, req.userId])];

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('calendars')
      .update({
        created_by: req.userEmail,
        creator_account_type: 'google',
        permissions: { ...calendar.permissions, canEdit: newCanEdit }
      })
      .eq('hash', hash)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

// Update calendar settings (title, config, visibility)
router.patch('/:hash', async (req: AuthenticatedRequest, res: Response) => {
  const { hash } = req.params;
  const { title, config, visibility } = req.body;

  // Require authentication
  if (!req.userId || !req.userEmail) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Get the calendar to check permissions
    const { data: calendar, error: fetchError } = await supabaseAdmin
      .from('calendars')
      .select('*')
      .eq('hash', hash)
      .single();

    if (fetchError || !calendar) {
      return res.status(404).json({ error: 'Calendar not found' });
    }

    // Verify edit permission using server-verified identity
    const { canEdit: hasPermission } = hasCalendarEditPermission(calendar, req);

    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to edit this calendar' });
    }

    // Build update payload — only include fields that were provided
    const updatePayload: Record<string, unknown> = {};
    if (title !== undefined) updatePayload.title = title;
    if (config !== undefined) updatePayload.config = config;
    if (visibility !== undefined) updatePayload.visibility = visibility;

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Enforce title ↔ config.eventName sync so the name is consistent everywhere.
    // If title is changing, push it into config.eventName.
    // If only config is changing and it has a new eventName, update title to match.
    if (title !== undefined && updatePayload.config) {
      (updatePayload.config as Record<string, unknown>).eventName = title;
    } else if (title !== undefined) {
      // config wasn't provided — merge eventName into the existing config
      const existingConfig = calendar.config || {};
      updatePayload.config = { ...existingConfig, eventName: title };
    } else if (updatePayload.config && (updatePayload.config as Record<string, unknown>).eventName) {
      // config.eventName changed but title wasn't explicitly sent — sync title from it
      updatePayload.title = (updatePayload.config as Record<string, unknown>).eventName;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('calendars')
      .update(updatePayload)
      .eq('hash', hash)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

// Delete a calendar by hash (cascades to availability and meetings)
router.delete('/:hash', async (req: AuthenticatedRequest, res: Response) => {
  const { hash } = req.params;

  // Require authentication for delete operations
  if (!req.userId || !req.userEmail) {
    return res.status(401).json({ error: 'Authentication required to delete a calendar' });
  }

  try {
    // Get the calendar to check ownership
    const { data: calendar, error: fetchError } = await supabaseAdmin
      .from('calendars')
      .select('*')
      .eq('hash', hash)
      .single();

    if (fetchError || !calendar) {
      return res.status(404).json({ error: 'Calendar not found' });
    }

    // Verify ownership using server-verified identity (not client-supplied)
    const { canEdit: hasPermission } = hasCalendarEditPermission(calendar, req);

    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to delete this calendar' });
    }

    // Delete the calendar (availability and meetings cascade via foreign keys)
    const { error: deleteError } = await supabaseAdmin
      .from('calendars')
      .delete()
      .eq('hash', hash);

    if (deleteError) {
      return res.status(400).json({ error: deleteError.message });
    }

    res.json({ message: 'Calendar deleted successfully' });
  } catch {
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

export default router;
