# Nexus Live

Live streaming + social PWA (Bigo Live style): diamond economy, gifting, mini-games,
clans, cash-out, and a single-owner Master Admin portal.

- Full product spec: `docs/SPEC.md` (source of truth for features and numbers)
- What is built and what comes next: `docs/BUILD_PLAN.md` — work through it phase by phase
- Logo and brand: `docs/BRAND.md`

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind 3 · Prisma 6 + PostgreSQL ·
jose (JWT in httpOnly cookie) · bcryptjs · zod · vitest. Redis, payments and
LiveKit are planned, not yet installed.

## Commands

```bash
docker compose up -d      # local Postgres + Redis
npm run db:push           # apply prisma/schema.prisma (use db:migrate once schema settles)
npm run db:seed           # create the master admin from .env
npm run dev
npm test                  # vitest — economy rules
npm run icons             # regenerate PWA icons from public/logo.svg
npm run typecheck && npm run lint && npm run build   # must all pass before a task is done
```

## Layout

```
prisma.config.ts            Prisma CLI config — and the ONLY place .env gets loaded for it
prisma/schema.prisma        data model (+ ledger_entries, not in the spec)
prisma/seed.ts              the ONLY place a MASTER_ADMIN is created
src/middleware.ts           /admin and /api/admin gate
src/lib/economy.ts          ALL rates, prices, odds, formulas (pure, tested)
src/lib/wallet.ts           adjustWallet / lockUsers / addClanPoints / lockClan
src/lib/session.ts          JWT sign/verify + isMasterAdmin (edge-safe)
src/lib/auth.ts             getUser / requireUser / requireMasterAdmin
src/lib/http.ts             route() wrapper + AppError
src/lib/audit.ts            writeAudit — called inside every admin mutation
src/lib/validators.ts       zod schemas for every request body
src/lib/api.ts              browser fetch helper (no-store)
src/lib/moderation.ts       applyStrike — the strike ladder, ban + forfeiture
src/lib/phone.ts            E.164 normalisation for the one-number rule
src/lib/notify.ts           notifications, written in the causing transaction
src/lib/camera.ts           filter presets, media constraints, the getUserMedia fallback ladder
src/app/api/**              route handlers
src/app/admin               Master Admin portal
src/components/Logo.tsx     the mark, inline — same geometry as public/logo.svg
src/components/LiveStage.tsx    real getUserMedia camera, mic, filters, device pickers, level meter
src/components/SeatGrid.tsx     multi-guest seats (open/lock/invite/kick/mute) + your own seat preview
src/components/GiftEffect.tsx   tiered gift animations and takeovers
src/components/Notifications.tsx bell, dropdown and the toast stack
scripts/generate-icons.mjs  renders every PWA icon from the SVG sources
public/sw.js, manifest.json PWA shell
.github/workflows/ci.yml    the four gates + schema/seed against a real Postgres
```

## Rules that must not be broken

1. **Money moves only through `adjustWallet()`**, inside `prisma.$transaction`. It locks
   the user row (`SELECT ... FOR UPDATE`), refuses negative balances, and writes a
   ledger entry. Never `prisma.user.update` a balance directly.
2. **Lock order**: when a transaction touches two users, call `lockUsers(tx, [a, b])`
   first (it sorts ids) to avoid deadlocks.
3. **Two wallets never mix.** `purchased_diamonds` is spend-only and never cashable.
   `earned_diamonds` (beans) is the only cashable balance. No endpoint converts
   purchased into earned except gifts (to a *different* user) and game wins.
4. **Sole Master Admin lock.** `isMasterAdmin()` = role is `MASTER_ADMIN` AND email equals
   `MASTER_ADMIN_EMAIL`. Middleware checks the JWT; every `/api/admin/*` handler must
   ALSO call `requireMasterAdmin()` (re-checks the DB). Signup hardcodes `role: 'USER'`
   and rejects the admin email. No endpoint may grant `MASTER_ADMIN`; only the seed does.
5. **Every admin mutation writes `admin_audit_logs`** in the same transaction.
6. **Numbers live in `src/lib/economy.ts`.** Don't hardcode rates, fees, prices or odds
   in routes or UI. If you change one, update `economy.test.ts`.
7. **Game outcomes are rolled on the server** with `crypto.randomInt`. Never trust the client.
8. **Never cache `/api` or wallet data** in the service worker.
9. Validate every request body with zod. Wrap handlers in `route()` and throw `AppError`.
10. Pages that read the DB need `export const dynamic = 'force-dynamic'`.
11. **The strike ladder is the only thing that picks a punishment.** An admin
    says an offence happened; `applyStrike()` reads `strike_count` and decides.
    `strike_count` never goes down — lifting a restriction does not reset it.
12. **A ban's forfeiture keeps the wallets apart**: purchased moves to the
    owner's purchased, earned to earned. Both go through `adjustWallet`.
13. **A restriction blocks public actions, never the wallet.** Use
    `requireUnrestricted()` for going live, seats, chat and gifting;
    `requireUser()` everywhere else.

## Known deviations from the spec (intentional)

- The spec's `CHECK ((SELECT COUNT(*) ...) <= 15)` is invalid PostgreSQL (no subqueries
  in CHECK). The 15-member cap is enforced by locking the clan row in the join route.
- `users.purchased_diamonds` defaults to 0; the 10-diamond welcome bonus is credited via
  `adjustWallet` at signup so it appears in the ledger.
- Password reset stores a hash of the OTP, not the plaintext `otp_code`.
- bcryptjs (cost 12) is used instead of argon2 to avoid native builds; swap if desired.
- Added `ledger_entries` table and `users.gender`.
- Treasure Chest bean rewards (20 / 150 / 1000) and the 100-bean minimum cash-out are
  placeholders — the spec doesn't give them.
- `lockUsers` issues one `SELECT ... FOR UPDATE` per id rather than a single `IN (...)`:
  Postgres does not promise lock acquisition follows `ORDER BY` within one statement,
  and the stable order is the whole point of rule 2.
- A guest's camera renders in their own seat tile, never on the stage: the stage is
  the host's frame. Nothing is published to anyone yet either way — `LiveStage` is a
  local preview until LiveKit lands, so no camera a viewer sees is ever someone else's.
- A `prisma.config.ts` makes Prisma stop loading `.env` itself, so that file loads it
  (`.env.local`, then `.env`, neither overriding a real environment variable). Without
  that every CLI command dies on `P1012: Environment variable not found: DATABASE_URL`.
- `/api/wallet/purchase` settles immediately outside production so the economy is
  testable end to end. It must never self-settle in production — that guard is
  deliberate, not a TODO. See Phase 9 in `docs/BUILD_PLAN.md`.
