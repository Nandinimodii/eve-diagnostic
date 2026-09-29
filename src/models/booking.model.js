const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'];

const Booking = sequelize.define(
  'Booking',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    testId: { type: DataTypes.INTEGER, allowNull: false },
    centreId: { type: DataTypes.INTEGER, allowNull: false },
    appointmentTime: { type: DataTypes.DATE, allowNull: false },
    // Snapshot of the test price at booking time, so a later price change at
    // the centre doesn't silently alter what an existing booking owes.
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: {
      type: DataTypes.ENUM(...BOOKING_STATUSES),
      allowNull: false,
      defaultValue: 'PENDING',
    },
  },
  {
    tableName: 'bookings',
    timestamps: true,
  }
);

Booking.STATUSES = BOOKING_STATUSES;

module.exports = Booking;
