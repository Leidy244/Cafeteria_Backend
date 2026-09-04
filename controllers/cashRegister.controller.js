const cashRegisterService = require("../services/cashRegister.service");
const httpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");

const getStatus = asyncHandler(async (_req, res) => {
  const estado = await cashRegisterService.getStatus();
  res.json(estado);
});

const open = asyncHandler(async (req, res) => {
  const { montoInicial, montoNequi = 0 } = req.body;
  const result = await cashRegisterService.open(req.body);
  res.json({ id: result.lastID, montoInicial, montoNequi, estado: "abierto" });
});

const close = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { montoFinal } = req.body || {};

  const result = await cashRegisterService.close(id, montoFinal);
  if (result.changes === 0) throw httpError("No se encontró el turno de caja", 404);
  res.json({ success: true });
});

const shiftSummary = asyncHandler(async (req, res) => {
  const resumen = await cashRegisterService.getShiftSummary(req.params.id);
  res.json(resumen);
});

module.exports = { getStatus, open, close, shiftSummary };