const saleService = require("../services/sale.service");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res) => {
  const result = await saleService.createSale(req.body);
  res.json({
    id: result.id,
    mensaje: "Venta registrada y stock actualizado",
    total: result.total,
    metodoPago: result.metodoPago,
  });
});

const shiftSummary = asyncHandler(async (req, res) => {
  const resumen = await saleService.getShiftSummary(req.params.turnoId);
  res.json(resumen);
});

const productsSold = asyncHandler(async (req, res) => {
  const rows = await saleService.getProductsSold(req.params.turnoId);
  res.json(rows);
});

const balance = asyncHandler(async (req, res) => {
  const result = await saleService.getBalance(req.params.turnoId);
  res.json(result);
});

module.exports = { create, shiftSummary, productsSold, balance };
