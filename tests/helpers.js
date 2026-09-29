const { sequelize } = require('../src/models');

async function resetDb() {
  await sequelize.sync({ force: true });
}

module.exports = { resetDb, sequelize };
