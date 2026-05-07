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
            [sobranteAnterior, fechaApertura], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                return res.json({ id: this.lastID, estado: "abierto", montoInicial: sobranteAnterior, autoAbierta: true });
            });
        } else {
            res.json(ultimaCaja || { estado: "cerrado", montoFinal: 0 });
        }
    });
});

// 2. APERTURA MANUAL
router.post("/abrir", (req, res) => {
    const { montoInicial } = req.body;
    db.run(`INSERT INTO caja (montoInicial, fechaApertura, estado) VALUES (?, ?, 'abierto')`, 
    [Number(montoInicial) || 0, new Date().toISOString()], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, estado: "abierto", montoInicial });
    });
});
// 3. CIERRE DE CAJA

router.put("/cerrar/:id", (req, res) => {
    const { id } = req.params;
    const { montoFinal } = req.body; 
    const fechaCierre = new Date().toISOString();
    
    const sql = `UPDATE caja SET estado = 'cerrado', fechaCierre = ?, montoFinal = ? WHERE id = ?`;
    
    db.run(sql, [fechaCierre, montoFinal || 0, id], function(err) {
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

// 4. RESUMEN DE TURNO (Optimizado)
router.get("/resumen-turno/:turnoId", (req, res) => {
    const { turnoId } = req.params;

    // 1. Primero buscamos la base inicial de este turno
    const sqlCaja = "SELECT montoInicial FROM caja WHERE id = ?";
    
    db.get(sqlCaja, [turnoId], (err, caja) => {
        if (err) return res.status(500).json({ error: err.message });

        const baseInicial = caja ? Number(caja.montoInicial) : 0;
        const sqlVentas = `SELECT tipo, metodoPago, total FROM ventas WHERE turnoId = ?`;

        db.all(sqlVentas, [turnoId], (err, filas) => {
            if (err) return res.status(500).json({ error: err.message });

            const resumen = {
                productos: 0, 
                equipos: 0, 
                insumos: 0,
                efectivo: 0, 
                nequi: 0, 
                totalAcumulado: baseInicial // Empezamos el conteo físico con la base inicial
            };

            filas.forEach(fila => {
                const tipo = (fila.tipo || "").toLowerCase();
                const pago = (fila.metodoPago || "").toLowerCase();
                const monto = Number(fila.total) || 0;

                // --- VENTAS (Productos) ---
                if (tipo === 'venta' || tipo === 'producto' || tipo === 'productos') {
                    resumen.productos += monto; // Total bruto para el cuadro negro
                    
                    if (pago.includes('efectivo')) {
                        resumen.efectivo += monto;
                        resumen.totalAcumulado += monto; // SOLO el efectivo suma al cuadro amarillo
                    } else if (pago.includes('nequi')) {
                        resumen.nequi += monto;
                        // Nequi NO se suma a totalAcumulado porque no es dinero físico
                    }
                } 
                // --- EGRESOS / GASTOS ---
                else if (tipo.includes('insu')) {
                    resumen.insumos += monto;
                    resumen.totalAcumulado -= monto; // Los gastos restan del efectivo físico
                } else if (tipo.includes('equi')) {
                    resumen.equipos += monto;
                    resumen.totalAcumulado -= monto; // Los gastos restan del efectivo físico
                }
            });

            res.json(resumen);
        });
    });
});

module.exports = router;