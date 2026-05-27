const express = require("express");
const router = express.Router();
const db = require("../db/database");

// 1. ESTADO Y AUTO-APERTURA
router.get("/estado", (req, res) => {
    const sqlUltima = "SELECT * FROM caja ORDER BY id DESC LIMIT 1";
    db.get(sqlUltima, [], (err, ultimaCaja) => {
        if (err) return res.status(500).json({ error: err.message });

        const ahora = new Date();
        const horaActual = ahora.getHours();
        const fechaHoy = ahora.toISOString().split('T')[0];
        const fechaUltimaApertura = ultimaCaja?.fechaApertura?.split('T')[0];

        // Lógica de auto-apertura a partir de las 7 AM
        if (ultimaCaja && ultimaCaja.estado === 'cerrado' && horaActual >= 7 && fechaUltimaApertura !== fechaHoy) {
            const sobranteAnterior = ultimaCaja.montoFinal || 0;
            const fechaApertura = ahora.toISOString();
            db.run(`INSERT INTO caja (montoInicial, fechaApertura, estado) VALUES (?, ?, 'abierto')`,
                [sobranteAnterior, fechaApertura], function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    return res.json({ id: this.lastID, estado: "abierto", montoInicial: sobranteAnterior, autoAbierta: true });
                });
        } else {
            res.json(ultimaCaja || { estado: "cerrado", montoFinal: 0 });
        }
    });
});

// En tu backend (Node.js)
router.post("/abrir", (req, res) => {
    const { montoInicial, montoNequi } = req.body;
    const fecha = new Date().toISOString();

    // Importante: Tu tabla 'caja' debe tener la columna 'montoNequi'
    const sql = `INSERT INTO caja (montoInicial, montoNequi, estado, fechaApertura) 
                 VALUES (?, ?, 'abierto', ?)`;

    db.run(sql, [montoInicial, montoNequi, fecha], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, montoInicial, montoNequi, estado: 'abierto' });
    });
});
// 3. CIERRE DE CAJA

router.put("/cerrar/:id", (req, res) => {
    const { id } = req.params;
    const { montoFinal } = req.body;
    const fechaCierre = new Date().toISOString();

    const sql = `UPDATE caja SET estado = 'cerrado', fechaCierre = ?, montoFinal = ? WHERE id = ?`;

    db.run(sql, [fechaCierre, montoFinal || 0, id], function (err) {
        if (err) {
            console.error("Error al cerrar:", err.message);
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: "No se encontró el turno de caja." });
        }

        res.json({ success: true });
    });
});

// En tu archivo de rutas (caja.js o similar)
router.get("/resumen-turno/:id", (req, res) => {
    const turnoId = req.params.id;

    const sql = `
    SELECT 
        -- 1. Ventas por método (Para los totales de arriba)
        SUM(CASE WHEN tipo = 'venta' AND metodoPago = 'efectivo' THEN total ELSE 0 END) as efectivo,
        SUM(CASE WHEN tipo = 'venta' AND metodoPago = 'nequi' THEN total ELSE 0 END) as nequi,
        
        -- 2. Gastos por método (Para las restas automáticas del saldo)
        SUM(CASE WHEN tipo IN ('insumo', 'equipo') AND metodoPago = 'efectivo' THEN total ELSE 0 END) as gastosEfectivo,
        SUM(CASE WHEN tipo IN ('insumo', 'equipo') AND metodoPago = 'nequi' THEN total ELSE 0 END) as gastosNequi,
        
        -- 3. TOTALES INDEPENDIENTES (Para que las tarjetas no se sumen entre sí) ✨ CORREGIDO
        SUM(CASE WHEN tipo = 'insumo' THEN total ELSE 0 END) as insumos,
        SUM(CASE WHEN tipo = 'equipo' THEN total ELSE 0 END) as equipos,
        
        -- 4. Total de ventas de productos
        SUM(CASE WHEN tipo = 'venta' THEN total ELSE 0 END) as productos
    FROM ventas 
    WHERE turnoId = ? AND estado = 'pagado'
`;

    db.get(sql, [turnoId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        // Enviamos todo al frontend
        res.json({
            efectivo: row.efectivo || 0,
            nequi: row.nequi || 0,
            equipos: row.equipos || 0,
            insumos: row.insumos || 0,
            productos: row.productos || 0,
            gastosEfectivo: row.gastosEfectivo || 0,
            gastosNequi: row.gastosNequi || 0
        });
    });
});

module.exports = router;