import { Router, Response, NextFunction } from 'express'
import type { Router as RouterType } from 'express'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { authMiddleware } from '../middleware/auth.js'
import { ValidationError } from '../middleware/error-handler.js'
import * as figma from '../services/figma.js'

const router: RouterType = Router()

// All Figma routes require authentication
router.use(authMiddleware)

// ─── Team & Project listing ──────────────────────────────────────────

/** GET /api/figma/projects — list projects in the configured team */
router.get('/projects', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const teamId = process.env.FIGMA_TEAM_ID
    if (!teamId) {
      throw new ValidationError('FIGMA_TEAM_ID is not configured on the server')
    }
    const projects = await figma.listTeamProjects(teamId)
    res.json({ projects })
  } catch (error) {
    next(error)
  }
})

/** GET /api/figma/projects/:projectId/files — list files in a project */
router.get('/projects/:projectId/files', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params
    const files = await figma.listProjectFiles(projectId)
    res.json({ files })
  } catch (error) {
    next(error)
  }
})

// ─── File Operations ──────────────────────────────────────────────────

/** GET /api/figma/files/:fileKey — get file metadata & node tree */
router.get('/files/:fileKey', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fileKey } = req.params
    const file = await figma.getFile(fileKey)
    res.json({ file })
  } catch (error) {
    next(error)
  }
})

/** GET /api/figma/files/:fileKey/nodes?ids=1:2,1:3 — get specific nodes */
router.get('/files/:fileKey/nodes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fileKey } = req.params
    const ids = (req.query.ids as string)?.split(',').filter(Boolean)
    if (!ids?.length) {
      throw new ValidationError('ids query parameter is required (comma-separated node IDs)')
    }
    const nodes = await figma.getFileNodes(fileKey, ids)
    res.json({ nodes })
  } catch (error) {
    next(error)
  }
})

// ─── Image Export ─────────────────────────────────────────────────────

/** GET /api/figma/files/:fileKey/images?ids=1:2&format=png&scale=2 */
router.get('/files/:fileKey/images', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fileKey } = req.params
    const ids = (req.query.ids as string)?.split(',').filter(Boolean)
    if (!ids?.length) {
      throw new ValidationError('ids query parameter is required (comma-separated node IDs)')
    }
    const format = (req.query.format as 'png' | 'svg' | 'jpg' | 'pdf') || 'png'
    if (!['png', 'svg', 'jpg', 'pdf'].includes(format)) {
      throw new ValidationError('format must be one of: png, svg, jpg, pdf')
    }
    const scale = req.query.scale ? Number(req.query.scale) : 2
    if (isNaN(scale) || scale < 0.01 || scale > 4) {
      throw new ValidationError('scale must be between 0.01 and 4')
    }
    const images = await figma.exportImages(fileKey, ids, format, scale)
    res.json({ images })
  } catch (error) {
    next(error)
  }
})

// ─── Comments ─────────────────────────────────────────────────────────

/** GET /api/figma/files/:fileKey/comments */
router.get('/files/:fileKey/comments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fileKey } = req.params
    const comments = await figma.getComments(fileKey)
    res.json({ comments })
  } catch (error) {
    next(error)
  }
})

/** POST /api/figma/files/:fileKey/comments — post a comment */
router.post('/files/:fileKey/comments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fileKey } = req.params
    const { message, nodeId } = req.body
    if (!message || typeof message !== 'string') {
      throw new ValidationError('message is required')
    }
    const comment = await figma.postComment(fileKey, message, nodeId)
    res.json({ comment })
  } catch (error) {
    next(error)
  }
})

// ─── Styles & Components ─────────────────────────────────────────────

/** GET /api/figma/files/:fileKey/styles */
router.get('/files/:fileKey/styles', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fileKey } = req.params
    const styles = await figma.getFileStyles(fileKey)
    res.json({ styles })
  } catch (error) {
    next(error)
  }
})

/** GET /api/figma/files/:fileKey/components */
router.get('/files/:fileKey/components', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fileKey } = req.params
    const components = await figma.getFileComponents(fileKey)
    res.json({ components })
  } catch (error) {
    next(error)
  }
})

// ─── Wireframe Spec Endpoint ──────────────────────────────────────────

/** POST /api/figma/wireframe-spec — returns a wireframe specification
 *  that can be sent to the Figma plugin for rendering.
 *
 *  Body: { pages: string[] }  — page names to generate specs for.
 *  Returns the JSON spec the plugin consumes.
 */
router.post('/wireframe-spec', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { pages } = req.body
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new ValidationError('pages array is required (e.g. ["HomePage", "CalendarPage"])')
    }

    // Import dynamically to keep the route file lean
    const { generateWireframeSpec } = await import('../services/figma-wireframes.js')
    const spec = generateWireframeSpec(pages)
    res.json(spec)
  } catch (error) {
    next(error)
  }
})

export default router
