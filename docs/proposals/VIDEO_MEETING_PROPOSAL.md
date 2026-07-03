# Proposal: Video Meeting + Modular Recording Toolkit

**Status:** Draft -- pending community approval
**Author:** Tevo
**Target app:** Coordination Manager (extensible to other apps in the portfolio)
**Implementation model:** Agentic coding (Claude / Copilot agents), human review + DevOps only

---

## 1. Motivation

Coordination Manager already helps groups find a time to meet. The natural next step is to let them **actually meet** -- inside the platform, without bouncing to Zoom / Google Meet -- and to **record** those meetings for later reference. The same recording primitives are also useful across the rest of the portfolio:

- Solo recording sessions for tutorial / marketing material.
- "Record-your-screen" feedback widget for any app (similar to the new VS Code 1.122 issue-reporting wizard with built-in screen recording -- see https://code.visualstudio.com/updates/v1_122).
- Async meeting follow-ups (attach a recording or a screen walkthrough to a meeting time slot).

The goal is **one modular package** that can be dropped into Coordination Manager first, then reused in other apps.

## 2. Constraints

- **Budget:** A few hundred USD total dev + ~1-2 weeks of my time. Heavy lifting is delegated to coding agents; my role is review, integration testing, and DevOps.
- **Hosting:** Self-host where it is cheap and gives us control over data. Avoid per-minute SaaS fees (Jitsi-as-a-Service / 8x8) for the baseline tier.
- **Stack fit:** Must integrate with React 18 + TypeScript + Vite + Tailwind frontend, Node/Express backend, Supabase (Postgres + Storage + Auth, RLS).
- **Recording must be redundant:** Server recording is the source of truth, but local recording is offered as a fallback. "It is OK if local recording fails" -- we just degrade gracefully.
- **Modularity:** Ship as `@coord/video-meeting` and `@coord/screen-recorder` packages in the pnpm workspace so other apps can import them.

## 3. Proposal

This is **one proposal with two deliverables that share the same plumbing**:

1. **Primary -- Video Meeting** built on self-hosted Jitsi Meet + Jibri.
2. **Secondary -- In-app Screen Recorder** built on `getDisplayMedia` + `MediaRecorder`, packaged so any of our apps can drop it in for feedback widgets, solo walkthroughs, and async updates.

They ship as two pnpm-workspace packages (`@coord/video-meeting`, `@coord/screen-recorder`) that share a common `@coord/recordings-shared` for upload helpers, Supabase types, and storage layout. The secondary deliverable also doubles as the local-recording fallback for the primary one, so we maintain a single local-recording code path.

### 3.1 Primary: Video Meeting (Jitsi Meet + Jibri)

**Use case:** Multi-party meetings scheduled through Coordination Manager. Participants click "Join meeting" on a calendar slot and land in a Jitsi room hosted on our infrastructure. Optionally the host can press "Record" and the recording is uploaded to Supabase Storage when the meeting ends.

**Why Jitsi:**
- Mature OSS, no per-minute fees, full data control.
- Official `@jitsi/react-sdk` exposes `JitsiMeeting` + External API (events + commands).
- Jibri provides battle-tested server-side recording (headless Chrome + ffmpeg).
- JWT "secure domain" auth integrates cleanly with our Supabase-issued identity.

**Limitations to flag:**
- Each Jibri instance records **one** meeting at a time -- horizontal scaling required if we expect concurrent recordings.
- Jibri runs on its own VM with non-trivial CPU/disk requirements.
- Jitsi's *built-in* "local recording" is capped at ~1 GB / ~100 minutes and cannot run alongside Jibri. We will use **our own** MediaRecorder-based local fallback (see 3.2) rather than the Jitsi built-in -- one consistent local-recording code path everywhere.

**Components:**

**Component - Where it runs - Purpose**
Jitsi Videobridge + Jicofo + Prosody - Single VM (Debian/Docker) - Core SFU + signalling
Jibri x N - Dedicated VMs / containers - Server-side recording (1 meeting each)
`@coord/video-meeting` React pkg - apps/web (and any other app) - `JitsiMeeting` wrapper, recording controls, event hooks
`/api/meetings` - apps/api - JWT issuance, recording lifecycle, upload to Supabase
Supabase `meeting_recordings` - DB + Storage bucket - Metadata + file storage with RLS

**Recording tiers (all optional, configurable per meeting):**

1. **Server (Jibri)** -- default for scheduled multi-party meetings. Reliable, single source of truth.
2. **Cloud (our own object store)** -- Jibri writes to local disk, a watcher uploads finished recordings to Supabase Storage (or S3-compatible bucket on our server). Metadata row in Postgres.
3. **Local (browser MediaRecorder, optional fallback)** -- powered by the 3.2 package. If the user opts in, their browser also records locally. If it fails (tab closed, OOM, codec issue) we silently fall back to the server recording.

**JWT flow:**

```
client -> POST /api/meetings/:id/token (with Supabase session cookie)
       <- { jwt, room, jitsiDomain }
client -> JitsiMeeting jwt={jwt} roomName={room} domain={jitsiDomain}
```

JWT payload includes `context.user` (name, avatar, email), `context.features.recording = true|false` for the host, and an expiry aligned with the scheduled slot + grace period.

**Open infra questions (need community/DevOps decision):**
- Domain / TLS: subdomain like `coordinationmanager.meet.exampleID` with Let's Encrypt.

### 3.2 Secondary: In-App Screen Recorder (MediaRecorder + getDisplayMedia)

**Use case:** Anywhere in any app where a user wants to record their screen -- e.g.

- Filing a bug report ("show me what went wrong").
- Recording a solo walkthrough / tutorial.
- Attaching a quick async update to a calendar slot.
- Local fallback recorder inside the Jitsi meeting (3.1) so we have a single local-recording implementation.

**Why a separate module instead of reusing Jitsi:**
- Jitsi is a multi-party SFU; spinning it up for a solo screen capture is massive overkill.
- Jitsi's screen sharing is *streamed*, not stored, unless Jibri is recording -- and we do not want to require Jibri for every "record my screen" interaction.
- The Web platform already provides exactly the right primitives: `navigator.mediaDevices.getDisplayMedia()` + `MediaRecorder`. No server needed for capture, only for storage.

**Components:**

**Component - Where it runs - Purpose**
`@coord/screen-recorder` React pkg - apps/web (and any other app) - Headless recorder hook + drop-in UI (FAB / panel)
`/api/recordings` - apps/api - Presigned upload URLs, metadata, sharing links
Supabase `screen_recordings` - DB + Storage bucket - Metadata + file storage with RLS

**Public API (sketch):**

```ts
const recorder = useScreenRecorder({
  audio: 'mic' | 'tab' | 'both' | 'none',
  mimeType: 'video/webm;codecs=vp9,opus',
  chunkMs: 5000,                      // chunk size to avoid OOM on long sessions
  maxDurationMs: 4 * 60 * 60 * 1000,  // 4h hard cap, auto-restart segment
  onSegment: (blob, idx) => upload(blob, idx),
});

recorder.start();
recorder.pause();
recorder.stop();
```

**Long-recording strategy (3-4 hour sessions):**
- Chunk to 5-10 s blobs via `MediaRecorder`'s `timeslice` argument.
- Stream chunks to Supabase Storage as multipart upload, OR buffer to IndexedDB and upload on stop.
- Auto-roll to a new segment every N minutes to bound memory and recover from tab crashes.
- VP9/Opus by default with H.264/AAC fallback for Safari.

**Graceful degradation:**
- If `getDisplayMedia` is denied: show clear error + link to permissions help.
- If `MediaRecorder` is unavailable / codec unsupported: detect at module load, hide UI, log once.
- If upload fails: keep the last completed segment in IndexedDB and offer a manual "Re-upload" button.

### 3.3 How the pieces compose

```
+-------------------------------------+
| @coord/video-meeting (3.1)          |
|   - <JitsiMeeting />                |
|   - server recording (Jibri)        |
|   - optional local fallback ------> |--+
+-------------------------------------+  |
                                         v
+-------------------------------------+
| @coord/screen-recorder (3.2)        |
|   - useScreenRecorder() hook        |
|   - <RecordButton /> FAB            |
|   - chunked upload to Supabase      |
+-------------------------------------+
```

Both packages share `@coord/recordings-shared` for upload helpers and Supabase types.

## 4. Tech Stack Mapping

**Layer - Choice**
Meeting client - `@jitsi/react-sdk` (React 18, TypeScript)
Meeting server - Self-hosted Jitsi Meet (Docker)
Recording server - Jibri (Docker, separate VM)
Local recording - `getDisplayMedia` + `MediaRecorder` (in `@coord/screen-recorder`)
Backend - Existing Express + TypeScript app (apps/api); add `meetings.ts` and `recordings.ts` route files
Auth - Existing Supabase Auth -> JWT minted server-side for Jitsi
Storage - Supabase Storage buckets `meeting-recordings` and `screen-recordings`, with RLS
DB schema - New tables: `video_meetings`, `meeting_recordings`, `screen_recordings` (TIMESTAMPTZ, RLS enabled, created_by TEXT per project conventions)
Tests - Vitest + Supertest (api), React Testing Library (web) per `testing-strategy` skill

## 5. Security & Privacy

- **JWT minting only after Supabase session verification.** Tokens are short-lived (slot duration + 15 min grace).
- **Recording requires explicit host action AND consent banner** rendered to all participants by Jitsi's built-in notifier.
- **Storage RLS:** participants can read only recordings for meetings they were invited to. Hosts can delete. No public buckets.
- **No raw UUIDs** in shareable recording URLs -- use nanoid hashes consistent with existing calendar URL convention.
- **GDPR:** add a retention policy (default 90 days, configurable per calendar) and a "delete my recording" endpoint.
- **Secrets:** Jitsi JWT signing key in `apps/api/.env` (`JITSI_JWT_SECRET`, `JITSI_APP_ID`, `JITSI_DOMAIN`). Never exposed to frontend.
- **Supply chain:** pin Jitsi Docker images to digest, audit `@jitsi/react-sdk` per `supply-chain-security` skill.

## 6. Agentic Coding Implementation Plan

The work is decomposed so that each phase is a self-contained agent task with clear inputs, outputs, and acceptance tests. Human review happens at each phase boundary.

### Phase 0 -- Infra spike (human, ~1 day)
- Provision 2 small VPS (or 1 medium) for Jitsi + Jibri.
- DNS + TLS for `meet.<domain>`.
- Docker Compose with `jitsi/web`, `jitsi/prosody`, `jitsi/jicofo`, `jitsi/jvb`, `jitsi/jibri`.
- Verify a manual recording works end-to-end.
- **Exit criteria:** Can join a room in a browser and download a Jibri recording from disk.

### Phase 1 -- Database + shared package (agent, ~half day)
- Add migrations under `packages/database/migrations/`:
  - `0NN_video_meetings.sql`
  - `0NN_meeting_recordings.sql`
  - `0NN_screen_recordings.sql`
- Add Supabase Storage buckets + RLS policies.
- Create `packages/recordings-shared/` with TS types + upload helpers.
- **Exit:** `pnpm typecheck` + migration regression tests pass.

### Phase 2 -- Backend routes (agent, ~1 day)
- `apps/api/src/routes/meetings.ts`:
  - `POST /api/meetings` (create from calendar slot)
  - `POST /api/meetings/:id/token` (mint Jitsi JWT)
  - `POST /api/meetings/:id/recordings` (Jibri webhook on finish)
- `apps/api/src/routes/recordings.ts`:
  - `POST /api/recordings/upload-url` (presigned multipart)
  - `POST /api/recordings/:id/complete`
  - `GET /api/recordings/:id`
- `apps/api/src/services/jitsi.ts` for JWT minting.
- Supertest coverage per `testing-strategy` skill.
- **Exit:** All tests green; API typecheck clean.

### Phase 3 -- `@coord/video-meeting` package (agent, ~1-2 days)
- Wrap `@jitsi/react-sdk`'s `JitsiMeeting`.
- Expose `<VideoMeeting meetingId>` and `useMeetingRecording()`.
- Wire start/stop recording to External API commands.
- Integrate into Coordination Manager: add "Join meeting" / "Start meeting" CTA on calendar slot detail.
- **Exit:** Two browsers can join, host can start/stop server recording, recording appears in Supabase.

### Phase 4 -- `@coord/screen-recorder` package (agent, ~1 day)
- `useScreenRecorder` hook + `<RecordButton>` FAB (follows existing FAB cluster / side-panel patterns).
- Chunked upload pipeline.
- Demo route in Coordination Manager under feedback flow.
- **Exit:** Can record 30 min screen capture in Chrome + Firefox, file lands in Supabase Storage with metadata.

### Phase 5 -- Glue + UX polish (agent + human, ~1 day)
- Recording library page (list, play, share, delete) per RLS rules.
- Consent banners, error toasts, accessibility pass.
- Docs page in `apps/docs`.
- **Exit:** Feature flag flipped on for beta cohort.

### Phase 6 -- Hardening (agent, ongoing)
- Jibri auto-scaling docs / scripts.
- Retention cron.
- `pnpm audit` + dependency review per `supply-chain-security`.

### Estimated cost
- **Infrastructure:** ~$15-40 / mo for 2 small VPS while in beta.
- **Agent dev:** A few hundred USD of tokens spread across phases 1-5.
- **My time:** ~1-2 weeks calendar time (mostly review + Phase 0 DevOps).

## 7. Open Questions for Community

1. Are we OK self-hosting (data sovereignty, ~$30/mo) vs. paying for JaaS per minute?
2. Default recording mode: **server-only**, **server + local fallback**, or **opt-in per meeting**?
3. Default retention period for recordings (30 / 90 / 365 days)?
4. Should screen recordings be shareable via public link (with nanoid) or strictly RLS-gated to invited users?
5. Build order for the secondary screen-recorder module: **before** the meeting module (so the local-fallback code is ready), **after**, or **in parallel**?

## 8. Decision Requested

- [ ] Approve the proposal as written (Video Meeting via Jitsi + Jibri, with the in-app Screen Recorder as the secondary module).
- [ ] Approve only the primary Video Meeting deliverable for now.
- [ ] Approve only the secondary Screen Recorder deliverable for now.
- [ ] Defer / request changes (see comments).

---

### References

- Jitsi Meet docs: https://jitsi.github.io/handbook/
- `@jitsi/react-sdk`: https://github.com/jitsi/jitsi-meet-react-sdk
- Jibri (recording): https://github.com/jitsi/jibri
- MDN `MediaRecorder`: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- MDN Screen Capture API: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API
- VS Code 1.122 release notes (video issue reporting): https://code.visualstudio.com/updates/v1_122
