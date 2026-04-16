const express = require("express");
const router = express.Router();
const db = require("../db/database");

// 1. ESTADO Y AUTO-APERTURA (Mantenemos tu lógica que es buena)
router.get("/estado", (req, res) => {
    const sqlUltima = "SELECT * FROM caja ORDER BY id DESC LIMIT 1";
    db.get(sqlUltima, [], (err, ultimaCaja) => {
        if (err) return res.status(500).json({ error: err.message });
        const ahora = new Date();
        const horaActual = ahora.getHours();
        const fechaHoy = ahora.toISOString().split('T')[0];
        const fechaUltimaApertura = ultimaCaja?.fechaApertura?.split('T')[0];

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

// 2. APERTURA Y CIERRE
router.post("/abrir", (req, res) => {
    const { montoInicial } = req.body;
    db.run(`INSERT INTO caja (montoInicial, fechaApertura, estado) VALUES (?, ?, 'abierto')`, 
    [Number(montoInicial) || 0, new Date().toISOString()], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, estado: "abierto", montoInicial });
    });
});

router.put("/cerrar", (req, res) => {
    const { montoFinal, id } = req.body;
    db.run(`UPDATE caja SET montoFinal = ?, fechaCierre = ?, estado = 'cerrado' WHERE id = ?`, 
    [Number(montoFinal), new Date().toISOString(), id], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Caja cerrada ✅" });
    });
});

// 3. EL RESUMEN CRÍTICO (Corregido para que no de 0)
router.get("/resumen-turno/:turnoId", (req, res) => {
    const { turnoId } = req.params;

    // Traemos todo lo que pertenezca al turno
    const sql = `SELECT tipo, metodoPago, total FROM ventas WHERE turnoId = ?`;

    db.all(sql, [turnoId], (err, filas) => {
        if (err) return res.status(500).json({ error: err.message });

        const resumen = {
            productos: 0, 
            equipos: 0, 
            insumos: 0,
            efectivo: 0, 
            nequi: 0, 
            totalAcumulado: 0
        };

        filas.forEach(fila => {
            // Normalizamos a minúsculas para comparar
            const tipo = (fila.tipo || "").toLowerCase();
            const pago = (fila.metodoPago || "").toLowerCase();
            const monto = Number(fila.total) || 0;

            // Clasificación por TIPO (AQUÍ ESTABA EL ERROR)
            // Sumamos como 'productos' todo lo que sea venta normal
            if (tipo === 'venta' || tipo === 'producto' || tipo === 'productos') {
                resumen.productos += monto;
                resumen.totalAcumulado += monto;
            } else if (tipo.includes('insu')) {
                resumen.insumos += monto;
            } else if (tipo.includes('equi')) {
                resumen.equipos += monto;
            }

            // Clasificación por MÉTODO
            if (pago.includes('efectivo')) resumen.efectivo += monto;
            if (pago.includes('nequi')) resumen.nequi += monto;
        });

        res.json(resumen);
    });
});

module.exports = router;