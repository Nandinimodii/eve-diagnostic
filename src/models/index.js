const sequelize = require('../config/db');
const User = require('./user.model');
const Centre = require('./centre.model');
const DiagnosticTest = require('./test.model');
const Booking = require('./booking.model');
const Payment = require('./payment.model');
const WebhookEvent = require('./webhookEvent.model');

Centre.hasMany(DiagnosticTest, { foreignKey: 'centreId', as: 'tests' });
DiagnosticTest.belongsTo(Centre, { foreignKey: 'centreId', as: 'centre' });

User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });

DiagnosticTest.hasMany(Booking, { foreignKey: 'testId', as: 'bookings' });
Booking.belongsTo(DiagnosticTest, { foreignKey: 'testId', as: 'test' });

Centre.hasMany(Booking, { foreignKey: 'centreId', as: 'bookings' });
Booking.belongsTo(Centre, { foreignKey: 'centreId', as: 'centre' });

Booking.hasOne(Payment, { foreignKey: 'bookingId', as: 'payment' });
Payment.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

module.exports = {
  sequelize,
  User,
  Centre,
  DiagnosticTest,
  Booking,
  Payment,
  WebhookEvent,
};
