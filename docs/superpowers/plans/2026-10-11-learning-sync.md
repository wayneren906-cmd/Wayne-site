# Learning Sync Implementation Plan

**Goal:** Publish verified learning summaries from authorized conversations daily at 06:00 Beijing time.

**Architecture:** Dedicated authenticated GET/POST API reuses the record schema and D1 database. A local uploader protects human edits and verifies published content. A same-chat heartbeat retrieves evidence and runs the uploader.

**Tech Stack:** Existing Vinext/Workers, D1, Node 24, node:test and node:sqlite; no dependency upgrades.

## Constraints

- Credentials, chat evidence, drafts and backups remain in ignored data.
- Preserve atomic expectedRevision checks, manual admin authentication, and existing snapshots.
- The daily interval is previous Beijing 06:00 to current 06:00, attributed to the start date.

## Task 1: Authenticated endpoint

- [x] Add tests in tests/sync.test.mjs using an in-memory SQLite-backed D1 adapter for authentication, payload bounds, create/update, conflict and identical retry.
- [x] Run `node --experimental-strip-types --test tests/sync.test.mjs` and observe missing functionality.
- [x] Implement `handleSync(request, {DB, SYNC_TOKEN_SHA256})` in lib/sync.ts and a thin route in app/api/sync/records/route.ts.
- [x] Generate binding types with project Wrangler after adding the secret locally; run tests and typecheck.

## Task 2: Verified local uploader

- [x] Implement scripts/sync-record.mjs and testable upload/state helpers in scripts/sync-client.mjs.
- [x] Test stale/manual revision rejection, unchanged replay, and verification failure before recording local success.
- [x] Generate local credential without printing it; upload only its digest via Wrangler stdin to Worker secret.

## Task 3: Publish and schedule

- [x] Run all tests, typecheck and build. Review diff, push source to GitHub and wait for successful automatic deployment.
- [x] Back up remote records, summarize real retrieved conversation evidence, merge existing content, and upload once with explicit adoption.
- [x] Verify real record, no-op retry, incorrect auth, stale conflict and manual admin protection.
- [x] Inspect existing schedules and create/update one same-chat daily 06:00 heartbeat.
- [x] Document verified deployment and local execution requirement. Distinguish tested integration from the future scheduled run.
