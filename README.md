# EVE Diagnostics — Booking & Payments API

A small backend for booking diagnostic tests at partner centres, with a simulated payment
flow and an idempotent webhook. Built for the EVE Healthcare SDE intern assignment.

**Stack:** Node.js, Express, PostgreSQL (via Sequelize), JWT auth. Tests run on an in-memory
SQLite database so `npm test` doesn't require a running Postgres instance.

---

## 1. Running it locally

### Option A — Docker (fastest)

```bash
docker-compose up --build
```

This spins up Postgres and the API together. The API will be available at
`http://localhost:4000`. On first run, seed some demo centres/tests:

```bash
docker-compose exec api npm run seed
```

### Option B — Node + local/remote Postgres

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# edit .env with your Postgres credentials

# 3. Start Postgres (if you don't already have one running), e.g.:
docker run -d --name eve-pg -p 5432:5432 \
  -e POSTGRES_DB=eve_diagnostics -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  postgres:16-alpine

# 4. Run the server (creates tables automatically via sequelize.sync())
npm run dev      # with nodemon
# or
npm start

# 5. (optional) seed a couple of demo centres and tests
npm run seed
```

The API is now on `http://localhost:4000`. Health check: `GET /health`.

### Running tests

```bash
npm test
```

Tests use an in-memory SQLite database (see `src/config/db.js`), so this works without
Docker or Postgres running. 20 tests across auth, bookings, payments, and — the important
one — webhook idempotency.

---

## 2. API Endpoints

All request/response bodies are JSON. Protected routes expect
`Authorization: Bearer <token>`.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | – | Create an account |
| POST | `/api/auth/login` | – | Log in, get a JWT |

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Asha Verma","email":"asha@example.com","password":"password123"}'

curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"asha@example.com","password":"password123"}'
```

Both return `{ "user": {...}, "token": "<jwt>" }`.

### Diagnostic centres & tests

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/centres` | – | List centres (paginated: `?page=&limit=`), each with its tests |
| GET | `/api/centres/:id` | – | Get one centre with its tests |
| GET | `/api/centres/tests/all` | – | List every test across every centre |
| POST | `/api/centres` | required | Create a centre |
| POST | `/api/centres/:id/tests` | required | Add a test (with price) to a centre |

```bash
curl -X POST http://localhost:4000/api/centres \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"CityCare Diagnostics","location":"Kanpur, UP"}'

curl -X POST http://localhost:4000/api/centres/1/tests \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"Complete Blood Count (CBC)","price":299}'

curl http://localhost:4000/api/centres?page=1&limit=10
```

### Bookings (all require auth)

| Method | Path | Description |
|---|---|---|
| POST | `/api/bookings` | Book a test at a centre |
| GET | `/api/bookings` | List the caller's own bookings |
| GET | `/api/bookings/:id` | Get one booking (must be the owner) |
| POST | `/api/bookings/:id/cancel` | Cancel a non-confirmed booking |

```bash
curl -X POST http://localhost:4000/api/bookings \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"testId":1,"centreId":1,"appointmentTime":"2026-10-05T10:00:00Z"}'
```

The booking's `amount` is snapshotted from the test's price at booking time — it won't
change later if the centre updates its prices.

### Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/payments/` | required | Simulate a payment attempt for a booking you own |
| POST | `/api/payments/webhook` | – (see note below) | Simulated provider callback |

```bash
curl -X POST http://localhost:4000/api/payments/ \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"bookingId":1}'
```

Response includes the resulting `payment` and `booking`, each moved to
`SUCCESS`/`CONFIRMED` or `FAILED` (outcome is randomized, ~80% success, to simulate a real
gateway without integrating one).

**Webhook** — a simulated provider posting an async status update:

```bash
curl -X POST http://localhost:4000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"eventId":"evt_123","providerPaymentId":"sim_abc","status":"SUCCESS"}'
```

