process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const app = require('../src/app');
const { resetDb, sequelize } = require('./helpers');
const { Centre, DiagnosticTest, Payment, Booking } = require('../src/models');

async function registerUser(email = 'user1@example.com') {
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Test User',
    email,
    password: 'password123',
  });
  return res.body.token;
}

async function createBookingFor(token) {
  const centre = await Centre.create({ name: 'CityCare Diagnostics', location: 'Kanpur' });
  const test = await DiagnosticTest.create({ name: 'CBC', price: 299, centreId: centre.id });
  const res = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .send({
      testId: test.id,
      centreId: centre.id,
      appointmentTime: new Date(Date.now() + 86400000).toISOString(),
    });
  return res.body;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /payments/', () => {
  it('rejects paying for a booking that belongs to someone else', async () => {
    const tokenA = await registerUser('a@example.com');
    const tokenB = await registerUser('b@example.com');
    const booking = await createBookingFor(tokenA);

    const res = await request(app)
      .post('/api/payments/')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ bookingId: booking.id });

    expect(res.status).toBe(403);
  });

  it('rejects paying for an unknown booking', async () => {
    const token = await registerUser();
    const res = await request(app)
      .post('/api/payments/')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: 99999 });

    expect(res.status).toBe(404);
  });

  it('moves the booking to CONFIRMED or FAILED after a payment attempt', async () => {
    const token = await registerUser();
    const booking = await createBookingFor(token);

    const res = await request(app)
      .post('/api/payments/')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id });

    expect(res.status).toBe(201);
    expect(['CONFIRMED', 'FAILED']).toContain(res.body.booking.status);
    expect(['SUCCESS', 'FAILED']).toContain(res.body.payment.status);
  });
});

describe('POST /payments/webhook (idempotency)', () => {
  it('applies a webhook event exactly once, even if delivered twice', async () => {
    const token = await registerUser();
    const booking = await createBookingFor(token);

    const payment = await Payment.create({
      bookingId: booking.id,
      providerPaymentId: 'sim_test_123',
      amount: booking.amount,
      status: 'PENDING',
    });

    const webhookBody = { eventId: 'evt_001', providerPaymentId: payment.providerPaymentId, status: 'SUCCESS' };

    const first = await request(app).post('/api/payments/webhook').send(webhookBody);
    expect(first.status).toBe(200);
    expect(first.body.message).toBe('Webhook processed');

    const second = await request(app).post('/api/payments/webhook').send(webhookBody);
    expect(second.status).toBe(200);
    expect(second.body.message).toBe('Event already processed');

    const payments = await Payment.findAll({ where: { bookingId: booking.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe('SUCCESS');

    const updatedBooking = await Booking.findByPk(booking.id);
    expect(updatedBooking.status).toBe('CONFIRMED');
  });

  it('rejects a malformed webhook payload', async () => {
    const res = await request(app).post('/api/payments/webhook').send({ eventId: 'evt_002' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the webhook references a payment we have no record of', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ eventId: 'evt_003', providerPaymentId: 'does-not-exist', status: 'SUCCESS' });

    expect(res.status).toBe(404);
  });

  it('does not resurrect a cancelled booking on a late webhook delivery', async () => {
    const token = await registerUser();
    const booking = await createBookingFor(token);

    await request(app).post(`/api/bookings/${booking.id}/cancel`).set('Authorization', `Bearer ${token}`);

    const payment = await Payment.create({
      bookingId: booking.id,
      providerPaymentId: 'sim_test_999',
      amount: booking.amount,
      status: 'PENDING',
    });

    await request(app)
      .post('/api/payments/webhook')
      .send({ eventId: 'evt_004', providerPaymentId: payment.providerPaymentId, status: 'SUCCESS' });

    const updatedBooking = await Booking.findByPk(booking.id);
    expect(updatedBooking.status).toBe('CANCELLED');
  });
});
