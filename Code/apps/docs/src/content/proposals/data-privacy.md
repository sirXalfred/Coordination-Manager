# Proposal: User Data Privacy + At-Rest Encryption

**Status:** Draft -- pending community / sponsor feedback
**Author:** Whitey
**Target app:** Coordination Manager (patterns reusable across the portfolio)
**Implementation model:** Agentic coding (Claude / Copilot agents), human review + DevOps only

---

## 1. Where we are today

Almost everything a user types into Coordination Manager is stored as **readable
plaintext** in our PostgreSQL database. Data is encrypted in transit (HTTPS) and
access is constrained at the application layer by Row Level Security (RLS), but at
rest the operator -- anyone with Supabase service-role access, a database backup,
or a read replica -- can read it. This includes calendar titles, availability,
meeting details, profile fields, events, and feedback.

The only content we genuinely **cannot** read is the managed-wallet private key
(encrypted in the browser with a device-local key). SMTP passwords are encrypted
at rest, but with a server-held key, so the operator can still decrypt those.

This is normal for most products, but "we cannot read your private scheduling
data" is a meaningful **trust and privacy selling point** -- especially for a
self-sovereignty-minded community. This proposal lays out the infrastructure
options, the **maintenance cost** we would start paying, and the
**user-experience / performance trade-offs** of encrypting many data points at
once.

## 2. The core trade-off

There is a fundamental tension:

- The **more** we encrypt so the operator cannot read it, the **less** the server
  can do with the data -- no server-side search, no overlap computation on
  ciphertext, no content in server-sent notifications, and slower reads because
  every field must be decrypted before use.
- The **less** we encrypt, the **faster and more featureful** the product stays,
  but the operator keeps read access.

This is a spectrum, not a single switch.

## 3. Three tiers

### Tier 1 -- Operator-held envelope encryption

Encrypt sensitive columns in the API before writing, using a data key wrapped by a
master key in a Key Management Service (KMS). The server still decrypts on read,
so **features and speed are mostly preserved**. Protects against leaked database
dumps, stolen backups, and a compromised read replica. Does **not** protect
against a fully compromised live API server (it holds the keys).

### Tier 2 -- Database-native (pgcrypto)

Use PostgreSQL `pgcrypto` on selected columns. Similar protection but crypto runs
inside Postgres; simpler to adopt but **breaks indexing, sorting, and search** on
encrypted columns.

### Tier 3 -- End-to-end encryption (zero-knowledge)

The browser encrypts with a key the server never sees (the model already used for
the managed wallet). The operator genuinely **cannot** read the content. Strongest
privacy, biggest cost: no server-side search, keys shared out-of-band, **lost key
= lost data**, and harder multi-device / guest flows.

## 4. Recommended direction

**Adopt Tier 1 as the baseline** on the highest-sensitivity fields first (feedback
bodies, profile email/display name, meeting descriptions/links), and **offer Tier
3 as an opt-in "private calendar" mode** later -- rather than the default. Tier 1
buys most of the real-world protection at low cost and low UX risk; Tier 3 is the
premium "we cannot read it" guarantee for users who accept the trade-offs.

## 5. New components and maintenance cost

These are components we would start paying to run and maintain. Estimates are
monthly and order-of-magnitude.

| Component | Purpose | Tier | Est. monthly cost | Maintenance |
|-----------|---------|------|-------------------|-------------|
| Managed KMS (AWS / GCP) | Wrap/unwrap data keys | 1, 3 | ~$5-25 with data-key caching | Low |
| Self-hosted Vault (alt.) | Secrets + transit encryption | 1, 3 | ~$10-20 VPS | Medium |
| Key-management service | Per-calendar keys, audit | 3 | shares API host | High |
| Encrypted backups / PITR | Backups not the weak link | all | ~$0-25 | Low |
| Monitoring + audit log sink | Track every decrypt | all | ~$0-10 | Low-Med |
| Re-encryption / rotation jobs | Re-wrap on rotation | 1, 3 | compute only | Medium |

**Indicative totals:**

- **Tier 1 baseline:** roughly **$10-50 / mo** fixed, plus modest agent dev cost
  and ~1 week of human review/DevOps.
- **Tier 3 (E2EE opt-in):** the same KMS cost plus materially more **ongoing
  engineering maintenance** (key sharing, recovery, multi-device, re-encryption).
  The real cost is security ownership, not the hosting bill.

There is also a **hidden operational cost**: encryption makes incident response,
debugging, and support harder. We can no longer "just look" at a row to help a
user; we need tooling and an audited break-glass path.

## 6. Speed and experience concern

This is the trade-off we want sponsors and users to understand clearly.

Coordination Manager frequently loads **many data points at once**: a calendar
grid can render hundreds of availability cells, event views list many records, and
overlap detection compares everyone's availability together. If those fields are
encrypted, **every one of them must be decrypted before it can be displayed or
compared**.

- **Slower page loads on data-heavy views.** Some pages may take a while before
  the information becomes available, especially large shared calendars.
- **Loss of database-side work.** Encrypted columns cannot be indexed, sorted, or
  searched by Postgres, so that work moves into slower application code.
- **Batch decryption pressure.** We must use **envelope encryption with cached
  data keys** (decrypt the data key once, then decrypt many fields locally) rather
  than calling the KMS per field, or both cost and latency explode.
- **Tier 3 is heavier.** Decryption happens in the user's browser, so a
  low-powered device opening a big calendar can feel sluggish.

**Mitigations we would build in:**

- Envelope encryption + in-process data-key cache (avoid per-field KMS calls).
- Decrypt lazily / on demand (only the visible window of a calendar; paginate).
- Keep non-sensitive fields (timestamps, IDs, status flags) in plaintext so
  sorting, indexing, and pagination still work at the database level.
- Per-request caching of decrypted views; progressive rendering so the page fills
  in instead of blocking.

Even so, the **most private configuration will also be the slowest** -- some
content-heavy pages will trade a little speed for privacy.

## 7. Open questions for the community and sponsors

1. Is "the operator cannot read your data" worth a slower experience on large
   calendars? Default-on or opt-in per calendar?
2. Managed cloud KMS (simplest, ~$5-25/mo) vs. self-hosted Vault (more control,
   more maintenance)?
3. Which fields are sensitive enough to encrypt first, and which stay plaintext
   for speed?
4. For E2EE, do we accept "lost key = lost data", with an optional user-managed
   key backup?
5. Free baseline (Tier 1 for everyone) plus a premium private tier (Tier 3), or
   one model for all?

## 8. Decision requested

- Approve Tier 1 (operator-held envelope encryption) as the baseline.
- Approve Tier 1 now and scope Tier 3 (E2EE opt-in) for a later phase.
- Approve only a scoped pilot (encrypt feedback + profile email first).
- Defer / request changes.

---

### References

- AWS KMS pricing + envelope encryption: <https://aws.amazon.com/kms/pricing/>
- GCP Cloud KMS: <https://cloud.google.com/kms/docs/envelope-encryption>
- PostgreSQL pgcrypto: <https://www.postgresql.org/docs/current/pgcrypto.html>
- Supabase Vault: <https://supabase.com/docs/guides/database/vault>
- Web Crypto API: <https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API>
