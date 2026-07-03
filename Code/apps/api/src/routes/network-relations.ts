import { Router, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../supabaseClient.js'
import { authMiddleware, AuthenticatedRequest, hasRole } from '../middleware/auth.js'
import { sanitizeString } from '../middleware/validation.js'

const router: ReturnType<typeof Router> = Router()

// ─── GET /api/network-relations/networks (public) ────────────────────
// Returns all networks with their colors (for calendar coloring).

router.get('/networks', async (_req, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('networks')
      .select('id, name, color, description')
      .order('name', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ networks: data || [] })
  } catch {
    res.status(500).json({ error: 'Failed to fetch networks' })
  }
})

// ─── GET /api/network-relations/mappings (public) ────────────────────
// Returns all mappings so the client can resolve calendar_title -> network.

router.get('/mappings', async (_req, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('network_mappings')
      .select('id, network_id, source_string, source_type')
      .order('source_string', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ mappings: data || [] })
  } catch {
    res.status(500).json({ error: 'Failed to fetch mappings' })
  }
})

// ─── GET /api/network-relations/rules (public) ───────────────────────
// Returns all active rules so the client can auto-classify events.

router.get('/rules', async (_req, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('network_rules')
      .select('id, network_id, pattern, match_type, match_field, priority, is_active')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ rules: data || [] })
  } catch {
    res.status(500).json({ error: 'Failed to fetch rules' })
  }
})

// ─── All remaining routes require admin ──────────────────────────────
router.use(authMiddleware)

/** Guard: reject non-admin users */
function requireAdmin(req: AuthenticatedRequest, res: Response): boolean {
  if (!hasRole(req, 'admin')) {
    res.status(403).json({ error: 'Admin role required' })
    return false
  }
  return true
}

// ─── POST /api/network-relations/networks ────────────────────────────

router.post('/networks', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!requireAdmin(req, res)) return

  try {
    const name = sanitizeString(req.body.name, 200)
    const color = sanitizeString(req.body.color, 7)
    const description = sanitizeString(req.body.description, 1000)

    if (!name) return res.status(400).json({ error: 'Name is required' })
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Color must be a valid hex color (e.g. #3B82F6)' })
    }

    const { data, error } = await supabaseAdmin
      .from('networks')
      .insert({
        name,
        color: color || '#3B82F6',
        description: description || null,
        created_by: req.userEmail || req.userId,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A network with this name already exists' })
      }
      return res.status(500).json({ error: error.message })
    }

    res.status(201).json({ network: data })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/network-relations/networks/:id ─────────────────────────

router.put('/networks/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!requireAdmin(req, res)) return

  try {
    const { id } = req.params
    const name = sanitizeString(req.body.name, 200)
    const color = sanitizeString(req.body.color, 7)
    const description = sanitizeString(req.body.description, 1000)

    if (!name) return res.status(400).json({ error: 'Name is required' })
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Color must be a valid hex color' })
    }

    const { data, error } = await supabaseAdmin
      .from('networks')
      .update({
        name,
        color: color || '#3B82F6',
        description: description || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Network not found' })

    res.json({ network: data })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/network-relations/networks/:id ──────────────────────

router.delete('/networks/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!requireAdmin(req, res)) return

  try {
    const { id } = req.params
    const { error } = await supabaseAdmin
      .from('networks')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/network-relations/mappings ────────────────────────────

router.post('/mappings', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!requireAdmin(req, res)) return

  try {
    const network_id = sanitizeString(req.body.network_id, 36)
    const source_string = sanitizeString(req.body.source_string, 500)
    const source_type = sanitizeString(req.body.source_type, 50)

    if (!network_id || !source_string || !source_type) {
      return res.status(400).json({ error: 'network_id, source_string, and source_type are required' })
    }
    if (!['calendar_title', 'meeting_title', 'description'].includes(source_type)) {
      return res.status(400).json({ error: 'source_type must be calendar_title, meeting_title, or description' })
    }

    const { data, error } = await supabaseAdmin
      .from('network_mappings')
      .insert({
        network_id,
        source_string,
        source_type,
        created_by: req.userEmail || req.userId,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.status(201).json({ mapping: data })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/network-relations/mappings/:id ──────────────────────

router.delete('/mappings/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!requireAdmin(req, res)) return

  try {
    const { id } = req.params
    const { error } = await supabaseAdmin
      .from('network_mappings')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/network-relations/rules ───────────────────────────────

router.post('/rules', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!requireAdmin(req, res)) return

  try {
    const network_id = sanitizeString(req.body.network_id, 36)
    const pattern = sanitizeString(req.body.pattern, 500)
    const match_type = sanitizeString(req.body.match_type, 20)
    const match_field = sanitizeString(req.body.match_field, 20)
    const priority = typeof req.body.priority === 'number' ? req.body.priority : 0

    if (!network_id || !pattern || !match_type || !match_field) {
      return res.status(400).json({ error: 'network_id, pattern, match_type, and match_field are required' })
    }
    if (!['contains', 'starts_with', 'exact', 'regex'].includes(match_type)) {
      return res.status(400).json({ error: 'match_type must be contains, starts_with, exact, or regex' })
    }
    if (!['calendar_title', 'meeting_title', 'description'].includes(match_field)) {
      return res.status(400).json({ error: 'match_field must be calendar_title, meeting_title, or description' })
    }

    // Validate regex patterns server-side to prevent ReDoS
    if (match_type === 'regex') {
      try {
        new RegExp(pattern)
      } catch {
        return res.status(400).json({ error: 'Invalid regex pattern' })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('network_rules')
      .insert({
        network_id,
        pattern,
        match_type,
        match_field,
        priority,
        created_by: req.userEmail || req.userId,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.status(201).json({ rule: data })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/network-relations/rules/:id ────────────────────────────

router.put('/rules/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!requireAdmin(req, res)) return

  try {
    const { id } = req.params
    const pattern = sanitizeString(req.body.pattern, 500)
    const match_type = sanitizeString(req.body.match_type, 20)
    const match_field = sanitizeString(req.body.match_field, 20)
    const priority = typeof req.body.priority === 'number' ? req.body.priority : undefined
    const is_active = typeof req.body.is_active === 'boolean' ? req.body.is_active : undefined

    const updates: Record<string, unknown> = {}
    if (pattern) updates.pattern = pattern
    if (match_type) {
      if (!['contains', 'starts_with', 'exact', 'regex'].includes(match_type)) {
        return res.status(400).json({ error: 'Invalid match_type' })
      }
      updates.match_type = match_type
    }
    if (match_field) {
      if (!['calendar_title', 'meeting_title', 'description'].includes(match_field)) {
        return res.status(400).json({ error: 'Invalid match_field' })
      }
      updates.match_field = match_field
    }
    if (priority !== undefined) updates.priority = priority
    if (is_active !== undefined) updates.is_active = is_active

    if (match_type === 'regex' && pattern) {
      try {
        new RegExp(pattern)
      } catch {
        return res.status(400).json({ error: 'Invalid regex pattern' })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('network_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Rule not found' })

    res.json({ rule: data })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/network-relations/rules/:id ─────────────────────────

router.delete('/rules/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!requireAdmin(req, res)) return

  try {
    const { id } = req.params
    const { error } = await supabaseAdmin
      .from('network_rules')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
