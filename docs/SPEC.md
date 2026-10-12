# Nexus Live — product spec

The source of truth for features and numbers. Where this document and the code
disagree, this document is wrong and should be corrected — but every number it
quotes is implemented in exactly one place, `src/lib/economy.ts`, and pinned by
`src/lib/economy.test.ts`.

---

## 1. What it is

A live-streaming social app in the Bigo Live mould, delivered as an installable
PWA. Viewers buy **diamonds**, spend them on gifts and mini-games; hosts receive
**beans**, which are the only balance that converts back to money. A single
owner account runs the whole thing from a Master Admin portal.

### The two-wallet model

This is the single most important rule in the product.

| | Purchased diamonds | Earned diamonds (beans) |
|---|---|---|
| Column | `users.purchased_diamonds` | `users.earned_diamonds` |
| Where it comes from | top-ups, welcome/daily bonus, admin credit | gifts received, game wins, admin credit |
| What it can do | send gifts, play games, found a clan | be withdrawn for money |
| Can it be cashed out? | **never** | yes |

Only two operations move value from the diamond side to the bean side:

1. **a gift to a different user** — the sender is debited diamonds, the
   *receiver* is credited beans;
2. **a game win** — the player is debited diamonds for the wager, and credited
   beans for the payout.

There is no endpoint that converts a user's own diamonds into their own beans.

---

## 2. Accounts

- Email + password. bcryptjs at cost 12 (not argon2 — avoids a native build).
- Username: 3–20 characters, `[a-z0-9_]`, unique and lowercased.
- Optional gender and 2-letter country.
- Session: a JWT (HS256, `jose`) in an httpOnly, SameSite=Lax cookie, 168 hours
  by default.
- **Welcome bonus: 10 diamonds**, credited through `adjustWallet` at signup so
  it appears in the ledger like any other movement.
- **Daily check-in: 5 diamonds**, once per UTC day.
- Password reset: a 6-digit OTP, valid 15 minutes, 5 attempts. Only a bcrypt
  hash of the code is stored. Email delivery is not wired up yet.

### Roles

`USER` → `HOST` (granted automatically the first time someone goes live) →
`MODERATOR` (granted by the owner) → `MASTER_ADMIN`.

`MASTER_ADMIN` is unreachable by any endpoint. See §8.

---

## 3. Diamond packs

Prices in US cents; value per dollar improves with size.

| Code | Diamonds | Bonus | Total | Price |
|---|---:|---:|---:|---:|
| `starter` | 70 | 0 | 70 | $0.99 |
| `mini` | 350 | 10 | 360 | $4.99 |
| `standard` | 700 | 35 | 735 | $9.99 |
| `plus` | 1,400 | 110 | 1,510 | $19.99 |
| `pro` | 3,500 | 400 | 3,900 | $49.99 |
| `whale` | 7,000 | 1,050 | 8,050 | $99.99 |

No payment provider is connected. A top-up records a `diamond_purchases` row;
outside production it settles immediately so the economy can be exercised end to
end, and in production it stays `PENDING` until a provider is wired in.

---

## 4. Gifts

| Code | Name | Diamonds | Tier | Beans to host | Full-screen |
|---|---|---:|---|---:|:-:|
| `rose` | Rose | 5 | common | 3 | |
| `heart` | Heart | 15 | common | 9 | |
| `teddy` | Teddy Bear | 50 | common | 30 | |
| `crown` | Crown | 99 | rare | 59 | |
| `fireworks` | Fireworks | 199 | rare | 119 | ✓ |
| `dragon` | Dragon | 499 | epic | 299 | ✓ |
| `sportscar` | Sports Car | 999 | epic | 599 | ✓ |
| `yacht` | Yacht | 2,999 | legendary | 1,799 | ✓ |
| `castle` | Castle | 9,999 | legendary | 5,999 | ✓ |

- **The host keeps 60%** of the diamond cost, as beans, rounded down. The
  remaining 40% is the platform's margin.
- Up to 99 of one gift per send.
- You cannot gift yourself.
- Each diamond gifted also awards **1 clan point** to the *sender's* clan.

---

## 5. Mini-games

Every round is drawn server-side with `crypto.randomInt(0, 10000)`. The raw draw
is stored on `game_rounds.server_roll` so any payout can be re-checked after the
fact. The client may send a *pick*; it can never send an outcome.

Wagers are taken in diamonds. Winnings are paid in beans.

### Lucky Spin — 10 diamonds

| Outcome | Beans | Chance |
|---|---:|---:|
| Try again | 0 | 50% |
| Small | 5 | 25% |
| Medium | 10 | 15% |
| Large | 25 | 7% |
| Super | 50 | 2.5% |
| Mega | 200 | 0.45% |
| Jackpot | 1,000 | 0.05% |

Expected payout 7.15 beans per 10-diamond spin.

### Treasure Chest — 100 diamonds

Never empty.

| Outcome | Beans | Chance |
|---|---:|---:|
| Bronze | 20 | 75% |
| Silver | 150 | 22% |
| Gold | 1,000 | 3% |

Expected payout 78 beans per 100-diamond chest.

### Lucky Number — 20 diamonds

Call a number from 1 to 10. The server draws one.

| Result | Beans |
|---|---:|
| Exact hit | 150 |
| Off by one | 15 |
| Anything else | 0 |

Expected payout 17.7 beans per 20-diamond round, averaged over all picks
(numbers at the ends of the range have one neighbour instead of two).

---

## 6. Cash-out

