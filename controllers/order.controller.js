const orderService = require("../services/order.service");
const httpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");

const getPending = asyncHandler(async (_req, res) => {
  const pedidos = await orderService.getPending();
  res.json(pedidos);
});

const getHistory = asyncHandler(async (_req, res) => {
  const pedidos = await orderService.getHistory();
  res.json(pedidos);
});

const create = asyncHandler(async (req, res) => {
  const result = await orderService.create(req.body);
  res.json({ id: result.lastID, mensaje: "Pedido guardado (sin afectar stock)" });
});

const update = asyncHandler(async (req, res) => {
  const existing = await orderService.getById(req.params.id);
  if (!existing) throw httpError("Pedido no encontrado", 404);

  await orderService.update(req.params.id, req.body);
  res.json({ mensaje: "Pedido actualizado (sin afectar stock)", id: req.params.id });
});

const remove = asyncHandler(async (req, res) => {
  const result = await orderService.remove(req.params.id);
  if (result.changes === 0) throw httpError("Pedido no encontrado", 404);
  res.json({ mensaje: "Pedido eliminado" });
});

module.exports = { getPending, getHistory, create, update, remove };