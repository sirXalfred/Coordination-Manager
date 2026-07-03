---
name: authentication-system
description: Implement Google OAuth, Cardano wallet CIP-30, and traveler guest auth flows
---

# authentication-system

## Purpose

Guides development and modification of the three authentication flows: Google OAuth, Cardano CIP-30 wallet signing, and traveler (guest) accounts. Covers both frontend auth contexts and backend auth middleware, plus account merging logic.

## When to Use

- Modifying login flows (Google, Cardano wallet, traveler/guest)
- Working with auth middleware (required or optional)
- Implementing account merge or linking features
- Adding wallet support for new Cardano wallets
- Modifying traveler account expiry or captcha logic
- Working with the AuthContext or ProtectedRoute component
- Debugging session persistence or token refresh issues

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Auth flow type | google, cardano, traveler, or merge | yes |
| Feature description | What needs to change in the auth system | yes |

## Workflow

1. **Google OAuth flow (with PKCE)**:
   - Frontend: `supabase.auth.signInWithOAuth({ provider: 'google' })`
   - Supabase SDK handles PKCE (Proof Key for Code Exchange) automatically --
     no explicit configuration needed. PKCE is baseline for OAuth 2.1.
   - Redirects to Google, returns to `/auth/callback`
   - **Strict redirect URI matching**: The redirect URI configured in Google Cloud Console
     must exactly match what the app sends. No wildcard or partial matching.
     OAuth 2.1 requires exact redirect URI matching as a security mitigation.
   - AuthCallbackPage handles the return and loads user profile
   - Backend: profile created/updated in `users` table on first login
   - `account_type = 'google'`, `google_id` stored for identity
   - Avoid deprecated flows: never use Implicit grant or Resource Owner Password Credentials

2. **Cardano wallet flow (CIP-30)**:
   - Frontend: detect wallets via `window.cardano` (Lace, Eternl, Typhon, Yoroi)
   - `connectWallet(walletId)` -> `getWalletAddress()` -> get cardano address
   - Backend challenge: `POST /api/auth/wallet/request-challenge` returns nonce
   - Frontend: `wallet.signData(buildSignMessage(nonce))` -- user confirms in wallet UI
   - Signing message MUST be under 80 chars to prevent Lace UI breakage:
     `"Coordination Manager Login\nNonce: ${nonce}"`
   - Backend verify: `POST /api/auth/wallet/verify-signature`
   - Credential derivation: HMAC-SHA256 from wallet address + JWT_SECRET
   - Creates deterministic email/password for Supabase auth user
   - Uses request-scoped Supabase client for sign-in (avoids session contamination)
   - `account_type = 'cardano'`, `wallet_address` stored
   - **Security model**: CIP-30 injects wallet objects into the page (browser is
     adversarial). Backend MUST NOT treat "address shown in UI" as authenticated --
     always require cryptographic proof via challenge-response.
   - **Log wallet-linking events** as security-relevant: connect, disconnect,
     account changes, signature failures. Do NOT log sensitive payloads or keys.

3. **Traveler (guest) flow with dynamic captcha**:
   - Frontend: `POST /api/auth/guest { captchaToken }`
   - Dynamic captcha: `SignupRateTracker` monitors signup velocity (sliding window)
     - Threshold: 10 signups/min triggers 1-hour lockdown with captcha required
     - Frontend checks `GET /api/auth/captcha-required` (deduplicated via `useCaptchaMode()`)
   - Captcha: Cloudflare Turnstile verification (activated dynamically)
   - Backend generates: UUID-based temp email + password
   - Random name: `{Adjective} {Noun} {0-99}` (20 adjectives x 20 nouns)
   - Creates Supabase auth user + profile with `account_type = 'traveler'`
   - `expires_at = NOW() + 64 days` (auto-cleanup by cron)
   - Returns `{ session, user }` with full JWT

4. **AuthContext (frontend)**:
   - Interface: `user, session, isLoading, isAuthenticated, isTraveler, isCardano`
   - Methods: `login(), loginAsTraveler(), loginWithCardano(), logout(), updateProfile(), refreshProfile()`
   - Safety timeout: `isLoading` never exceeds 5 seconds
   - Guards: `initializedRef` prevents duplicate loads; `walletLoginInProgressRef` suppresses `onAuthStateChange` during wallet flow
   - Logout: calls `/api/auth/logout`, then `supabase.auth.signOut()`, clears sessionStorage

