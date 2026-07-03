---
name: express-api
description: Create Express API routes with auth middleware, rate limiting, and Supabase integration
---

# express-api

## Purpose

Guides creation and modification of Express.js API endpoints in `Code/apps/api/`. Covers the project's middleware stack, rate limiting strategy, auth patterns, error handling, and Supabase client usage.

## When to Use

- Adding new API routes to `Code/apps/api/src/routes/`
- Creating or modifying middleware in `Code/apps/api/src/middleware/`
- Adding services in `Code/apps/api/src/services/`
- Implementing rate limiting for new endpoints
- Working with auth middleware (optional or required)
- Building endpoints that interact with Supabase

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Route path | User provides (e.g., /api/feature) | yes |
| HTTP methods | User specifies (GET, POST, PUT, DELETE) | yes |
| Auth requirement | Required, optional, bot-secret, or agent-bearer | no |

## Workflow

1. **Create the route file**: `Code/apps/api/src/routes/{feature}.ts`
   - Import Express Router: `const router = Router()`
   - Import Supabase clients from `../lib/supabase.ts`:
     - `supabase` -- anon key, respects RLS (for user-scoped queries)
     - `supabaseAdmin` -- service role key, bypasses RLS (backend-only operations)
   - For auth sign-in flows, create a request-scoped client to avoid session contamination:
     `const tempClient = createClient(url, serviceKey)` (isolated, not reused)
   - NEVER expose `supabaseAdmin` or service role key in responses or logs

2. **Apply auth middleware**:
   - Required auth: `router.use(requireAuth)` -- rejects with 401 if no valid token
   - Optional auth: `router.use(optionalAuth)` -- extracts user info if token present
   - Bot-to-API: verify `X-Bot-Secret` header with `timingSafeEqual()` (prevents timing attacks)
   - Agent bearer: custom bearer token auth with scope enforcement (agent-api.ts)
   - Access user via `req as AuthenticatedRequest`:
     - `req.userId`, `req.userEmail`, `req.userRole`, `req.userRoles`
     - `req.rawAuthUserId` (pre-merge redirect ID)
     - `req.accessToken` (raw JWT for forwarding)
   - Merged user resolution: middleware checks `redirect_to_user_id` metadata then wallet_address lookup

3. **Implement input validation**:
   - Use helpers from `../middleware/validation.ts`:
     - `sanitizeString(input, maxLength?)` -- trim, type check, length bounds
     - `sanitizeUUID(input)` -- regex validation for UUID v4
   - Return 400 with descriptive error for invalid input
   - Use early returns for all validation checks
   - `ANNOUNCEMENT_BODY_MAX_LENGTH = 1800` for text limits

4. **Add rate limiting** (create a limiter if endpoint is public-facing):
   - Import `rateLimit` from `express-rate-limit`
   - Use `req.socket?.remoteAddress` for IP (TCP layer, spoof-proof; NOT req.ip)
   - Follow existing tier patterns:
     - Auth endpoints: 120 req/15min (separate buckets per auth type)
     - Profile: 240 req/15min
     - Write operations: 80 req/15min
     - Read-heavy: 800 req/15min
     - Global: 1200 req/15min (4x comfort, headroom for soft warnings)
   - Soft warning at 25% remaining: set `X-RateLimit-Warn` header
   - CORS preflight cache: 86400s (24h) to reduce OPTIONS overhead

5. **CORS hardening**:
   - Use strict allowlist for `Access-Control-Allow-Origin` (existing pattern)
   - NEVER use `*` or blindly reflect the request `Origin` header
   - In production, consider rejecting or logging requests with no `Origin` header
     (currently allowed for mobile apps/curl -- tighten if not needed)
   - Remember: CORS is NOT CSRF protection. CORS only controls browser cross-origin
     requests; it does not prevent server-to-server or non-browser attacks.

6. **Configure security headers (Helmet + CSP)**:
   - Helmet is already applied globally for basic security headers
   - CSP should be strict: use nonce- or hash-based directives for script/style sources
   - When configuring CSP in Helmet, explicitly set directives for your app's needs:
     - `defaultSrc: ["'none'"]`
     - `scriptSrc: ["'self'"]` (add nonces if inline scripts needed)
     - `styleSrc: ["'self'", "'unsafe-inline'"]` (TailwindCSS may need unsafe-inline)
     - `imgSrc: ["'self'", "data:", "https:"]`
     - `connectSrc: ["'self'", FRONTEND_URL, SUPABASE_URL]`
     - `frameAncestors: ["'none'"]`
   - Do NOT assume Helmet defaults match your app -- configure explicitly
   - On the frontend (React): NEVER use `dangerouslySetInnerHTML` with untrusted content