- **210 beans = $1.00.**
- **10% platform fee**, taken off the gross.
- **Minimum 100 beans.**
- One request in review at a time.
- The gross rounds *down* to the cent and the fee rounds *up*, so the platform
  never pays out a fraction it did not collect.

Lifecycle:

```
PENDING --approve--> APPROVED --mark paid--> PAID
   |                     |
   +------- reject ------+--> REJECTED   (beans returned to the wallet)
```

Beans leave the balance the moment the request is filed (`CASHOUT_HOLD`), so the
same balance cannot be withdrawn twice while a request is in review. A rejection
credits them back (`CASHOUT_REFUND`), which is why the refund kind is excluded
from the lifetime-earned counter that drives host levels.

---

## 7. Clans

- **Maximum 15 members.**
- Founding costs **1,000 diamonds**.
- Name 3–24 characters, tag 2–5 uppercase alphanumerics, both unique.
- One clan per user. A leader must hand the clan over before leaving.
- Clan points accrue at 1 per diamond a member gifts.

The spec originally called for the cap as a table constraint:

```sql
CHECK ((SELECT COUNT(*) FROM clan_members WHERE clan_id = ...) <= 15)
```

PostgreSQL does not allow a subquery in `CHECK`, so the cap is enforced by
locking the clan row (`SELECT ... FOR UPDATE`) at the top of the join
transaction and counting members *after* the lock is held.

---

## 8. The sole Master Admin

There is exactly one owner account, and the product guarantees it stays that
way.

`isMasterAdmin(subject)` is true only when **both** hold:

1. `subject.role === 'MASTER_ADMIN'`, and
2. `subject.email` equals `MASTER_ADMIN_EMAIL` (case-insensitively).

Three independent gates:

| Layer | File | What it checks |
|---|---|---|
| Edge middleware | `src/middleware.ts` | the JWT claims, before any `/admin` or `/api/admin` request is handled |
| Portal shell | `src/app/admin/layout.tsx` | a fresh database row, before the portal renders |
| Every admin handler | `requireMasterAdmin()` | a fresh database row, inside the handler itself |

And four things that close the remaining doors:

- Signup hardcodes `role: 'USER'` and rejects `MASTER_ADMIN_EMAIL` outright.
- The role-change endpoint's zod schema has no `MASTER_ADMIN` member, so no
  request body can reach it.
- The owner account cannot be locked, demoted or role-changed, by itself or
  anyone else.
- Only `prisma/seed.ts` creates the owner.

**Every admin mutation writes an `admin_audit_logs` row in the same transaction
as the change.** If the change rolls back, so does the audit row — and there is
no path to a change without one.

---

## 9. Levels

### Sender level — from lifetime diamonds spent

| Lv | Title | At |
|---:|---|---:|
| 1 | Spark | 0 |
| 2 | Ember | 100 |
| 3 | Flame | 500 |
| 4 | Blaze | 2,000 |
| 5 | Comet | 10,000 |
| 6 | Nova | 50,000 |
| 7 | Pulsar | 200,000 |
| 8 | Quasar | 1,000,000 |
| 9 | Nebula | 5,000,000 |
| 10 | Nexus | 20,000,000 |

### Host level — from lifetime beans earned

| Lv | Title | At |
|---:|---|---:|
| 1 | Newcomer | 0 |
| 2 | Rising | 500 |
| 3 | Featured | 2,500 |
| 4 | Popular | 10,000 |
| 5 | Star | 50,000 |
| 6 | Superstar | 250,000 |
| 7 | Icon | 1,000,000 |
| 8 | Legend | 5,000,000 |

Only `GIFT_SENT`, `GAME_WAGER` and `CLAN_CREATE_FEE` raise lifetime spend; only
`GIFT_RECEIVED` and `GAME_WIN` raise lifetime earnings. Admin corrections and
cash-out holds/refunds deliberately do not move either.

---

## 10. Streaming and chat

- A stream has a title (≤ 80 chars), a category, a host, and a reserved
  `room_name` for LiveKit.
- One live stream per host at a time.
- Chat messages ≤ 300 characters, 20 per minute per user.
- The client polls `/api/streams/[id]/chat?after=…` every 4 seconds. Redis
  pub/sub is the planned replacement.
- **Video transport is not implemented.** The stream page is the full room —
  header, chat, gift tray, gift animations — with a placeholder where the video
  surface will mount.

---

## 11. Moderation

Any signed-in user can report a user or a stream. Reports move
`OPEN → REVIEWING → RESOLVED | DISMISSED` from the portal. The owner can lock an
account, which blocks sign-in and every authenticated action, and stops the
account receiving gifts.

---

## 12. PWA

- Installable: `public/manifest.json`, standalone display, portrait, three
  shortcuts (Live, Wallet, Games).
- Icons at 192/256/384/512 plus maskable variants with the glyph inside the 80%
  safe zone, a 180px apple-touch icon, and a multi-size `favicon.ico`. All
  generated from `public/logo.svg` by `npm run icons`.
- `public/sw.js` caches the app shell and static build output, and serves an
  offline page for failed navigations.
- **The service worker never caches `/api`, `/wallet` or `/admin`.** Balances
  have to be live. This is enforced in the worker's `isNeverCached()` and again
  by `Cache-Control: no-store` on every API response.

---

## 13. Not built yet

Tracked in `docs/BUILD_PLAN.md`:

- Video transport (LiveKit)
- Payments (Stripe or similar) and the webhook that settles a purchase
- Redis for presence, live viewer counts and rate limits
- Transactional email for password resets
- Push notifications
- Avatar and thumbnail uploads