5. **Auth middleware (backend)**:
   - `requireAuth`: rejects with 401 if no valid JWT
   - `optionalAuth`: extracts user info if token present, continues if absent
   - `AuthenticatedRequest` extends Express Request with:
     `userId, userEmail, userRole, userRoles, rawAuthUserId, accessToken`
   - `userRoles`: parsed from JSONB `roles` column, defaults to `['user']`
   - Merged user resolution: checks `redirect_to_user_id` metadata then wallet_address lookup
   - Transparently redirects to surviving account when profile row deleted after merge

   **JWT claims and authorization data**:
   - Supabase JWTs carry claims that RLS policies evaluate
   - **NEVER use `raw_user_meta_data` for authorization** -- end users can modify it
     via `supabase.auth.updateUser()`. Store authorization data (roles, permissions)
     in `raw_app_meta_data` which requires service role key to modify.
   - **JWT freshness**: After changing a user's roles/permissions, the JWT won't
     reflect changes until refreshed. Force `supabase.auth.refreshSession()` after
     role changes; don't rely on stale tokens for authorization decisions.
   - Access tokens are short-lived; refresh tokens handle session continuity.

   **Session security** (stateless JWT model):
   - Auth uses JWT Bearer tokens (no session cookies, so no CSRF risk from cookies)
   - Tokens stored in sessionStorage (not localStorage) to limit persistence
   - If cookies are ever added: set `Secure`, `HttpOnly`, `SameSite=Lax` minimum
   - `SameSite` provides some CSRF mitigation but is NOT a complete solution --
     add CSRF tokens for state-changing requests if cookie-based sessions are adopted

6. **Account merge**:
   - `createMergeToken(sourceUserId, sourceAccountType)` -- in-memory, 10-min TTL
   - `mergeAccounts(source, target, keepSettings)`:
     - Transfers: calendars, meetings, templates, schedules, feedback
     - Merges identity fields: wallet_address, google_id, email
     - Optionally copies settings (timezone, theme, display name)
     - Deletes source `users` row (auth.users kept for wallet lookup)
   - Auto-cleanup of expired merge tokens every 60 seconds

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Auth routes | .ts | `Code/apps/api/src/routes/auth.ts`, `wallet-auth.ts` |
| Auth middleware | .ts | `Code/apps/api/src/middleware/auth.ts` |
| Auth service | .ts | `Code/apps/web/src/lib/auth-service.ts` |
| Auth context | .tsx | `Code/apps/web/src/contexts/AuthContext.tsx` |
| Wallet utils | .ts | `Code/apps/web/src/lib/cardano-wallet.ts` |
| Signup rate tracker | .ts | `Code/apps/api/src/services/signup-rate-tracker.ts` |

## GameChanger Wallet (no browser extension required)

CIP-30 flows (Eternl, Lace, Typhon, Yoroi) require a browser extension. For
users without any extension installed, GameChanger Wallet offers an alternative:

- No browser extension required -- works via URL redirect
- User is redirected to `wallet.gamechanger.finance`, creates/imports a wallet
  there, approves the dapp connection, and is redirected back
- The returned payload contains the wallet address; use the same
  challenge-response verification as the CIP-30 flow on the backend
- See **gamechanger-environment** skill for encoding and decoding GC URLs
- See **gamechanger-scripting** skill for writing the sign-in GCScript
- The UI flow: detect no `window.cardano` wallets -> show "this might be the
  Game Changer" message -> "Create Wallet" button opens GC URL in new tab

## Constraints

- NEVER store raw passwords or wallet private keys
- NEVER expose JWT_SECRET or SUPABASE_SERVICE_ROLE_KEY
- NEVER store authorization data in `raw_user_meta_data` (user-writable)
- USE `raw_app_meta_data` for roles/permissions (requires service role to modify)
- Wallet credentials derived via HMAC-SHA256 (deterministic, not stored)
- Wallet signing message MUST be under 80 characters (Lace wallet limit)
- Captcha tokens are single-use; re-verify on each guest signup
- Traveler accounts MUST have `expires_at` set (64-day TTL)
- Suppress `onAuthStateChange` during wallet login (local signOut + signIn sequence)
- Merge tokens are in-memory only (not persisted to DB)
- Use request-scoped Supabase client for auth sign-in operations
- OAuth redirect URIs MUST use exact matching (no wildcards)
- Log wallet-linking events (connect/disconnect/failures) without sensitive data
- Force token refresh after role/permission changes

## Self-Validation

### Trigger Indicators
- [ ] User asked about login, auth, wallet, or traveler features
- [ ] Task involves auth middleware, JWT tokens, or session handling
- [ ] User mentioned account merge, captcha, or linking

### Completion Markers
- [ ] Auth flow creates valid Supabase session
- [ ] Auth middleware correctly identifies user from JWT
- [ ] Wallet login includes challenge-response verification
- [ ] Traveler accounts have expiry set

### Quality Signals
- [ ] No secrets exposed in frontend code or API responses
- [ ] Wallet credential derivation uses HMAC-SHA256
- [ ] AuthContext guards prevent duplicate initialization
- [ ] Dynamic captcha activates on signup spike (not always-on)
- [ ] Request-scoped Supabase client used for sign-in flows

### Lint Checks
- [ ] No hardcoded secrets in source files
- [ ] All auth endpoints have rate limiting (separate buckets per auth type)
- [ ] Captcha verification present for guest signup
