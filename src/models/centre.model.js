const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Centre = sequelize.define(
  'Centre',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    location: { type: DataTypes.STRING, allowNull: false },
  },
  {
    tableName: 'diagnostic_centres',
    timestamps: true,
  }
);

module.exports = Centre;
