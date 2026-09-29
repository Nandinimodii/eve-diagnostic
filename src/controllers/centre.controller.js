const { Centre, DiagnosticTest } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

const createCentre = asyncHandler(async (req, res) => {
  const { name, location } = req.body;
  const centre = await Centre.create({ name, location });
  res.status(201).json(centre);
});

const listCentres = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = (page - 1) * limit;

  const { rows, count } = await Centre.findAndCountAll({
    include: [{ model: DiagnosticTest, as: 'tests' }],
    limit,
    offset,
    order: [['id', 'ASC']],
    distinct: true,
  });

  res.json({
    data: rows,
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  });
});

const getCentre = asyncHandler(async (req, res) => {
  const centre = await Centre.findByPk(req.params.id, {
    include: [{ model: DiagnosticTest, as: 'tests' }],
  });
  if (!centre) return res.status(404).json({ error: 'Diagnostic centre not found' });
  res.json(centre);
});

const addTestToCentre = asyncHandler(async (req, res) => {
  const centre = await Centre.findByPk(req.params.id);
  if (!centre) return res.status(404).json({ error: 'Diagnostic centre not found' });

  const { name, price } = req.body;
  const test = await DiagnosticTest.create({ name, price, centreId: centre.id });
  res.status(201).json(test);
});

const listTests = asyncHandler(async (req, res) => {
  const tests = await DiagnosticTest.findAll({ include: [{ model: Centre, as: 'centre' }] });
  res.json(tests);
});

module.exports = { createCentre, listCentres, getCentre, addTestToCentre, listTests };
