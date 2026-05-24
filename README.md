# Allo Inventory

A small inventory reservation system built using Next.js, Prisma, Neon PostgreSQL, and Tailwind CSS.
The project simulates how e-commerce platforms temporarily reserve stock during checkout to avoid overselling products.

---

## Features

* View products and warehouse stock
* Reserve products for 10 minutes
* Confirm or cancel reservations
* Automatic expiry handling
* Concurrency-safe reservation logic using PostgreSQL row locking
* Simple and clean UI

---

## Tech Stack

* Next.js (App Router)
* React
* TypeScript
* Prisma ORM
* Neon PostgreSQL
* Tailwind CSS

---

## Run Locally

```bash
git clone <your-repo-url>
cd allo-inventory

npm install
```

Create a `.env` file:

```env
DATABASE_URL="your_neon_database_url"
```

Push schema and seed database:

```bash
npx prisma db push
npx prisma db seed
```

Start the app:

```bash
npm run dev
```

---

## Concurrency Handling

The reservation endpoint uses PostgreSQL row locking with:

```sql
SELECT ... FOR UPDATE
```

inside a Prisma transaction to prevent race conditions.

If two users try reserving the last item simultaneously:

* one request succeeds
* the other receives a `409 - Not enough stock`

This ensures stock is never oversold.

---

## Expiry Handling

Expired reservations are cleaned up using a simple lazy cleanup approach whenever products are fetched.

In a real production system, this could be replaced with a scheduled cron job.

---

## API Routes

| Method | Route                           |
| ------ | ------------------------------- |
| GET    | `/api/products`                 |
| GET    | `/api/warehouses`               |
| POST   | `/api/reservations`             |
| POST   | `/api/reservations/:id/confirm` |
| POST   | `/api/reservations/:id/release` |

---

## Notes

I intentionally kept the project structure simple and beginner-friendly without adding unnecessary abstraction layers or complex architecture.
The main focus was correctness of reservation handling and building a fully working end-to-end flow.

