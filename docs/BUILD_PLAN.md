# Nexus Live — build plan

What is built and what comes next. Work through it phase by phase.

Every phase is done only when `npm run typecheck && npm run lint && npm test &&
npm run build` all pass. `.github/workflows/ci.yml` runs exactly those four on
every push, plus a second job that applies `prisma/schema.prisma` to a real
PostgreSQL, runs the seed, and asserts two invariants hold afterwards: exactly
one `MASTER_ADMIN` (and it is `MASTER_ADMIN_EMAIL`), and every balance equals
the sum of its ledger entries.

---

## Phase 1 — Foundations ✅

- Next.js 15 App Router, TypeScript strict (`noUncheckedIndexedAccess` on),
  Tailwind 3.
- Prisma 6 schema: users, follows, ledger entries, purchases, cash-outs,
  streams, chat, gifts, game rounds, clans, clan members, password resets,
  admin audit logs, reports, platform settings.
- `docker-compose.yml` for local Postgres and Redis.
- `src/lib/http.ts` — the `route()` wrapper and `AppError`, so every handler
  returns one JSON shape and never leaks a stack trace.
- `src/lib/prisma.ts` with the dev singleton.

## Phase 2 — The economy ✅

- `src/lib/economy.ts` — every rate, price, odd and formula, pure and
  dependency-free.
- `src/lib/economy.test.ts` — 32 vitest cases covering pack value curves, gift
  bean floors, integer cash-out maths, full weight-table sweeps for every game,
  Lucky Number uniformity, and level banding.
- `src/lib/wallet.ts` — `adjustWallet`, `lockUsers`, `addClanPoints`,
  `lockClan`.

## Phase 3 — Auth and the sole-admin lock ✅

- `src/lib/session.ts` (edge-safe: `jose` only), `src/lib/auth.ts`,
  `src/lib/audit.ts`.
- `src/middleware.ts` gating `/admin` and `/api/admin`.
- Signup, login, logout, me, forgot-password, reset-password.
- `prisma/seed.ts` — the only place a `MASTER_ADMIN` is created.

## Phase 4 — Money in motion ✅

- Wallet read, daily bonus, diamond packs, top-up.
- Gifting, with both user rows locked up front.
- Three mini-games, rolled with `crypto.randomInt` and stored with the draw.
- Clans: found, join (15-member cap by row lock), leave, points.
- Cash-out: request, hold, approve, mark paid, reject with refund.

## Phase 5 — The app ✅

- Home, live browse, stream room (chat + gift tray + animations), wallet,
  mini-games, clans, profiles, auth screens, offline page.
- Mobile-first with a bottom tab bar; dark, brand-themed.

## Phase 6 — Master Admin portal ✅

- Overview: users, revenue, bean liability, gifting split, cash-out queue, game
  house edge, open reports, recent admin actions.
- Users: search, paginate, adjust either wallet, set role, lock/unlock.
- Cash-outs: approve / mark paid / reject-and-refund with a note.
- Ledger: every movement, filterable by user and wallet.
- Reports and the audit log.

## Phase 7 — PWA shell and brand ✅

- Logo: `public/logo.svg` and variants; `scripts/generate-icons.mjs` renders
  every icon, the maskable set, the favicon and the social card.
- `public/manifest.json`, `public/sw.js`, metadata and `<Logo />`.
- The service worker never touches `/api`, `/wallet` or `/admin`.

---

## Deploying a test instance

`render.yaml` is a Render Blueprint for a throwaway test instance: Render
dashboard -> New -> Blueprint -> pick this repo -> Apply. It wires
`DATABASE_URL` from the `nexuslive-db` Postgres itself, and its build command
applies the schema and runs the seed, so the only manual step is Apply.

`/api/wallet/purchase` refuses to self-settle in production, so a hosted test
instance has no way to mint diamonds. Set `SEED_DEMO_DATA=true` and run the
seed against it: that creates the five demo accounts with funded wallets, and
their ledger entries, so gifting, games and cash-out can all be exercised.
Never set it on a real deployment.

## Phase 7b — Stage, moderation, notifications ✅

- Camera, microphone, device switching, mirror and 8 filter presets, all real
  `getUserMedia`.
- 4 guest seats per stream: open, lock, invite (2-minute TTL), join, leave,
  kick, mute. Claiming is a state-guarded conditional update, so concurrent
  taps resolve to one winner.
- Gift effects: tier drives intensity, the gift drives takeover; god-rays,
  particle bursts, coin rain on legendary, sweeping banners.
- Content policy with the 1 hour / 1 week / permanent-ban strike ladder, and
  forfeiture of both wallets to the owner on a ban.
- One email, one phone, one username, enforced on signup and on profile edit.
- Notifications with a bell, unread count, and luxury toast pop-ups.
- Profile editing at /settings.

## Phase 8 — Video (LiveKit) — next

1. `npm i livekit-server-sdk @livekit/components-react livekit-client`.
2. `POST /api/streams/[id]/token` — mint a viewer or publisher grant against
   `streams.room_name` (already on the row).
3. Mount the room in `src/components/LiveStage.tsx`, which already owns the
   local camera, mic and filter state — publish its track and subscribe the
   seats, which already carry who is on them.
   The CSS filter applies to the local preview only; baking it into the
   published track needs a canvas pipeline between the camera and LiveKit.
4. A LiveKit webhook to set `status = ENDED` when a publisher disconnects, so a
   dropped host does not leave a stream live forever.

## Phase 9 — Payments

1. Stripe Checkout against `DIAMOND_PACKS`. Never trust a price from the
   client — look the pack up by code, server-side.
2. The webhook is the only thing that may settle a purchase: verify the
   signature, then in one transaction flip `diamond_purchases.status` to `PAID`
   and call `adjustWallet`.
3. Idempotency: the `(provider, providerRef)` unique index is already in the
   schema for exactly this — a replayed webhook must not credit twice.
4. Remove the non-production auto-settle branch in
   `src/app/api/wallet/purchase/route.ts`.

## Phase 10 — Redis

Presence and live viewer counts, chat fan-out to replace the 4-second poll, and
proper rate limits for chat, gifting and login (the current chat limit counts
rows, which will not hold up).

## Phase 11 — Email

Transactional email for the password-reset OTP. The code path and its hash
already exist; only delivery is missing. Drop the `devCode` from the
forgot-password response at the same time.

## Phase 12 — Media uploads

Avatars and stream thumbnails to S3 or R2 via presigned URLs. `Avatar` and
`StreamCard` already render remote URLs.

## Phase 12b — Automated content moderation

The strike ladder, forfeiture and audit trail are built and tested; only
*detection* is missing. Sample stream frames to an image classifier (AWS
Rekognition Moderation, Hive, or a self-hosted NSFW model), and on a confident
hit call `applyStrike()` — the same function the portal calls. Keep a human in
the loop for anything below a high confidence threshold, because the third
rung is irreversible and takes somebody's money.

## Phase 13 — Hardening before launch

- Swap `db:push` for `prisma migrate deploy` and commit the migration history.
- Push notifications (the manifest and worker are ready for it).
- A `CASHOUT_HOLD` reconciliation job: assert the sum of held beans equals the
  sum of open requests.
- Rotate `JWT_SECRET` with a `kid` header so sessions can be invalidated.
- Decide whether gambling-adjacent mini-games need region gating.
