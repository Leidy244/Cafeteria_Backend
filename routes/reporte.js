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
    // ... dentro de router.get("/balance-completo") ...

    // 1. Agregamos metodoPago a las ventas
  // 1. Consulta de ventas RECARGADA
const sqlVentas = `
    SELECT 
        dv.nombre, 
        v.metodoPago, 
        SUM(dv.cantidad) as cant, 
        SUM(dv.precioVenta * dv.cantidad) as subtotal 
    FROM detalle_ventas dv
    INNER JOIN ventas v ON dv.venta_id = v.id
    WHERE v.turnoId = ? AND v.tipo = 'venta'
    GROUP BY dv.nombre, v.metodoPago`; 
    
    // 2. Agregamos metodoPago a los gastos
    const sqlGastos = `
    SELECT 
        v.total as monto, 
        v.metodoPago, -- ✨ AGREGADO
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