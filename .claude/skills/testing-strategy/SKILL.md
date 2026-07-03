---
name: testing-strategy
description: Write tests with Vitest, React Testing Library, and Supertest for all apps
---

# testing-strategy

## Purpose

Guides test creation across the Coordination Manager monorepo. Covers Vitest configuration, API integration tests with Supertest, frontend component tests with React Testing Library, and the project's established test file organization.

## When to Use

- Writing tests for new or existing API endpoints
- Creating component tests for React frontend
- Adding integration or end-to-end test scenarios
- Modifying test configuration (vitest.config.ts)
- Running tests or checking coverage

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Feature to test | User specifies the module or endpoint | yes |
| Test type | Unit, integration, or e2e | no |

## Workflow

1. **API tests** -- three layers of test directories:

   **a) Route unit tests** (`Code/apps/api/src/routes/__tests__/`):
   - Framework: Vitest + Supertest with mocked Supabase
   - Test files (12 suites):
     - `auth.test.ts` -- POST /guest, GET /me, PUT /profile, POST /logout
     - `calendars.test.ts` -- POST /, GET /:hash
     - `availability.test.ts` -- POST add/remove, GET /:hash, DELETE
     - `meetings.test.ts` -- POST, GET /single/:id, GET /:hash, PUT, DELETE
     - `discord.test.ts` -- GET /integration, POST /generate-key, DELETE /integration, GET /guilds
     - `connections.test.ts` -- POST /invites, POST /invites/accept, GET /, DELETE
     - `admin.test.ts` -- GET /users, POST /users/silence, POST /users/unsilence, POST /users/moderator
     - `feedback.test.ts` -- POST, GET, PATCH /:id
     - `email-contacts.test.ts` -- GET, POST
     - `wallet-auth.test.ts` -- POST /nonce, POST /verify, session handling
     - `calendar-sources.test.ts` -- GET, POST, DELETE, Google OAuth callback, busy times
     - `guardian.test.ts` -- /access, rule-groups CRUD, rules CRUD + bulk, notification-channels validation, timeseries bucketing, reconcile-state, bot-invite, message-history, server roles/channels

   **b) Middleware and service unit tests**:
   - Middleware (`Code/apps/api/src/middleware/__tests__/`):
     - `auth.test.ts` -- authMiddleware, optionalAuthMiddleware, requireAdmin
     - `validation.test.ts` -- sanitizeString, sanitizeUUID, safeErrorMessage
     - `error-handler.test.ts` -- error handler middleware
   - Services (`Code/apps/api/src/services/__tests__/`):
     - `signup-rate-tracker.test.ts` -- rate tracking, captcha status
     - `email.test.ts` -- SMTP email sending
     - `captcha.test.ts` -- Turnstile captcha verification
     - `account-merge.test.ts` -- createMergeToken, mergeAccounts
   - General (`Code/apps/api/src/__tests__/`):
     - `timezone-handling.test.ts` -- timezone parsing and conversion

   **c) Live server tests** (`Code/apps/api/src/__tests__/public-server/`):
   - Run against the deployed production API (https://api.coordinationmanager.com)
   - Separate vitest config: `vitest.public.config.ts` (20s timeout, TEST_SERVER_URL env)
   - Test files (5 suites):
     - `server-health.test.ts` -- health check endpoint
     - `auth-flow-live.test.ts` -- OAuth, traveler, wallet auth flows
     - `wallet-auth-live.test.ts` -- CIP-30 signing end-to-end
     - `public-data-live.test.ts` -- public calendar/meeting reads
     - `integrations-live.test.ts` -- Discord, calendar integrations
   - Commands: `pnpm test:public` or `pnpm test:server`

   **d) Discord bot tests** (`Code/apps/discord-bot/src/__tests__/`):
   - `dm-flow.test.ts` -- DM flow state machine

   **Commands**:
   - All unit tests: `cd Code/apps/api && npx vitest run`
   - API only (pnpm): `cd Code && pnpm test:api`
   - Live server tests: `cd Code/apps/api && pnpm test:public`
   - Coverage: `cd Code/apps/api && pnpm test:coverage`

