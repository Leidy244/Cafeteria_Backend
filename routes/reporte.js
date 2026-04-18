const express = require("express");
const router = express.Router();
const db = require("../db/database");

router.get("/balance-completo", (req, res) => {
  const sqlTurnoActivo = "SELECT id FROM caja WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1";

  db.get(sqlTurnoActivo, [], (err, turno) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!turno) {
      console.log("⚠️ No hay turno abierto detectado");
      return res.json({ ventas: [], gastos: [], totalVentas: 0, totalGastos: 0, utilidadNeta: 0 });
    }

    const turnoId = turno.id;
    console.log("✅ Generando reporte para Turno ID:", turnoId);

  // 2. Filtramos ventas y gastos SOLO para ese turnoId
const sqlVentas = `
    SELECT 
        nombre, 
        SUM(cantidad) as cant, /* <- CRÍTICO: SUM sumará todas las unidades vendidas */
        SUM(precioVenta * cantidad) as subtotal /* <- Multiplica precio por la cantidad real */
    FROM detalle_ventas 
    WHERE venta_id IN (
        SELECT id FROM ventas WHERE turnoId = ? AND tipo = 'venta'
    )
    GROUP BY nombre`; /* Agrupa todas las "Galletas" en una sola fila */

    // Mejoramos el JOIN asegurando que compare texto con texto
    const sqlGastos = `
      SELECT 
        v.total as monto, 
        COALESCE(p.nombre, v.mesa) as nombre, 
        v.tipo 
      FROM ventas v
      LEFT JOIN productos p ON CAST(p.id AS TEXT) = CAST(v.mesa AS TEXT)
      WHERE v.turnoId = ? 
      AND (v.tipo = 'insumo' OR v.tipo = 'equipo')`;

    db.all(sqlVentas, [turnoId], (errV, ventas) => {
      db.all(sqlGastos, [turnoId], (errG, gastos) => {
        if (errV || errG) return res.status(500).json({ error: errV?.message || errG?.message });

        const totalVentas = ventas.reduce((acc, v) => acc + (Number(v.subtotal) || 0), 0);
        const totalGastos = gastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

        console.log(`📊 Reporte: ${ventas.length} ventas, ${gastos.length} gastos encontrados.`);

        res.json({
          ventas: ventas || [],
          gastos: gastos || [],
          totalVentas,
          totalGastos,
          utilidadNeta: totalVentas - totalGastos
        });
      });
    });
  });
});

module.exports = router;