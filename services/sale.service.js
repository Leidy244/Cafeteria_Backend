const { run, get, all, beginTransaction, commit, rollback } = require("../db/helpers");
const analytics = require("./analytics.service");

const createSale = async (data) => {
  const { carrito, total, mesa, metodoPago, turnoId, montoRecibido } = data;

  await beginTransaction();
  try {
    const { lastID: ventaId } = await run(
      `INSERT INTO ventas (carrito, total, mesa, metodoPago, turnoId, montoRecibido, fecha, tipo)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'venta')`,
      [JSON.stringify(carrito), total, mesa, metodoPago, turnoId, montoRecibido]
    );

    for (const item of carrito) {
      await run(
        `INSERT INTO detalle_ventas (venta_id, producto_id, nombre, cantidad, precioVenta, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ventaId, item.id, item.nombre, item.cantidad, item.precioVenta, item.precioVenta * item.cantidad]
      );

      await run(
        `UPDATE productos SET cantidad = MAX(0, CAST(cantidad AS INTEGER) - ?) WHERE id = ?`,
        [item.cantidad, item.id]
      );

      const tieneVinculo = item.subTipo && item.subTipo !== "general" && item.subTipo !== "pulpa";
      if (tieneVinculo) {
        await run(
          `UPDATE productos SET cantidad = MAX(0, cantidad - ?)
           WHERE subTipo = 'pulpa' AND LOWER(nombre) LIKE LOWER(?)`,
          [item.cantidad, `%${item.subTipo}%`]
        );
      }
    }

    await commit();
    return { id: ventaId, total, metodoPago };
  } catch (err) {
    await rollback();
    throw err;
  }
};

const getShiftSummary = async (turnoId) => {
  const caja = await get("SELECT montoInicial FROM caja WHERE id = ?", [turnoId]);
  const baseInicial = caja ? Number(caja.montoInicial) : 0;

  const resumen = await analytics.getTurnoAggregate(turnoId);
  resumen.totalAcumulado = baseInicial + resumen.efectivo - resumen.insumos - resumen.equipos;

  return resumen;
};

const getProductsSold = (turnoId) =>
  all(
    `SELECT dv.nombre, SUM(dv.cantidad) as cantidadTotal, v.metodoPago, SUM(dv.subtotal) as total
     FROM detalle_ventas dv
     JOIN ventas v ON dv.venta_id = v.id
     WHERE v.turnoId = ? AND v.tipo = 'venta'
     GROUP BY dv.nombre, v.metodoPago
     ORDER BY cantidadTotal DESC`,
    [turnoId]
  );

const getBalance = (turnoId) => analytics.getShiftBalance(turnoId, { byPaymentMethod: false });

module.exports = { createSale, getShiftSummary, getProductsSold, getBalance };