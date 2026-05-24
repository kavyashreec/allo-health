# Allo Inventory — Take-Home Exercise

A simple inventory reservation system built with Next.js, Prisma, and Neon PostgreSQL.

## Live Demo

> https://allo-inventory.vercel.app ← replace with your actual URL after deploy

---

## How to Run Locally

### 1. Clone & install

```bash
git clone https://github.com/you/allo-inventory
cd allo-inventory
npm install
```

### 2. Create a Neon database

1. Go to [console.neon.tech](https://console.neon.tech) and create a free project
2. Copy the **connection string** from the dashboard

### 3. Set up env

```bash
cp .env.example .env
# Then edit .env and paste your Neon connection string as DATABASE_URL
```

### 4. Push schema and seed

```bash
npm run db:push     # creates tables from prisma/schema.prisma
npm run db:seed     # seeds 5 products, 2 warehouses, initial inventory
```

### 5. Run

```bash
npm run dev
# Open http://localhost:3000
```

---

## Project Structure

```
src/
  app/
    page.tsx                          # Product listing page
    layout.tsx                        # Root layout
    globals.css
    api/
      products/route.ts               # GET /api/products
      warehouses/route.ts             # GET /api/warehouses
      reservations/
        route.ts                      # POST /api/reservations
        [id]/
          route.ts                    # GET /api/reservations/:id
          confirm/route.ts            # POST /api/reservations/:id/confirm
          release/route.ts            # POST /api/reservations/:id/release
    checkout/
      [id]/page.tsx                   # Checkout page with countdown
  lib/
    prisma.ts                         # Prisma client singleton
prisma/
  schema.prisma                       # Data models
  seed.ts                             # Seed data
```

Kept intentionally flat — no `services/`, no `repositories/`, no `hooks/`. Just routes and pages.

---

## How Concurrency Is Handled

This is the core of the exercise. The problem: two users hit `POST /api/reservations` at the same time for the last unit of a product. Without proper handling, both see `available = 1`, both pass the stock check, and both get reservations — overselling.

**The solution: `SELECT ... FOR UPDATE` inside a Postgres transaction.**

```sql
BEGIN;

SELECT id, "totalStock", "reservedStock"
FROM "Inventory"
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE;   -- <-- row-level lock

-- Only one transaction can hold this lock at a time.
-- The second transaction blocks here until the first commits.

UPDATE "Inventory" SET "reservedStock" = "reservedStock" + 1 WHERE id = $id;

INSERT INTO "Reservation" ...;

COMMIT;
```

When two requests arrive simultaneously:
- **Request A** gets the lock, sees `available = 1`, increments `reservedStock` to 1, commits
- **Request B** was blocked, now unblocks, re-reads the row, sees `available = 0`, throws `INSUFFICIENT_STOCK`
- **Request B** gets a 409

This is implemented in `src/app/api/reservations/route.ts` using `prisma.$transaction` with `$queryRaw` for the `FOR UPDATE` clause (Prisma's typed query builder doesn't support `FOR UPDATE` natively, so we drop to raw SQL just for the lock).

No Redis, no distributed locks, no queues — Postgres handles it natively and correctly.

---

## How Expiry Works

I went with **lazy cleanup** — the simplest approach that works correctly.

When `GET /api/products` is called (i.e., every time the product listing page loads), we run:

```sql
UPDATE "Inventory" i
SET "reservedStock" = "reservedStock" - r.qty
FROM (
  SELECT "productId", "warehouseId", SUM(quantity) as qty
  FROM "Reservation"
  WHERE status = 'pending' AND "expiresAt" < NOW()
  GROUP BY "productId", "warehouseId"
) r
WHERE i."productId" = r."productId"
  AND i."warehouseId" = r."warehouseId"

UPDATE "Reservation"
SET status = 'released'
WHERE status = 'pending' AND "expiresAt" < NOW()
```

This means expired reservations get cleaned up at most "one product page load after they expire". That's acceptable for this use case — the stock becomes visible to new customers as soon as the next person loads the page.

**In production**, I'd add a Vercel Cron Job (`/api/cron/cleanup`) that runs every 1–2 minutes to release expired reservations regardless of traffic. This is just a `vercel.json` entry and a simple API route — maybe 20 more lines of code. I left it out to keep things simple.

**Why not background worker / queue?**
- Overkill for this scale
- Adds infra complexity (Redis, BullMQ, etc.)
- Lazy cleanup + cron covers 99% of cases simply

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List all products with inventory per warehouse |
| GET | `/api/warehouses` | List warehouses |
| POST | `/api/reservations` | Reserve a unit. Body: `{ productId, warehouseId, quantity }` |
| GET | `/api/reservations/:id` | Get a reservation |
| POST | `/api/reservations/:id/confirm` | Confirm (simulate payment success) |
| POST | `/api/reservations/:id/release` | Release (cancel or payment failed) |

**Error codes:**
- `409` — Not enough available stock
- `410` — Reservation has expired

---

## Deploy to Vercel + Neon

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "initial commit"
gh repo create allo-inventory --public --push

# 2. Import the repo on vercel.com
# 3. Add environment variable: DATABASE_URL = your Neon connection string
# 4. Add build command override: prisma generate && next build
#    (or add `"postinstall": "prisma generate"` to package.json)
# 5. Deploy
# 6. After deploy, seed the DB:
npx prisma db seed
```

Or add to `package.json`:
```json
"scripts": {
  "postinstall": "prisma generate"
}
```

---

## Trade-offs & What I'd Do Differently

**What I focused on:**
- Correctness of the reservation logic under concurrency — this is the hard part
- Clear, readable code that doesn't hide logic behind layers of abstraction
- A working end-to-end flow you can demo in 5 minutes

**What I simplified / left out:**
- **No auth** — in a real system, reservations would be tied to a user session
- **No idempotency keys** — the bonus asks for this; I'd store an `idempotencyKey` on the `Reservation` row and do a lookup before inserting
- **No cron job** — lazy cleanup works for the demo; production would add `vercel.json` cron
- **Quantity always = 1** — the API supports arbitrary quantities but the UI hardcodes 1 for simplicity
- **No optimistic UI** — the reserve button waits for the API response before navigating; a production app would be faster with optimistic updates
- **No rate limiting** — easy to add with Vercel's edge middleware or Upstash Ratelimit
- **Error logging** — console.error only; production would use Sentry or similar

**What I'd improve with more time:**
- Add the Vercel Cron cleanup route
- Implement idempotency keys for the reserve + confirm endpoints
- Add user sessions so you can see "your reservations" across tabs
- Write integration tests for the concurrency behavior (can be simulated with `Promise.all` hitting the reservation endpoint)
