const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED'];

const Payment = sequelize.define(
  'Payment',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    bookingId: { type: DataTypes.INTEGER, allowNull: false },
    // Stand-in for whatever id a real gateway (Razorpay/Stripe/etc.) would
    // give us back. The webhook looks payments up by this field.
    providerPaymentId: { type: DataTypes.STRING, allowNull: false, unique: true },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: {
      type: DataTypes.ENUM(...PAYMENT_STATUSES),
      allowNull: false,
      defaultValue: 'PENDING',
    },
  },
  {
    tableName: 'payments',
    timestamps: true,
  }
);

Payment.STATUSES = PAYMENT_STATUSES;

module.exports = Payment;