2. **Create an API route test**:
   - Create file: `Code/apps/api/src/routes/__tests__/{feature}.test.ts`
   - Import Supertest and create test app instance
   - Test patterns:
     - Happy path: valid input returns expected response
     - Validation: invalid input returns 400 with error message
     - Auth: unauthorized request returns 401
     - Rate limiting: verify limit headers present
   - Use `describe` blocks for route groups, `it` for individual tests
   - Clean up test data after each test

3. **Supabase chain mocking pattern** (CRITICAL -- follow exactly):
   ```ts
   const mockFrom = vi.fn()
   const mockSelect = vi.fn()
   const mockInsert = vi.fn()
   const mockEq = vi.fn()
   const mockSingle = vi.fn()
   // ... other chain methods

   // CORRECT: Return bare mock references -- do NOT call .mockReturnThis() here
   function createChain() {
     return {
       select: mockSelect,
       insert: mockInsert,
       eq: mockEq,
       single: mockSingle,
     }
   }

   vi.mock('../../supabaseClient.js', () => ({
     supabaseAdmin: {
       from: (...args: unknown[]) => { mockFrom(...args); return createChain() },
     },
   }))

   beforeEach(async () => {
     vi.clearAllMocks()
     // Set chain behavior AFTER clearing -- this is where .mockReturnThis() goes
     mockSelect.mockReturnThis()
     mockEq.mockReturnThis()
     mockInsert.mockReturnThis()
     await createApp()
   })
   ```

   **Common mistakes to avoid**:
   - **NEVER** call `.mockReturnThis()` inside `createChain()` -- it gets re-invoked on every `from()` call and overwrites queued `mockResolvedValueOnce` values
   - **NEVER** use `vi.restoreAllMocks()` in afterEach -- it strips `vi.mock()` factory implementations. Use `vi.clearAllMocks()` instead
   - **NEVER** set `mockEq.mockResolvedValueOnce()` for a mid-chain `.eq()` call -- it changes the return from chain to promise, breaking subsequent chain methods. Only mock terminal methods (`.single()`, `.maybeSingle()`, `.order()` when terminal)
   - For chains ending in `.eq()` (e.g. `.update().eq().eq()`), the awaited chain object has no `.error` property (undefined = falsy = success). To simulate errors, use `mockImplementation` with a call counter
   - For `.in().then()` patterns (like `buildCreatorNameMap`), add a `then` property to the chain: `then: (resolve) => resolve({ data: [], error: null })`
   - For chains ending in `.gte().lte()` (e.g. timeseries queries), mock the terminal `.lte()` with `mockResolvedValueOnce` once per query in call order

4. **Test isolation and mocking techniques**:
   - Dynamic module import: `const { service } = await import('./module')` to ensure env vars load before init
   - `vi.stubEnv('VAR_NAME', 'value')` -- set env vars for conditional logic testing
   - `vi.stubGlobal('fetch', mockFn)` -- mock global fetch for HTTP calls
   - Chain-based mock builders for Supabase fluent API: mock `select()` -> `eq()` -> `maybeSingle()`
   - Create fresh app instance per test suite for complete isolation
   - `it.skipIf(!CREDS_AVAILABLE)('test name', ...)` -- conditionally skip tests needing real credentials
   - **Env-var-gated handlers** (e.g. routes that early-return 500 if `GUARDIAN_BOT_TOKEN` is missing): set the env var inside the test with try/finally restore. Do NOT rely on global setup -- other tests may delete it.
   - **Role-based guards**: when route uses `hasRole(req, 'moderator')`, mock `hasRole` in the auth-mock factory as `(req, role) => req.userRoles?.includes(role) ?? false` and toggle a `let mockUserRoles` between tests

