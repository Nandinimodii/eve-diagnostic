const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Every webhook delivery we accept gets a row here, keyed on the provider's
 * eventId with a unique constraint. That constraint is what actually makes
 * the webhook idempotent: a duplicate delivery fails to insert, and we treat
 * that failure as "already handled" rather than reprocessing anything.
 */
const WebhookEvent = sequelize.define(
  'WebhookEvent',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    eventId: { type: DataTypes.STRING, allowNull: false, unique: true },
    payload: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: 'webhook_events',
    timestamps: true,
  }
);

module.exports = WebhookEvent;
