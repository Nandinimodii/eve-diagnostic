process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const app = require('../src/app');
const { resetDb, sequelize } = require('./helpers');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Auth', () => {
  it('signs a new user up and returns a token', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Asha Verma',
      email: 'asha@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('asha@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a signup with a duplicate email', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Asha Verma',
      email: 'asha@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/signup').send({
      name: 'Asha Verma',
      email: 'asha@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(409);
  });

  it('rejects an invalid signup payload', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: '',
      email: 'not-an-email',
      password: '123',
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('logs an existing user in', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Asha Verma',
      email: 'asha@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'asha@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with a wrong password', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Asha Verma',
      email: 'asha@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'asha@example.com',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
  });

  it('rejects login for an unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(401);
  });
});
