const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth.middleware');
const {
  createBooking,
  listMyBookings,
  getBooking,
  cancelBooking,
} = require('../controllers/booking.controller');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  [
    body('testId').isInt().withMessage('testId must be an integer'),
    body('centreId').isInt().withMessage('centreId must be an integer'),
    body('appointmentTime').isISO8601().withMessage('appointmentTime must be a valid ISO8601 date'),
  ],
  validate,
  createBooking
);

router.get('/', listMyBookings);
router.get('/:id', getBooking);
router.post('/:id/cancel', cancelBooking);

module.exports = router;
