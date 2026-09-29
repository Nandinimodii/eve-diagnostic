process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const app = require('../src/app');
const { resetDb, sequelize } = require('./helpers');
const { Centre, DiagnosticTest } = require('../src/models');

async function registerUser(email = 'user1@example.com') {
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Test User',
    email,
    password: 'password123',
  });
  return res.body.token;
}

async function seedCentreAndTest() {
  const centre = await Centre.create({ name: 'CityCare Diagnostics', location: 'Kanpur' });
  const test = await DiagnosticTest.create({ name: 'CBC', price: 299, centreId: centre.id });
  return { centre, test };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Bookings', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/bookings').send({});
    expect(res.status).toBe(401);
  });

  it('creates a booking for a valid test/centre pair', async () => {
    const token = await registerUser();
    const { centre, test } = await seedCentreAndTest();

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        testId: test.id,
        centreId: centre.id,
        appointmentTime: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(Number(res.body.amount)).toBe(299);
  });

  it('rejects a booking with an invalid appointment time', async () => {
    const token = await registerUser();
    const { centre, test } = await seedCentreAndTest();

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId: test.id, centreId: centre.id, appointmentTime: 'not-a-date' });

    expect(res.status).toBe(400);
  });

  it('rejects a booking where the test does not belong to the given centre', async () => {
    const token = await registerUser();
    const centreA = await Centre.create({ name: 'Centre A', location: 'X' });
    const centreB = await Centre.create({ name: 'Centre B', location: 'Y' });
    const test = await DiagnosticTest.create({ name: 'CBC', price: 100, centreId: centreA.id });

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        testId: test.id,
        centreId: centreB.id,
        appointmentTime: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(res.status).toBe(404);
  });

  it('returns 404 for a booking id that does not exist', async () => {
    const token = await registerUser();
    const res = await request(app).get('/api/bookings/9999').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("prevents a user from viewing another user's booking", async () => {
    const tokenA = await registerUser('a@example.com');
    const tokenB = await registerUser('b@example.com');
    const { centre, test } = await seedCentreAndTest();

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        testId: test.id,
        centreId: centre.id,
        appointmentTime: new Date(Date.now() + 86400000).toISOString(),
      });

    const res = await request(app)
      .get(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
  });

  it('allows cancelling a pending booking but not a confirmed one', async () => {
    const token = await registerUser();
    const { centre, test } = await seedCentreAndTest();

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        testId: test.id,
        centreId: centre.id,
        appointmentTime: new Date(Date.now() + 86400000).toISOString(),
      });

    const cancelRes = await request(app)
      .post(`/api/bookings/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('CANCELLED');
  });
});
