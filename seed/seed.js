require('dotenv').config();
const { sequelize, Centre, DiagnosticTest } = require('../src/models');

async function seed() {
  await sequelize.sync();

  const centre1 = await Centre.create({ name: 'CityCare Diagnostics', location: 'Kanpur, UP' });
  const centre2 = await Centre.create({ name: 'MetroPath Labs', location: 'Lucknow, UP' });

  await DiagnosticTest.bulkCreate([
    { name: 'Complete Blood Count (CBC)', price: 299, centreId: centre1.id },
    { name: 'Lipid Profile', price: 599, centreId: centre1.id },
    { name: 'Thyroid Panel (T3, T4, TSH)', price: 799, centreId: centre2.id },
    { name: 'HbA1c', price: 449, centreId: centre2.id },
  ]);

  console.log('Seed data inserted:');
  console.log(`  - ${centre1.name} (id ${centre1.id})`);
  console.log(`  - ${centre2.name} (id ${centre2.id})`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
