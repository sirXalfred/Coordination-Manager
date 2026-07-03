import { Request, Response, NextFunction } from 'express'
import { supabase, supabaseAdmin } from '../supabaseClient.js'
import { UnauthorizedError } from './error-handler.js'

export interface AuthenticatedRequest extends Request {
  userId?: string
  userEmail?: string
  userRole?: string
  userRoles?: string[]
  /** The raw Supabase Auth user ID before any merged-user redirect */
  rawAuthUserId?: string
  /** The raw JWT access token from the Authorization header */
  accessToken?: string
}

/** Check if the authenticated user has a specific role */
export function hasRole(req: AuthenticatedRequest, role: string): boolean {
  return req.userRoles?.includes(role) ?? req.userRole === role
}

/** Parse roles from DB JSONB array */
function parseRoles(dbRoles: unknown): string[] {
  if (Array.isArray(dbRoles) && dbRoles.length > 0) {
    return dbRoles.map(String)
  }
  return ['user']
}

/**
 * Resolve a merged wallet user: when a Supabase Auth user has no matching
 * row in the `users` table (because the merge deleted it), look up the
 * surviving account by wallet_address.
 *
 * Returns the redirected { userId, userEmail, userRole, userRoles } or null.
 */
async function resolveMergedUser(
  authUserId: string,
  authUserEmail: string | undefined,
  userMetadata: Record<string, unknown> | undefined
): Promise<{ userId: string; userEmail: string | undefined; userRole: string; userRoles: string[] } | null> {
  // 1. Check for an explicit redirect (set when wallet was unlinked while
  //    the user was logged in via the wallet session — keeps session alive).
  const redirectToUserId = userMetadata?.redirect_to_user_id as string | undefined
  if (redirectToUserId && redirectToUserId !== authUserId) {
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('id, email, roles')
      .eq('id', redirectToUserId)
      .maybeSingle()
    if (targetUser) {
      const roles = parseRoles(targetUser.roles)
      return {
        userId: targetUser.id,
        userEmail: targetUser.email || authUserEmail,
        userRole: roles[0] || 'user',
        userRoles: roles,
      }
    }
  }

  // 2. If the auth user's wallet_address is known, see if another user owns it
  const walletAddress =
    userMetadata?.wallet_address as string | undefined

  if (!walletAddress) return null

  const { data: linkedUser } = await supabaseAdmin
    .from('users')
    .select('id, email, roles')
    .eq('wallet_address', walletAddress)
    .maybeSingle()

  if (linkedUser && linkedUser.id !== authUserId) {
    const roles = parseRoles(linkedUser.roles)
    return {
      userId: linkedUser.id,
      userEmail: linkedUser.email || authUserEmail,
      userRole: roles[0] || 'user',
      userRoles: roles,
    }
  }

  return null
}

