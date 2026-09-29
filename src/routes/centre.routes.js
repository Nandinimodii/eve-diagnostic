const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth.middleware');
const {
  createCentre,
  listCentres,
  getCentre,
  addTestToCentre,
  listTests,
} = require('../controllers/centre.controller');

const router = express.Router();

// Reading centres/tests is public — you shouldn't need an account just to
// browse what's available before deciding to sign up.
router.get('/', listCentres);
router.get('/tests/all', listTests);
router.get('/:id', getCentre);

// Creating centres/tests is treated as an admin-ish operation. There's no
// separate admin role in this assignment, so it's gated behind "logged in"
// rather than left fully open. See README for the trade-off.
router.post(
  '/',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('location').trim().notEmpty().withMessage('location is required'),
  ],
  validate,
  createCentre
);

router.post(
  '/:id/tests',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('price').isFloat({ gt: 0 }).withMessage('price must be a positive number'),
  ],
  validate,
  addTestToCentre
);

module.exports = router;
