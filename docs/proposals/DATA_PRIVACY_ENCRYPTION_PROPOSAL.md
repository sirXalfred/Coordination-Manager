# Proposal: User Data Privacy + At-Rest Encryption

**Status:** Draft -- pending community / sponsor feedback
**Author:** Tevo
**Target app:** Coordination Manager (patterns reusable across the portfolio)
**Implementation model:** Agentic coding (Claude / Copilot agents), human review + DevOps only

---

## 1. Motivation

Today, almost everything a user types into Coordination Manager is stored as
**readable plaintext** in the PostgreSQL database. Data is encrypted in transit
(HTTPS) and access is constrained at the application layer by Row Level Security
(RLS), but at rest the operator -- anyone with Supabase service-role access, a
database backup, or a read replica -- can read it directly. This includes:

- Calendar titles, descriptions, and configuration
- Availability time slots and participant usernames
- Meeting titles, descriptions, links, and times
- User profile fields (display names, emails, timezone, preferences)
- Event titles, descriptions, locations
- Feedback messages and announcement bodies

The only content we genuinely **cannot** read is the managed-wallet private key
(client-side encrypted with a device-local key). SMTP passwords are encrypted at
rest with a server-held key, so the operator can still decrypt those.

This is normal for most SaaS products, but "we cannot read your private
scheduling data" is a meaningful **trust and privacy selling point** -- especially
for a coordination tool used by communities, DAOs, and Cardano-aligned users who
value self-sovereignty. This proposal lays out the infrastructure options to get
there, the **maintenance cost** we would start paying, and -- importantly -- the
**user-experience / performance trade-offs** of encrypting many data points at
once.

## 2. Constraints

- **Budget:** Keep new fixed monthly cost low (target under ~$30-50/mo for the
  baseline tier). Heavy implementation delegated to coding agents; human role is
  review, integration testing, and DevOps.
- **Stack fit:** Must work with React 18 + Vite + Tailwind frontend, Node/Express
  backend, Supabase (Postgres + Storage + Auth, RLS).
- **No regressions to UX we cannot justify:** Scheduling needs to stay fast.
  Several pages render many records at once (calendar grids, availability
  overlays, event lists), so decryption cost is a first-class concern.
- **Recoverability:** Whatever we choose, we must not create a model where a
  single lost key silently destroys user data without a clearly communicated
  trade-off.

## 3. The Core Trade-off

There is a fundamental tension:

- **The more we encrypt so the operator cannot read it, the less the server can
  do with the data** -- no server-side search, no overlap computation on
  ciphertext, no server-rendered notifications containing content, and slower
  reads because every field must be decrypted before use.
- **The less we encrypt, the faster and more featureful the product stays** --
  but the operator retains read access.

So this is not one decision; it is a **spectrum**. The three realistic tiers are
below, from least to most protective.

### Tier 1 -- Operator-held column encryption (envelope encryption)

Encrypt sensitive columns at the application layer (Express) before writing to
Postgres, using a data key that is itself wrapped by a master key held in a Key
Management Service (KMS). The server still decrypts on read, so **features and
performance are mostly preserved**, and the protection is against:

- Leaked database dumps / stolen backups
- A compromised read replica
- Casual operator browsing (decryption is explicit and auditable)

It does **not** protect against a fully compromised live API server (it has the
keys) and does **not** make us "blind" to content.

**New components:** a KMS (managed) + a thin encryption helper in `apps/api`.

### Tier 2 -- Database-native encryption (pgcrypto)

Use PostgreSQL `pgcrypto` (`pgp_sym_encrypt` / `pgp_sym_decrypt`) on selected
columns, with the key supplied per-session by the API. Similar protection profile
to Tier 1 but the crypto runs inside Postgres. Simpler to adopt, but the key
still transits to the database session and **breaks indexing / sorting / search**
on the encrypted columns.

**New components:** none beyond key handling; uses an existing Postgres extension.

### Tier 3 -- End-to-end encryption (client-side, zero-knowledge)

The browser encrypts content with a key the server never sees (the model already
used for the managed wallet). The operator genuinely **cannot** read the content.
This is the strongest privacy story and the biggest UX/engineering cost:

- No server-side search, overlap detection, or content in emails/notifications
- Key sharing between participants must happen out-of-band (not in the URL)
- Lost key = unrecoverable data (must be communicated honestly)
- Multi-device and guest/traveler flows get materially harder

**New components:** client key-management UI, key-exchange/sharing service, key
recovery/backup flow, re-encryption tooling for membership changes.


## 4. New Components and Maintenance Cost

These are the components we would start paying to run and maintain if we
implement the encryption tiers. Estimates are monthly and order-of-magnitude.

