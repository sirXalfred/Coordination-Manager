# Public Server Tests

These tests make **real HTTP requests** against a deployed server to catch issues
that only appear in production (CORS, rate-limits, Supabase RLS, env configuration, etc.)

## Quick Start

```bash
# Run against localhost (default)
pnpm test:server

# Run against public production server
pnpm test:public

# Run against a custom URL
TEST_SERVER_URL=https://staging.example.com pnpm test:server
```

## Environment Variables

| Variable            | Default                                | Description                          |
| ------------------- | -------------------------------------- | ------------------------------------ |
| `TEST_SERVER_URL`   | `http://localhost:3001`                | Server to test against               |
| `TEST_TIMEOUT`      | `15000`                                | Request timeout (ms), higher for public |
| `TEST_AUTH_TOKEN`    | _(none)_                              | Optional Supabase JWT for auth tests |

## What's Tested

| Suite                        | Auth Required | Description                                          |
| ---------------------------- | ------------- | ---------------------------------------------------- |
| `server-health.test.ts`      | No            | Server reachable, CORS, response format               |
| `wallet-auth-live.test.ts`   | No            | Challenge flow, supported wallets, address validation  |
| `auth-flow-live.test.ts`     | No/Guest      | Guest account creation, profile, session lifecycle     |
| `integrations-live.test.ts`  | Guest         | Calendar, Discord, Luma integration endpoints          |
| `public-data-live.test.ts`   | No            | Public events, governance, unauthenticated access      |

## Design Principles

- Tests are **non-destructive** -- they only read data or create temporary guest accounts
- Guest accounts created during tests are cleaned up (deleted) in `afterAll`
- No tests modify production user data or delete real resources
- Tests that need auth create a guest traveler session automatically
- All requests are rate-limit-aware with conservative timing

## Running Authenticated Tests Against Production

The production server has Cloudflare Turnstile captcha enabled, which blocks
automated guest account creation. Tests that need authentication will
**gracefully skip** unless you provide a real token.

To get full coverage against production:

1. Log into Coordination Manager in your browser
2. Open DevTools > Application > Local Storage > find `sb-*-auth-token`
3. Copy the `access_token` value
4. Run: `$env:TEST_AUTH_TOKEN="eyJhb..."; pnpm test:public`

This avoids captcha entirely by reusing your existing session.
