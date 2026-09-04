const { get, all } = require("../db/helpers");

const getCurrentTurnoId = () =>
  get("SELECT id FROM caja WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1").then((row) =>
    row ? row.id : null
  );

const getTurnoAggregate = (turnoId) =>
  get(
    `SELECT
       SUM(CASE WHEN tipo = 'venta' AND metodoPago = 'efectivo' THEN total ELSE 0 END) as efectivo,
       SUM(CASE WHEN tipo = 'venta' AND metodoPago = 'nequi' THEN total ELSE 0 END) as nequi,
       SUM(CASE WHEN tipo IN ('insumo','equipo') AND metodoPago = 'efectivo' THEN total ELSE 0 END) as gastosEfectivo,
       SUM(CASE WHEN tipo IN ('insumo','equipo') AND metodoPago = 'nequi' THEN total ELSE 0 END) as gastosNequi,
       SUM(CASE WHEN tipo = 'insumo' THEN total ELSE 0 END) as insumos,
       SUM(CASE WHEN tipo = 'equipo' THEN total ELSE 0 END) as equipos,
       SUM(CASE WHEN tipo = 'venta' THEN total ELSE 0 END) as productos
     FROM ventas
     WHERE turnoId = ? AND estado = 'pagado'`,
    [turnoId]
  ).then((row) => ({
    efectivo: row?.efectivo || 0,
    nequi: row?.nequi || 0,
    equipos: row?.equipos || 0,
    insumos: row?.insumos || 0,
    productos: row?.productos || 0,
    gastosEfectivo: row?.gastosEfectivo || 0,
    gastosNequi: row?.gastosNequi || 0,
  }));

const getProductsSold = (turnoId, { byPaymentMethod = false } = {}) => {
  const group = byPaymentMethod ? "dv.nombre, v.metodoPago" : "dv.nombre";
  const selection = byPaymentMethod
    ? "dv.nombre, v.metodoPago, SUM(dv.cantidad) as cant, SUM(dv.precioVenta * dv.cantidad) as subtotal"
    : "dv.nombre, SUM(dv.cantidad) as cantidad, SUM(dv.subtotal) as total";

  return all(
    `SELECT ${selection}
     FROM detalle_ventas dv
     INNER JOIN ventas v ON dv.venta_id = v.id
     WHERE v.turnoId = ? AND v.tipo = 'venta'
     GROUP BY ${group}
     ORDER BY SUM(dv.subtotal) DESC`,
    [turnoId]
  );
};

const getExpenses = (turnoId) =>
  all(
    `SELECT total as monto, mesa as nombre, tipo, metodoPago, fecha
     FROM ventas
     WHERE turnoId = ? AND (tipo = 'insumo' OR tipo = 'equipo')
     ORDER BY fecha DESC`,
    [turnoId]
  );

const getShiftBalance = async (turnoId, options = {}) => {
  const ventas = await getProductsSold(turnoId, options);
  const gastos = await getExpenses(turnoId);

  const totalVentas = ventas.reduce((acc, v) => acc + (Number(v.subtotal ?? v.total) || 0), 0);
  const totalGastos = gastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

  return { ventas, gastos, totalVentas, totalGastos, utilidadNeta: totalVentas - totalGastos };
};

module.exports = { getCurrentTurnoId, getTurnoAggregate, getProductsSold, getExpenses, getShiftBalance };