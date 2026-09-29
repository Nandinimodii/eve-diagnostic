const { Booking, DiagnosticTest, Centre, Payment } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

const createBooking = asyncHandler(async (req, res) => {
  const { testId, centreId, appointmentTime } = req.body;

  // The test must actually belong to the given centre — otherwise a client
  // could book "MRI scan" (real test) at a centre that only offers blood
  // work, at whatever price it fabricates.
  const test = await DiagnosticTest.findOne({ where: { id: testId, centreId } });
  if (!test) {
    return res.status(404).json({ error: 'Diagnostic test not found at the given centre' });
  }

  const appointment = new Date(appointmentTime);
  if (Number.isNaN(appointment.getTime()) || appointment < new Date()) {
    return res.status(400).json({ error: 'appointmentTime must be a valid date/time in the future' });
  }

  const booking = await Booking.create({
    userId: req.user.id,
    testId: test.id,
    centreId,
    appointmentTime: appointment,
    amount: test.price,
    status: 'PENDING',
  });

  res.status(201).json(booking);
});

const listMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.findAll({
    where: { userId: req.user.id },
    include: [
      { model: DiagnosticTest, as: 'test' },
      { model: Centre, as: 'centre' },
      { model: Payment, as: 'payment' },
    ],
    order: [['id', 'DESC']],
  });
  res.json(bookings);
});

const getBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findByPk(req.params.id, {
    include: [
      { model: DiagnosticTest, as: 'test' },
      { model: Centre, as: 'centre' },
      { model: Payment, as: 'payment' },
    ],
  });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.userId !== req.user.id) {
    return res.status(403).json({ error: 'You do not have access to this booking' });
  }
  res.json(booking);
});

const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findByPk(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.userId !== req.user.id) {
    return res.status(403).json({ error: 'You do not have access to this booking' });
  }
  if (booking.status === 'CONFIRMED') {
    return res
      .status(409)
      .json({ error: 'A confirmed (paid) booking cannot be cancelled through this endpoint' });
  }

  booking.status = 'CANCELLED';
  await booking.save();
  res.json(booking);
});

module.exports = { createBooking, listMyBookings, getBooking, cancelBooking };