| Component | Purpose | Tier | Est. monthly cost | Maintenance burden |
|-----------|---------|------|-------------------|--------------------|
| Managed KMS (AWS KMS / GCP KMS) | Wrap/unwrap data keys; central master key | 1, 3 | ~$1 per key + ~$0.03 / 10k requests -> ~$5-25/mo with data-key caching | Low -- rotation policy + alerts |
| Self-hosted Vault (alternative) | Secrets + transit encryption if we avoid cloud KMS | 1, 3 | ~$10-20/mo VPS | Medium -- patching, backups, unseal keys |
| Key-management microservice | Issue/rotate per-calendar data keys, audit access | 3 | shares existing API host or ~$10/mo small dyno | Medium -- security-critical code path |
| Encrypted backups / PITR upgrade | Ensure backups are not the weak link | all | Supabase plan upgrade, ~$0-25/mo | Low |
| Key-exchange / sharing service | Distribute per-calendar keys to invited participants | 3 | shares API host | High -- correctness + security critical |
| Monitoring + audit log sink | Track every decrypt + key use | all | ~$0-10/mo (log tier) | Low-Medium |
| Re-encryption / key-rotation jobs | Re-wrap data on rotation or membership change | 1, 3 | compute only | Medium -- must be idempotent + safe |

**Indicative totals:**

- **Tier 1 baseline:** roughly **$10-50 / mo** fixed, plus modest agent dev cost
  (a few hundred USD of tokens) and ~1 week of human review/DevOps.
- **Tier 3 (E2EE opt-in):** the same KMS cost plus materially more **engineering
  maintenance** (key sharing, recovery, multi-device, re-encryption), which is
  the real cost -- ongoing security ownership, not the hosting bill.

There is also a **hidden operational cost**: encryption makes incident response,
debugging, and support harder. We can no longer "just look" at a row to help a
user; we need tooling and an audited break-glass path.

## 5. Performance and UX Concern (important)

This is the trade-off we want sponsors and users to understand clearly.

Coordination Manager frequently loads **many data points at once**:

- A calendar grid can render hundreds of availability cells and slots.
- Network / events views list many meetings and events together.
- Overlap detection compares everyone's availability simultaneously.

If those fields are encrypted, **every one of them must be decrypted before it
can be displayed or compared**. The effects to expect:

- **Slower page loads on data-heavy views.** Decrypting hundreds or thousands of
  fields per request adds latency. Some pages may take noticeably longer before
  the information becomes available, particularly large shared calendars.
- **Loss of database-side work.** Encrypted columns cannot be indexed, sorted, or
  searched by Postgres, so filtering/searching has to move into application code
  after decryption -- which is slower and uses more memory.
- **Batch decryption pressure.** To keep KMS cost and latency sane we must use
  **envelope encryption with cached data keys** (decrypt the data key once, then
  decrypt many fields locally) rather than calling the KMS per field. Without
  caching, both cost and latency explode.
- **E2EE makes it worse.** Under Tier 3 the decryption happens in the user's
  browser, so a low-powered device opening a large calendar could feel sluggish,
  and overlap computation cannot be precomputed server-side at all.

**Mitigations we would build in:**

- Envelope encryption + in-process data-key cache (avoid per-field KMS calls).
- Decrypt lazily / on demand (only the visible window of a calendar, paginate).
- Keep non-sensitive fields (timestamps, IDs, status flags) in plaintext so
  sorting, indexing, and pagination still work at the database level.
- Cache decrypted views per request and stream results progressively so the page
  fills in instead of blocking on the full set.
- Scope encryption to genuinely sensitive fields rather than encrypting
  everything by default.

Even with these, sponsors should expect that **the most private configuration is
also the slowest**, and that some content-heavy pages will trade a little speed
for privacy.

## 6. Security and Privacy Notes

- Master key lives only in the KMS / Vault, never in application source or
  frontend bundles (`VITE_` vars are public by definition).
- Data keys are per-scope (e.g. per calendar) and wrapped by the master key, so
  rotation re-wraps keys without re-encrypting all data.
- Every decrypt is logged with sanitized context for audit (no plaintext, no
  keys in logs).
- Tier 3 sharing keys are exchanged out-of-band, never embedded in the nanoid
  calendar URL (the URL hash is obfuscation, not a key).
- Honest recovery story: for E2EE we must state plainly that lost keys mean lost
  data, and offer an optional user-managed key backup.


## 7. Open Questions for Community / Sponsors

1. Is "the operator cannot read your data" worth a slower experience on large
   calendars? If so, default-on or opt-in per calendar?
2. Managed cloud KMS (simplest, ~$5-25/mo) vs. self-hosted Vault (more control,
   more maintenance)?
3. Which fields are sensitive enough to encrypt first (feedback, emails, meeting
   descriptions) and which should stay plaintext for speed?
4. For the E2EE tier, do we accept "lost key = lost data", and do we offer a
   user-managed key backup?
5. Is this a free baseline (Tier 1 for everyone) with a premium private tier
   (Tier 3), or one model for all?

### References

- AWS KMS pricing + envelope encryption: https://aws.amazon.com/kms/pricing/
- GCP Cloud KMS: https://cloud.google.com/kms/docs/envelope-encryption
- PostgreSQL pgcrypto: https://www.postgresql.org/docs/current/pgcrypto.html
- Supabase encryption / Vault: https://supabase.com/docs/guides/database/vault
- Web Crypto API (basis for our managed-wallet + future E2EE): https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
