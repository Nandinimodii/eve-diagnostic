const express = require('express');
const authRoutes = require('./auth.routes');
const centreRoutes = require('./centre.routes');
const bookingRoutes = require('./booking.routes');
const paymentRoutes = require('./payment.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/centres', centreRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);

module.exports = router;