4. **Frontend tests** (`Code/apps/web/`):
   - Framework: Vitest + React Testing Library   - Existing test suites (`Code/apps/web/src/lib/__tests__/`):
     - `calendar-utils.test.ts` -- calendar utility functions
     - `calendar-overlap-layout.test.ts` -- overlap layout algorithm
     - `timezone-data.test.ts` -- timezone data handling   - Create test files next to components: `{component}.test.tsx` or in `__tests__/`
   - Commands: `pnpm test:web`, `pnpm test:coverage`

5. **Create a frontend test**:
   - Import from `@testing-library/react`: `render`, `screen`, `fireEvent`, `waitFor`
   - Mock contexts (AuthContext, ThemeContext) with test providers
   - Mock API calls with `vi.mock()` for the api-client
   - Test patterns:
     - Renders without crashing
     - Displays expected content
     - Handles user interactions (click, type, submit)
     - Shows loading and error states
     - Auth-gated content hidden for unauthenticated users
     - LearnerHelpIcon visible when learnerMode on or unauthenticated

6. **Test organization conventions**:
   - API route tests: `Code/apps/api/src/routes/__tests__/{route}.test.ts`
   - API middleware tests: `Code/apps/api/src/middleware/__tests__/{middleware}.test.ts`
   - API service tests: `Code/apps/api/src/services/__tests__/{service}.test.ts`
   - API general tests: `Code/apps/api/src/__tests__/{feature}.test.ts`
   - Live server tests: `Code/apps/api/src/__tests__/public-server/{suite}-live.test.ts`
   - Frontend tests: alongside components or in `__tests__/` subdirectories
   - Discord bot tests: `Code/apps/discord-bot/src/__tests__/{feature}.test.ts`
   - Use descriptive test names: `it('returns 400 when title is missing')`
   - Group related tests with `describe`
   - Use `beforeAll`/`afterAll` for setup/teardown

8. **Run tests**:
   - All API unit tests: `cd Code/apps/api && npx vitest run`
   - API via pnpm: `cd Code && pnpm test:api`
   - Frontend only: `cd Code && pnpm test:web`
   - Live server tests: `cd Code/apps/api && pnpm test:public`
   - Live server (alt): `cd Code/apps/api && pnpm test:server`
   - Coverage: `cd Code/apps/api && pnpm test:coverage`
   - All tests: `cd Code && pnpm test`

   **Test counts (as of May 2026)**:
   - API tests: 400 tests across 26 files (includes guardian + live server suites)
   - Live server tests: 5 suites (run against production)
   - Frontend tests: 3 suites in `lib/__tests__/`

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| API test files | .test.ts | `Code/apps/api/src/__tests__/` |
| Frontend test files | .test.tsx | `Code/apps/web/src/` (alongside components) |
| Coverage reports | Generated | Console output or HTML report |

## Constraints

- MUST use Vitest (not Jest) -- already configured for the project
- MUST use Supertest for API HTTP assertions
- MUST use React Testing Library (not Enzyme) for frontend tests
- Tests should be deterministic -- mock external services
- Clean up test data in afterAll/afterEach hooks
- Do not test Supabase RLS directly -- that is database-level
- Use `it.skipIf()` for tests requiring real credentials (not `it.skip()`)

## Self-Validation

### Trigger Indicators
- [ ] User asked to write tests or check test coverage
- [ ] Feature added without corresponding tests
- [ ] Test failures need investigation

### Completion Markers
- [ ] Test file created with describe/it blocks
- [ ] Tests pass when run with pnpm test
- [ ] Both happy path and error cases covered
- [ ] Test data cleaned up after execution

### Quality Signals
- [ ] Descriptive test names explain the scenario
- [ ] External services mocked (vi.stubGlobal, vi.mock)
- [ ] Dynamic import used when testing env-dependent modules
- [ ] Chain-based mocks for Supabase fluent API calls
- [ ] Auth scenarios tested (authenticated, unauthenticated, traveler)

### Lint Checks
- [ ] Test files use .test.ts or .test.tsx extension
- [ ] No hardcoded secrets in test files
- [ ] Test imports resolve correctly
