const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth.middleware');
const { initiatePayment, handleWebhook } = require('../controllers/payment.controller');

const router = express.Router();

router.post(
  '/',
  authenticate,
  [body('bookingId').isInt().withMessage('bookingId must be an integer')],
  validate,
  initiatePayment
);

// Intentionally NOT behind `authenticate` — a real payment provider calls
// this server-to-server with its own signature/secret, not a user's JWT.
// (See README for what a production version of this would add.)
router.post('/webhook', handleWebhook);

module.exports = router;
