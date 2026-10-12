# Nexus Live — build plan

What is built and what comes next. Work through it phase by phase.

Every phase is done only when `npm run typecheck && npm run lint && npm test &&
npm run build` all pass.

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

## Phase 8 — Video (LiveKit) — next

1. `npm i livekit-server-sdk @livekit/components-react livekit-client`.
2. `POST /api/streams/[id]/token` — mint a viewer or publisher grant against
   `streams.room_name` (already on the row).
3. Mount the room in `src/app/live/[id]/StreamRoom.tsx`, where the placeholder
   stage is.
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

## Phase 13 — Hardening before launch

- Swap `db:push` for `prisma migrate deploy` and commit the migration history.
- Push notifications (the manifest and worker are ready for it).
- A `CASHOUT_HOLD` reconciliation job: assert the sum of held beans equals the
  sum of open requests.
- Rotate `JWT_SECRET` with a `kid` header so sessions can be invalidated.
- Decide whether gambling-adjacent mini-games need region gating.
