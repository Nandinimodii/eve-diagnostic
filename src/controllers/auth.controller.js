const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { signToken } = require('../utils/jwt');
const asyncHandler = require('../utils/asyncHandler');

const SALT_ROUNDS = 10;

const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });

  const token = signToken({ id: user.id, email: user.email });
  return res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email },
    token,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ where: { email } });
  // Deliberately identical error message for "no such user" and "wrong
  // password" so we don't leak which emails are registered.
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken({ id: user.id, email: user.email });
  return res.json({
    user: { id: user.id, name: user.name, email: user.email },
    token,
  });
});

module.exports = { signup, login };
