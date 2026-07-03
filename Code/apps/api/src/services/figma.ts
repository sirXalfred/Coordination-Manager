/**
 * Figma REST API service — wraps file, project, and node operations.
 *
 * Uses a Personal Access Token stored in FIGMA_ACCESS_TOKEN env var.
 * API reference: https://developers.figma.com/docs/rest-api/
 */

const FIGMA_API = 'https://api.figma.com/v1'

function getToken(): string {
  const token = process.env.FIGMA_ACCESS_TOKEN
  if (!token) {
    throw new Error('FIGMA_ACCESS_TOKEN is not set in environment variables')
  }
  return token
}

function headers(): Record<string, string> {
  return {
    'X-Figma-Token': getToken(),
    'Content-Type': 'application/json',
  }
}

// ─── Types ────────────────────────────────────────────────────────────

export interface FigmaFile {
  name: string
  lastModified: string
  thumbnailUrl: string
  version: string
}

export interface FigmaProject {
  id: string
  name: string
}

export interface FigmaProjectFile {
  key: string
  name: string
  thumbnail_url: string
  last_modified: string
}

export interface FigmaNode {
  id: string
  name: string
  type: string
  children?: FigmaNode[]
}

export interface FigmaComment {
  id: string
  message: string
  created_at: string
  user: { handle: string; img_url: string }
}

export interface FigmaImage {
  nodeId: string
  url: string
}

// ─── File Operations ──────────────────────────────────────────────────

/** Get file metadata and full node tree */
export async function getFile(fileKey: string): Promise<FigmaFile & { document: FigmaNode }> {
  const res = await fetch(`${FIGMA_API}/files/${encodeURIComponent(fileKey)}`, {
    headers: headers(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Figma API error ${res.status}: ${body}`)
  }
  return res.json() as Promise<FigmaFile & { document: FigmaNode }>
}

/** Get specific nodes from a file */
export async function getFileNodes(
  fileKey: string,
  nodeIds: string[],
): Promise<Record<string, { document: FigmaNode }>> {
  const ids = nodeIds.map(encodeURIComponent).join(',')
  const res = await fetch(`${FIGMA_API}/files/${encodeURIComponent(fileKey)}/nodes?ids=${ids}`, {
    headers: headers(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Figma API error ${res.status}: ${body}`)
  }
  const data = await res.json() as { nodes: Record<string, { document: FigmaNode }> }
  return data.nodes
}

// ─── Project Operations ───────────────────────────────────────────────

/** List projects in a team */
export async function listTeamProjects(teamId: string): Promise<FigmaProject[]> {
  const res = await fetch(`${FIGMA_API}/teams/${encodeURIComponent(teamId)}/projects`, {
    headers: headers(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Figma API error ${res.status}: ${body}`)
  }
  const data = await res.json() as { projects: FigmaProject[] }
  return data.projects
}

/** List files in a project */
export async function listProjectFiles(projectId: string): Promise<FigmaProjectFile[]> {
  const res = await fetch(`${FIGMA_API}/projects/${encodeURIComponent(projectId)}/files`, {
    headers: headers(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Figma API error ${res.status}: ${body}`)
  }
  const data = await res.json() as { files: FigmaProjectFile[] }
  return data.files
}

// ─── Image Export ─────────────────────────────────────────────────────

/** Export nodes as images (PNG, SVG, JPG, PDF) */
export async function exportImages(
  fileKey: string,
  nodeIds: string[],
  format: 'png' | 'svg' | 'jpg' | 'pdf' = 'png',
  scale: number = 2,
): Promise<FigmaImage[]> {
  const ids = nodeIds.map(encodeURIComponent).join(',')
  const res = await fetch(
    `${FIGMA_API}/images/${encodeURIComponent(fileKey)}?ids=${ids}&format=${format}&scale=${scale}`,
    { headers: headers() },
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Figma API error ${res.status}: ${body}`)
  }
  const data = await res.json() as { images: Record<string, string> }
  return Object.entries(data.images).map(([nodeId, url]) => ({
    nodeId,
    url,
  }))
}

// ─── Comments ─────────────────────────────────────────────────────────

/** Get comments on a file */
export async function getComments(fileKey: string): Promise<FigmaComment[]> {
  const res = await fetch(`${FIGMA_API}/files/${encodeURIComponent(fileKey)}/comments`, {
    headers: headers(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Figma API error ${res.status}: ${body}`)
  }
  const data = await res.json() as { comments: FigmaComment[] }
  return data.comments
}

/** Post a comment on a file */
export async function postComment(
  fileKey: string,
  message: string,
  nodeId?: string,
): Promise<FigmaComment> {
  const body: Record<string, unknown> = { message }
  if (nodeId) {
    body.client_meta = { node_id: nodeId }
  }
  const res = await fetch(`${FIGMA_API}/files/${encodeURIComponent(fileKey)}/comments`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Figma API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<FigmaComment>
}

// ─── Styles & Components ─────────────────────────────────────────────

/** Get published styles from a file */
export async function getFileStyles(fileKey: string) {
  const res = await fetch(`${FIGMA_API}/files/${encodeURIComponent(fileKey)}/styles`, {
    headers: headers(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Figma API error ${res.status}: ${body}`)
  }
  const data = await res.json() as { meta?: { styles?: unknown[] } }
  return data.meta?.styles ?? []
}

/** Get published components from a file */
export async function getFileComponents(fileKey: string) {
  const res = await fetch(`${FIGMA_API}/files/${encodeURIComponent(fileKey)}/components`, {
    headers: headers(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Figma API error ${res.status}: ${body}`)
  }
  const data = await res.json() as { meta?: { components?: unknown[] } }
  return data.meta?.components ?? []
}

// ─── Create File ──────────────────────────────────────────────────────

/** Create a new file in a project (Figma API v1 POST /files) */
export async function createFile(
  _projectId: string,
  _name: string,
): Promise<{ key: string; name: string }> {
  // Figma doesn't have a direct "create file" REST endpoint.
  // Files are created via the Plugin API or manually.
  // This is a placeholder that documents the limitation.
  throw new Error(
    'Figma REST API does not support creating files directly. ' +
    'Use the Figma Plugin (running inside Figma) to create and populate files. ' +
    'See the figma-plugin/ directory for the wireframe generator plugin.'
  )
}