/**
 * Middleware that verifies the Supabase access token from the Authorization header.
 * Attaches user info to the request object for downstream handlers.
 * Rejects unauthenticated requests.
 *
 * If the authenticated Supabase user has no `users`-table row (post-merge),
 * the middleware transparently redirects to the surviving account that holds
 * the same wallet_address.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      throw new UnauthorizedError('Missing authentication token')
    }

    // Verify the token with Supabase to get the user
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      throw new UnauthorizedError('Invalid or expired token')
    }

    // Attach user info to request
    req.userId = data.user.id
    req.userEmail = data.user.email
    req.rawAuthUserId = data.user.id  // preserve before any redirect
    req.accessToken = token  // preserve raw JWT for server-side sign-out

    // Fetch roles (and wallet_address) from the database so admin
    // role set directly in the DB is respected.
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('roles, wallet_address')
      .eq('id', data.user.id)
      .maybeSingle()

    // The auth user's wallet_address from Supabase metadata
    const metaWallet = (data.user.user_metadata as Record<string, unknown> | undefined)
      ?.wallet_address as string | undefined

    if (profile) {
      const roles = parseRoles(profile.roles)
      req.userRole = roles[0] || 'user'
      req.userRoles = roles

      // Detect "phantom" profile: a profile was auto-created for a merged
      // wallet auth user (before the redirect fix existed).  Signature:
      // auth user has wallet_address in metadata but the profile row does NOT
      // have wallet_address — another user owns the wallet now.
      if (metaWallet && !profile.wallet_address) {
        const merged = await resolveMergedUser(
          data.user.id,
          data.user.email,
          data.user.user_metadata as Record<string, unknown> | undefined
        )
        if (merged) {
          req.userId = merged.userId
          req.userEmail = merged.userEmail
          req.userRole = merged.userRole
          req.userRoles = merged.userRoles
          // Clean up the phantom row so future requests skip this check
          supabaseAdmin.from('users').delete().eq('id', data.user.id).then(() => {})
          return next()
        }
      }
    } else {
      // No users-table row — this auth user may have been merged.
      // Check if the wallet_address now belongs to a different (surviving) user.
      const merged = await resolveMergedUser(
        data.user.id,
        data.user.email,
        data.user.user_metadata as Record<string, unknown> | undefined
      )
      if (merged) {
        req.userId = merged.userId
        req.userEmail = merged.userEmail
        req.userRole = merged.userRole
        req.userRoles = merged.userRoles
      } else {
        // SECURITY: Never read roles from user_metadata (user-writable via
        // supabase.auth.updateUser). Default to unprivileged 'user' role.
        req.userRole = 'user'
        req.userRoles = ['user']
      }
    }

    next()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error)
    } else {
      next(new UnauthorizedError('Token verification failed'))
    }
  }
}

/**
 * Optional auth middleware — extracts user info if a valid token is present,
 * but allows the request to proceed without auth for public access.
 * Use on routes that are publicly readable but need auth for write operations.
 *
 * Also handles merged-user redirection (same as authMiddleware).
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.replace('Bearer ', '')

    if (token) {
      const { data, error } = await supabase.auth.getUser(token)
      if (!error && data.user) {
        req.userId = data.user.id
        req.userEmail = data.user.email
        req.rawAuthUserId = data.user.id  // preserve before any redirect

        const { data: profile } = await supabaseAdmin
          .from('users')
          .select('roles, wallet_address')
          .eq('id', data.user.id)
          .maybeSingle()

        const metaWallet = (data.user.user_metadata as Record<string, unknown> | undefined)
          ?.wallet_address as string | undefined

        if (profile) {
          const roles = parseRoles(profile.roles)
          req.userRole = roles[0] || 'user'
          req.userRoles = roles

          // Detect phantom profile (see authMiddleware for details)
          if (metaWallet && !profile.wallet_address) {
            const merged = await resolveMergedUser(
              data.user.id,
              data.user.email,
              data.user.user_metadata as Record<string, unknown> | undefined
            )
            if (merged) {
              req.userId = merged.userId
              req.userEmail = merged.userEmail
              req.userRole = merged.userRole
              req.userRoles = merged.userRoles
              supabaseAdmin.from('users').delete().eq('id', data.user.id).then(() => {})
            }
          }
        } else {
          // No users-table row — check for merged wallet user
          const merged = await resolveMergedUser(
            data.user.id,
            data.user.email,
            data.user.user_metadata as Record<string, unknown> | undefined
          )
          if (merged) {
            req.userId = merged.userId
            req.userEmail = merged.userEmail
            req.userRole = merged.userRole
            req.userRoles = merged.userRoles
          } else {
            // SECURITY: Never read roles from user_metadata (user-writable via
            // supabase.auth.updateUser). Default to unprivileged 'user' role.
            req.userRole = 'user'
            req.userRoles = ['user']
          }
        }
      }
    }
  } catch {
    // Token invalid or missing — proceed as unauthenticated
  }
  next()
}

/**
 * Check if the current user has edit permission on a calendar.
 * Matches by email or userId against `created_by` and `permissions.canEdit`.
 */
export function hasCalendarEditPermission(
  calendar: { created_by: string; permissions?: { canEdit?: string[] } | null },
  req: AuthenticatedRequest
): { isCreator: boolean; canEdit: boolean } {
  const createdBy = calendar.created_by || ''
  const isCreator = createdBy === req.userEmail || createdBy === req.userId
  // Normalize canEdit to an array — legacy data may store it as a space-separated string
  const rawEditList = (calendar.permissions as { canEdit?: unknown } | null)?.canEdit
  const editList: string[] = Array.isArray(rawEditList)
    ? rawEditList
    : typeof rawEditList === 'string' && rawEditList
      ? rawEditList.split(/\s+/)
      : []
  const canEdit = isCreator ||
    (!!req.userEmail && editList.includes(req.userEmail)) ||
    (!!req.userId && editList.includes(req.userId))
  return { isCreator, canEdit }
}

/**
 * Like hasCalendarEditPermission but also resolves cross-format identity
 * mismatches (e.g. created_by is a UUID but the requester authenticates
 * with an email, or vice-versa). Queries the users table when the simple
 * string comparison fails.
 */
export async function hasCalendarEditPermissionAsync(
  calendar: { created_by: string; permissions?: { canEdit?: string[] } | null },
  req: AuthenticatedRequest
): Promise<{ isCreator: boolean; canEdit: boolean }> {
  // Fast path — synchronous check first
  const sync = hasCalendarEditPermission(calendar, req)
  if (sync.canEdit) return sync

  // Slow path — created_by might be stored in a different format than the
  // requester's identity. Look up the user row to cross-reference.
  const createdBy = calendar.created_by || ''
  if (!createdBy || !req.userId) return sync

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  try {
    if (uuidPattern.test(createdBy)) {
      // created_by is a UUID — check if it matches the requester's user row
      const { data: creatorUser } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .eq('id', createdBy)
        .maybeSingle()

      if (creatorUser) {
        const isCreator =
          creatorUser.id === req.userId ||
          (!!req.userEmail && creatorUser.email === req.userEmail)
        if (isCreator) return { isCreator: true, canEdit: true }
      }
    } else if (createdBy.includes('@')) {
      // created_by is an email — check if it belongs to the requester
      const { data: creatorUser } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .eq('email', createdBy)
        .maybeSingle()

      if (creatorUser && creatorUser.id === req.userId) {
        return { isCreator: true, canEdit: true }
      }
    }
  } catch {
    // DB lookup failed — fall through to sync result
  }

  return sync
}
