const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Named DiagnosticTest (not "Test") to avoid confusion with the test suite,
// and because "which test does this booking belong to" reads more clearly
// in code than a bare "Test" model would.
const DiagnosticTest = sequelize.define(
  'DiagnosticTest',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    centreId: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    tableName: 'diagnostic_tests',
    timestamps: true,
  }
);

module.exports = DiagnosticTest;
