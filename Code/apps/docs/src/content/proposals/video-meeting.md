# Proposal: Video Meeting + Modular Recording Toolkit

**Status:** Draft -- pending community approval
**Author:** Whitey
**Target app:** Coordination Manager (extensible to other apps in the portfolio)
**Implementation model:** Agentic coding (Claude / Copilot agents), human review + DevOps only

---

## 1. Motivation

Coordination Manager already helps groups find a time to meet. The natural next
step is to let them **actually meet** -- inside the platform, without bouncing to
Zoom or Google Meet -- and to **record** those meetings for later reference. The
same recording primitives are reusable across the portfolio:

- Solo recording sessions for tutorial / marketing material.
- A "record your screen" feedback widget for any app.
- Async meeting follow-ups (attach a recording to a meeting time slot).

The goal is **one modular package** that drops into Coordination Manager first,
then gets reused elsewhere.

## 2. Two deliverables, shared plumbing

1. **Primary -- Video Meeting** built on self-hosted Jitsi Meet + Jibri.
2. **Secondary -- In-app Screen Recorder** built on `getDisplayMedia` +
   `MediaRecorder`, packaged so any app can drop it in.

They ship as pnpm-workspace packages (`@coord/video-meeting`,
`@coord/screen-recorder`) sharing a common `@coord/recordings-shared` for upload
helpers, Supabase types, and storage layout. The secondary deliverable doubles as
the local-recording fallback for the primary one, so there is a single
local-recording code path.

## 3. Why Jitsi

- Mature open source, no per-minute fees, full data control.
- Official `@jitsi/react-sdk` exposes `JitsiMeeting` + an event/command API.
- Jibri provides battle-tested server-side recording (headless Chrome + ffmpeg).
- JWT "secure domain" auth integrates cleanly with our Supabase-issued identity.

**Limitations to flag:**

- Each Jibri instance records **one** meeting at a time -- horizontal scaling
  required for concurrent recordings.
- Jibri runs on its own VM with non-trivial CPU/disk requirements.

## 4. Recording tiers (all optional, configurable per meeting)

1. **Server (Jibri)** -- default for scheduled multi-party meetings; the source
   of truth.
2. **Cloud** -- a watcher uploads finished recordings to Supabase Storage with a
   metadata row in Postgres.
3. **Local (browser MediaRecorder)** -- optional fallback. If it fails (tab
   closed, OOM, codec issue) we silently fall back to the server recording.

## 5. Security and privacy

- JWT minted only after Supabase session verification; short-lived (slot duration
  + 15 min grace).
- Recording requires explicit host action **and** a consent banner shown to all
  participants.
- Storage RLS: participants read only recordings for meetings they were invited
  to; hosts can delete; no public buckets.
- No raw UUIDs in shareable URLs -- nanoid hashes, consistent with calendar URLs.
- Default 90-day retention (configurable per calendar) and a "delete my recording"
  endpoint.
- Jitsi JWT signing key lives in `apps/api/.env`, never exposed to the frontend.

## 6. Estimated cost

- **Infrastructure:** ~$15-40 / mo for 2 small VPS while in beta.
- **Agent dev:** a few hundred USD of tokens spread across phases.
- **Human time:** ~1-2 weeks calendar time (mostly review + Phase 0 DevOps).

## 7. Open questions for the community

1. Self-host (data sovereignty, ~$30/mo) vs. paying for Jitsi-as-a-Service per
   minute?
2. Default recording mode: server-only, server + local fallback, or opt-in per
   meeting?
3. Default retention period for recordings (30 / 90 / 365 days)?
4. Should screen recordings be shareable via public nanoid link or strictly
   RLS-gated to invited users?
5. Build order: screen-recorder module before, after, or in parallel with the
   meeting module?

## 8. Decision requested

- Approve as written (Video Meeting + Screen Recorder).
- Approve only the primary Video Meeting deliverable for now.
- Approve only the secondary Screen Recorder deliverable for now.
- Defer / request changes.

---

### References

- Jitsi Meet docs: <https://jitsi.github.io/handbook/>
- `@jitsi/react-sdk`: <https://github.com/jitsi/jitsi-meet-react-sdk>
- Jibri (recording): <https://github.com/jitsi/jibri>
- MDN `MediaRecorder`: <https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder>
- MDN Screen Capture API: <https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API>
