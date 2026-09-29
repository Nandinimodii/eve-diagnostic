const { v4: uuidv4 } = require('uuid');
const { Booking, Payment, WebhookEvent, sequelize } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

// Stand-in for a call out to a real payment gateway. Biased towards success
// so manual testing doesn't spend forever hitting FAILED by chance.
function simulatePaymentOutcome() {
  return Math.random() < 0.8 ? 'SUCCESS' : 'FAILED';
}

/**
 * POST /payments/
 * Kicks off a "payment" for a booking the caller owns. This is the
 * synchronous half of the flow — in a real integration this would redirect
 * to a gateway and the *actual* confirmation would arrive later via the
 * webhook below. Here we just resolve it immediately.
 */
const initiatePayment = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;

  const result = await sequelize.transaction(async (t) => {
    const booking = await Booking.findByPk(bookingId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!booking) {
      const err = new Error('Booking not found');
      err.status = 404;
      throw err;
    }
    if (booking.userId !== req.user.id) {
      const err = new Error('You do not have access to this booking');
      err.status = 403;
      throw err;
    }
    if (booking.status === 'CANCELLED') {
      const err = new Error('Cannot pay for a cancelled booking');
      err.status = 409;
      throw err;
    }

    const existingPayment = await Payment.findOne({ where: { bookingId: booking.id }, transaction: t });
    if (existingPayment && existingPayment.status === 'SUCCESS') {
      const err = new Error('This booking has already been paid for');
      err.status = 409;
      throw err;
    }

    const outcome = simulatePaymentOutcome();
    const providerPaymentId = `sim_${uuidv4()}`;

    const payment = existingPayment
      ? await existingPayment.set({ status: outcome, providerPaymentId }).save({ transaction: t })
      : await Payment.create(
          { bookingId: booking.id, providerPaymentId, amount: booking.amount, status: outcome },
          { transaction: t }
        );

    booking.status = outcome === 'SUCCESS' ? 'CONFIRMED' : 'FAILED';
    await booking.save({ transaction: t });

    return { booking, payment };
  });

  res.status(201).json(result);
});

/**
 * POST /payments/webhook
 * Simulates a payment provider notifying us of a status change out-of-band.
 *
 * Idempotency strategy: every inbound event carries an `eventId`. We try to
 * INSERT that id into webhook_events (unique constraint) *inside the same
 * transaction* as the state change. If the insert fails because the id is
 * already there, we know this exact event was already applied and we
 * short-circuit — no double payment rows, no re-flipping booking status,
 * no partial updates. If the insert succeeds, we're the first (and only)
 * caller to apply this event, and the whole thing commits atomically.
 */
const handleWebhook = asyncHandler(async (req, res) => {
  const { eventId, providerPaymentId, status } = req.body;

  if (!eventId || !providerPaymentId || !['SUCCESS', 'FAILED'].includes(status)) {
    return res
      .status(400)
      .json({ error: 'eventId, providerPaymentId, and a status of SUCCESS or FAILED are required' });
  }

  try {
    const result = await sequelize.transaction(async (t) => {
      await WebhookEvent.create({ eventId, payload: req.body }, { transaction: t });

      const payment = await Payment.findOne({
        where: { providerPaymentId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!payment) {
        const err = new Error('No payment found for the given providerPaymentId');
        err.status = 404;
        throw err;
      }

      payment.status = status;
      await payment.save({ transaction: t });

      const booking = await Booking.findByPk(payment.bookingId, { transaction: t, lock: t.LOCK.UPDATE });
      if (booking && booking.status !== 'CANCELLED') {
        booking.status = status === 'SUCCESS' ? 'CONFIRMED' : 'FAILED';
        await booking.save({ transaction: t });
      }

      return { payment, booking };
    });

    return res.status(200).json({ message: 'Webhook processed', payment: result.payment });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      // Duplicate delivery of an event we've already handled — acknowledge
      // it so the provider stops retrying, but don't touch any state again.
      return res.status(200).json({ message: 'Event already processed' });
    }
    throw err;
  }
});

module.exports = { initiatePayment, handleWebhook };
