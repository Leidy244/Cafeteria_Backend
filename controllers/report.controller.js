const reportService = require("../services/report.service");
const asyncHandler = require("../utils/asyncHandler");

const fullBalance = asyncHandler(async (_req, res) => {
  const reporte = await reportService.getFullBalance();
  res.json(reporte);
});

module.exports = { fullBalance };