Sending the exact same body twice is safe — the second call returns
`{"message":"Event already processed"}` and doesn't touch anything again. See
[Idempotency](#idempotency) below for how that's implemented.

---

## 3. Database / schema design

```
users
  id, name, email (unique), passwordHash, timestamps

diagnostic_centres
  id, name, location, timestamps

diagnostic_tests
  id, name, price, centreId (FK -> diagnostic_centres), timestamps

bookings
  id, userId (FK -> users), testId (FK -> diagnostic_tests), centreId (FK -> diagnostic_centres),
  appointmentTime, amount, status ENUM(PENDING, CONFIRMED, FAILED, CANCELLED), timestamps

payments
  id, bookingId (FK -> bookings), providerPaymentId (unique), amount,
  status ENUM(PENDING, SUCCESS, FAILED), timestamps

webhook_events
  id, eventId (unique), payload (JSON), timestamps
```

Relationships: a centre has many tests; a user has many bookings; a booking belongs to
exactly one test, one centre, and (at most) one payment.

`webhook_events` isn't part of the "business" schema — it exists purely so the webhook
endpoint can tell "have I seen this exact event before" in a way that's safe under
concurrent/duplicate delivery. See below.

### Idempotency

The webhook is idempotent via a **unique constraint + same-transaction write**, not an
in-memory check (which would break under concurrent requests or multiple server
instances):

1. On every webhook call, we try to `INSERT` the incoming `eventId` into `webhook_events`
   inside a DB transaction.
2. If another request already inserted that `eventId`, the insert fails with a unique
   constraint violation. We catch that specific error and respond `200 OK` with
   `"Event already processed"` — no payment/booking rows are touched.
3. If the insert succeeds, we're the one and only request applying this event: we update
   the `Payment` and `Booking` rows in the *same* transaction and commit.

This means duplicate deliveries (which real payment providers do send, by design — they
retry until they get a 2xx) can never create a second payment row, double-confirm a
booking, or leave things half-updated.

---

## 4. Assumptions

- There's no separate "admin" role in this assignment. Creating centres/tests just
  requires being logged in (any authenticated user), rather than being fully public or
  requiring a role system. A real product would put this behind an actual admin/staff
  role.
- The payment webhook endpoint isn't authenticated with a signature/secret, since we're
  not integrating a real gateway. In production this would verify an HMAC signature header
  (e.g. Stripe/Razorpay-style) before trusting the body at all — noted under
  "what I'd improve."
- `POST /payments/` (the synchronous "pay now" call) and the webhook can both resolve a
  payment. This mirrors reality: some gateways respond synchronously, some only confirm
  via webhook, some do both (and the webhook must win/dedupe against the sync response).
  Both paths funnel through the same DB constraints, so neither can corrupt state.
- A booking's `amount` is captured at booking time rather than re-read from the test's
  current price at payment time, since a price change shouldn't retroactively change what
  an existing booking owes.
- `sequelize.sync()` is used instead of migrations, to keep local setup to one command for
  a take-home. Not what I'd use in a real project (see below).
- Cancelling a `CONFIRMED` (paid) booking is blocked at this endpoint — that would need a
  refund flow, which is out of scope here.

## 5. What I'd improve with more time

- **Migrations** instead of `sequelize.sync()` — versioned, reviewable schema changes.
- **Webhook signature verification** — reject payloads that don't carry a valid HMAC
  signature from the "provider", instead of trusting any POST body.
- **Retry/backoff handling** for outbound-style webhook processing, and a dead-letter path
  for events that fail repeatedly.
- **Rate limiting** on auth and payment endpoints specifically (brute-force / abuse).
- **Swagger/OpenAPI spec** generated from the routes, instead of README examples.
- **Structured logging** (pino/winston with request IDs) instead of morgan's plain access
  log, to make debugging a specific booking/payment traceable end-to-end.
- **Refunds / partial cancellation flow** for confirmed bookings.
- **Role-based access** for centre/test management instead of "any logged-in user."
- **Redis** for caching the (fairly static) centre/test listing endpoints.

---

## 6. Project structure

```
src/
  config/db.js          Sequelize connection (Postgres in dev/prod, SQLite in-memory in tests)
  models/                Sequelize models + associations
  middleware/            auth, validation, error handling
  controllers/           request handlers
  routes/                route definitions
  utils/                 jwt + asyncHandler helpers
  app.js                 Express app (no listen — imported by tests)
  server.js              actual entrypoint, connects DB then listens
seed/seed.js             inserts a couple of demo centres/tests
tests/                   Jest + Supertest suite (auth, bookings, payment/webhook idempotency)
```
#   e v e - d i a g n o s t i c  
 