7. **Log injection prevention**:
   - Strip CR (`\r`) and LF (`\n`) from any user-supplied data before logging
   - Never log Authorization headers, tokens, passwords, or API keys
   - Use `morgan('short')` or a custom format in production (not `'dev'`)
   - Log security-relevant events (auth failures, rate limits, validation failures)
     with sanitized context (IP, endpoint, error type -- not tokens or payloads)

8. **Handle errors**:
   - Use custom error classes from `../middleware/error-handler.ts`:
     - `ValidationError(message)` -- 400
     - `UnauthorizedError(message)` -- 401
     - `ApplicationError(message, statusCode, code)` -- custom
   - Wrap handlers in try/catch; throw custom errors for known cases
   - Unknown errors caught by global error handler middleware
   - Response format: `{ error: "CODE", message: "text", statusCode: N }`

9. **Register the route**:
   - Import router in `Code/apps/api/src/index.ts`
   - Mount: `app.use('/api/{feature}', featureRoutes)`
   - Place after middleware stack (Helmet, CORS, rate limiters), before error handler
   - Note: `trust proxy` enabled in production (NODE_ENV=production) for Railway reverse proxy

10. **Identity patterns for created_by**:
   - Server-verified: `req.userEmail || req.userId || req.body.created_by`
   - Account types: UUID (google), email, traveler_name, wallet_address
   - Use `buildCreatorNameMap()` pattern for display name resolution

11. **Dynamic captcha activation** (for guest-facing endpoints):
   - SignupRateTracker: sliding-window, 10 signups/min threshold triggers 1-hour lockdown
   - `GET /api/auth/captcha-required` returns current state (deduplicated by frontend)
   - When active, verify Cloudflare Turnstile token on guest signup

12. **WebSocket security** (when real-time features are added):
   - Validate `Origin` header during WebSocket handshake (prevent CSWSH attacks)
   - Authenticate during handshake (verify JWT before upgrading connection)
   - Authorize per message type (not just at connection time)
   - Use `wss://` (TLS) for all socket traffic with sensitive data
   - Enforce message size limits (64KB recommended max)
   - Rate limit messages per connection (prevent flooding/DoS)
   - Implement connection limits per user and globally
   - Add heartbeat/ping-pong to detect stale connections
   - Never use `eval()` on message content -- use `JSON.parse()` only
   - Log security events (connect, disconnect, auth failures) without tokens
   - Rotate tokens for long-lived connections to limit hijack window

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Route file | .ts | `Code/apps/api/src/routes/{feature}.ts` |
| Route registration | Modified | `Code/apps/api/src/index.ts` |
| Test file | .ts | `Code/apps/api/src/__tests__/{feature}.test.ts` |

## Constraints

- NEVER expose `supabaseAdmin` or service role key in responses or logs
- MUST validate and sanitize all input at the API boundary
- MUST use async/await (no raw promise chains)
- MUST use try/catch with custom error classes
- MUST use `timingSafeEqual` for secret header comparisons (not `===`)
- NEVER log secrets, tokens, or sensitive user data in production
- NEVER use `dangerouslySetInnerHTML` with untrusted content (frontend)
- NEVER use `eval()` to process request/message content
- Rate limiting required for all public-facing endpoints
- Use `req.socket?.remoteAddress` for rate limit key (not X-Forwarded-For)
- Strip CR/LF from user input before logging (log injection prevention)
- CORS must use strict allowlist (never `*` or reflected Origin)
- Object-level authorization required on every endpoint accepting object IDs

## Self-Validation

### Trigger Indicators
- [ ] User asked to create/modify an API route or endpoint
- [ ] Task involves files in `Code/apps/api/src/routes/`
- [ ] User mentioned rate limiting, auth middleware, or validation

### Completion Markers
- [ ] Route file created with input validation
- [ ] Auth middleware applied (required, optional, bot-secret, or agent-bearer)
- [ ] Route registered in index.ts
- [ ] Error handling with try/catch and custom error classes

### Quality Signals
- [ ] No secrets exposed in responses or logs
- [ ] All inputs validated and sanitized
- [ ] timingSafeEqual used for secret comparisons
- [ ] Rate limiting applied with soft warning headers

### Lint Checks
- [ ] TypeScript compiles without errors
- [ ] No non-ASCII characters in source files
- [ ] Route follows kebab-case file naming
