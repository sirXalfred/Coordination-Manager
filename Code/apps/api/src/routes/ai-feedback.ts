import { Router, Response } from 'express'
import { supabaseAdmin } from '../supabaseClient.js'
import { authMiddleware, AuthenticatedRequest, hasRole } from '../middleware/auth.js'
import { sanitizeString, sanitizeUUID, safeErrorMessage } from '../middleware/validation.js'

const router: ReturnType<typeof Router> = Router()

// All routes require authentication
router.use(authMiddleware)

const FEEDBACK_MAX_LENGTH = 2000
const VALID_STATUSES = ['open', 'reviewed', 'resolved', 'dismissed', 'affirmed'] as const

interface AiFeedbackRow {
  status: string
  created_at: string
  users?: { display_name?: string | null; email?: string | null; avatar_url?: string | null } | null
  [key: string]: unknown
}

// ─── GET /api/ai-feedback — List AI feedback ──────────────────────────────────
// Admins see all AI feedback; regular users see only their own.

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = hasRole(req, 'admin')
    const isOversight = hasRole(req, 'oversight')
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
    const offset = (page - 1) * limit
    const statusFilter = req.query.status as string | undefined

    // Parse custom status order from query param (JSON array) or fall back to default
    const DEFAULT_STATUS_ORDER = ['open', 'reviewed', 'affirmed', 'resolved', 'dismissed']
    let statusOrder: string[] = [...DEFAULT_STATUS_ORDER]
    if (req.query.statusOrder) {
      try {
        const parsed = JSON.parse(req.query.statusOrder as string)
        if (Array.isArray(parsed) && parsed.every((s: unknown) => typeof s === 'string' && (VALID_STATUSES as readonly string[]).includes(s as string))) {
          statusOrder = parsed
        }
      } catch { /* use default */ }
    }

    const orderedStatuses = statusFilter && (VALID_STATUSES as readonly string[]).includes(statusFilter)
      ? [statusFilter]
      : statusOrder

    const countByStatus: Record<string, number> = {}
    for (const status of orderedStatuses) {
      const countQuery = supabaseAdmin
        .from('ai_feedback')
        .select('id', { count: 'exact' })

      if (!isAdmin && !isOversight) {
        countQuery.eq('user_id', req.userId!)
      }

      if (status) {
        countQuery.eq('status', status)
      }

      const { count: statusCount } = await countQuery
      countByStatus[status] = statusCount || 0
    }

    const total = orderedStatuses.reduce((sum, status) => sum + (countByStatus[status] || 0), 0)

    const selectFields = '*, users!user_id(display_name, email, avatar_url)'
    const pageStart = offset
    let remainingSkip = pageStart
    let remainingTake = limit
    const paginatedData: AiFeedbackRow[] = []

    for (const status of orderedStatuses) {
      const statusCount = countByStatus[status] || 0
      if (remainingSkip >= statusCount) {
        remainingSkip -= statusCount
        continue
      }

      const statusOffset = remainingSkip
      const statusTake = Math.min(remainingTake, statusCount - statusOffset)
      if (statusTake <= 0) {
        remainingSkip = 0
        continue
      }

      let query = supabaseAdmin
        .from('ai_feedback')
        .select(selectFields, { count: 'exact' })

      if (!isAdmin && !isOversight) {
        query = query.eq('user_id', req.userId!)
      }

      query = query.eq('status', status)
      query = query.order('created_at', { ascending: false })

      const { data, error } = await query.range(statusOffset, statusOffset + statusTake - 1)
      if (error) throw error

      const statusRows = (data as unknown as AiFeedbackRow[] | null) || []
      paginatedData.push(...statusRows)
      remainingTake -= statusRows.length
      remainingSkip = 0

      if (remainingTake <= 0) break
    }

    // Flatten user join
    const feedback = paginatedData.map((item: {
      users?: { display_name?: string | null; email?: string | null; avatar_url?: string | null } | null
      [key: string]: unknown
    }) => ({
      ...item,
      user_display_name: item.users?.display_name || null,
      user_email: item.users?.email || null,
      user_avatar_url: item.users?.avatar_url || null,
      users: undefined,
    }))

    res.json({
      feedback,
      total,
      page,
      limit,
      isAdmin,
    })
  } catch (err) {
    console.error('AI Feedback GET error:', err instanceof Error ? err.message : err)
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── POST /api/ai-feedback — Submit AI feedback with sentiment ────────────────

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPrompt = sanitizeString(req.body.user_prompt, 5000)
    const aiAnswer = sanitizeString(req.body.ai_answer, 10000)
    const feedbackText = sanitizeString(req.body.feedback_text, FEEDBACK_MAX_LENGTH)
    const sentimentValence = parseFloat(req.body.sentiment_valence)
    const sentimentTrust = parseFloat(req.body.sentiment_trust)

    if (!userPrompt || !aiAnswer) {
      return res.status(400).json({ error: 'user_prompt and ai_answer are required' })
    }

    if (isNaN(sentimentValence) || sentimentValence < -1 || sentimentValence > 1) {
      return res.status(400).json({ error: 'sentiment_valence must be between -1 and 1' })
    }

    if (isNaN(sentimentTrust) || sentimentTrust < -1 || sentimentTrust > 1) {
      return res.status(400).json({ error: 'sentiment_trust must be between -1 and 1' })
    }

    const { data, error } = await supabaseAdmin
      .from('ai_feedback')
      .insert({
        user_id: req.userId!,
        user_prompt: userPrompt,
        ai_answer: aiAnswer,
        sentiment_valence: sentimentValence,
        sentiment_trust: sentimentTrust,
        feedback_text: feedbackText || null,
      })
      .select()
      .single()

    if (error) {
      console.error('AI Feedback INSERT failed:', { code: error.code, message: error.message, details: error.details, hint: error.hint, userId: req.userId })
      throw error
    }

    res.status(201).json({ feedback: data })
  } catch (err) {
    console.error('AI Feedback POST error:', err instanceof Error ? err.message : err)
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── PATCH /api/ai-feedback/:id — Admin update (status, response) ─────────────

router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!hasRole(req, 'admin')) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { id } = req.params
    const updates: Record<string, unknown> = {}

    if (req.body.status) {
      if (!(VALID_STATUSES as readonly string[]).includes(req.body.status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` })
      }
      updates.status = req.body.status
    }

    if (req.body.admin_response !== undefined) {
      updates.admin_response = sanitizeString(req.body.admin_response, FEEDBACK_MAX_LENGTH)
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data, error } = await supabaseAdmin
      .from('ai_feedback')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    res.json({ feedback: data })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ─── DELETE /api/ai-feedback/:id — Admin delete an AI feedback entry ─────────

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!hasRole(req, 'admin')) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const id = sanitizeUUID(req.params.id)
    if (!id) {
      return res.status(400).json({ error: 'Invalid AI feedback ID' })
    }

    // Verify the record exists before deleting (avoids silent no-op)
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('ai_feedback')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existing) {
      return res.status(404).json({ error: 'AI feedback not found' })
    }

    const { error } = await supabaseAdmin
      .from('ai_feedback')
      .delete()
      .eq('id', id)

    if (error) throw error

    console.log(`[ADMIN DELETE] ai_feedback id=${id} deleted by admin userId=${req.userId}`)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

export default router
