const { Sequelize } = require('sequelize');

/**
 * In test mode we point Sequelize at an in-memory SQLite database instead of
 * a real Postgres instance. This keeps `npm test` fast and self-contained
 * (no docker/postgres required to run the suite) while the actual app still
 * runs on Postgres everywhere else. All models are written using
 * dialect-agnostic Sequelize types so this swap is safe.
 */
let sequelize;

if (process.env.NODE_ENV === 'test') {
  sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
    }
  );
}

module.exports = sequelize;
