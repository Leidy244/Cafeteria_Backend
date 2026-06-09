const express = require("express");
const router = express.Router();
const db = require("../db/database");

/* ==========================================================================
   1. REGISTRAR VENTA, INSUMO O EQUIPO (POST /ventas)
   ========================================================================== */
router.post("/", (req, res) => {
    const { carrito, total, mesa, metodoPago, turnoId, montoRecibido } = req.body;
    
    // Iniciar transacción
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        
        // 1. Insertar la venta principal
        db.run(
            `INSERT INTO ventas (carrito, total, mesa, metodoPago, turnoId, montoRecibido, fecha, tipo) 
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'venta')`,
            [JSON.stringify(carrito), total, mesa, metodoPago, turnoId, montoRecibido],
            function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                
                const ventaId = this.lastID;
                
                // 2. Insertar cada producto en detalle_ventas Y descontar stock
                let errores = false;
                let procesosPendientes = carrito.length;
                
                if (procesosPendientes === 0) {
                    db.run("COMMIT");
                    return res.json({ id: ventaId, mensaje: "Venta registrada ✅" });
                }
                
                carrito.forEach(item => {
                    // 2a. Insertar en detalle_ventas
                    db.run(
                        `INSERT INTO detalle_ventas (venta_id, producto_id, nombre, cantidad, precioVenta, subtotal)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [ventaId, item.id, item.nombre, item.cantidad, item.precioVenta, item.precioVenta * item.cantidad],
                        function(err) {
                            if (err) {
                                errores = true;
                                console.error("Error al insertar detalle:", err);
                            }
                        }
                    );
                    
                    // 2b. Descontar stock del producto principal
                    db.run(
                        `UPDATE productos SET cantidad = MAX(0, CAST(cantidad AS INTEGER) - ?) WHERE id = ?`,
                        [item.cantidad, item.id],
                        function(err) {
                            if (err) {
                                errores = true;
                                console.error("Error al descontar producto:", err);
                            }
                            
                            // 2c. Descontar stock de pulpa si aplica
                            const tieneVinculo = item.subTipo &&
                                item.subTipo !== 'general' &&
                                item.subTipo !== 'pulpa';
                            
                            if (tieneVinculo && !errores) {
                                db.run(
                                    `UPDATE productos 
                                     SET cantidad = MAX(0, cantidad - ?)
                                     WHERE subTipo = 'pulpa' 
                                     AND LOWER(nombre) LIKE LOWER(?)`,
                                    [item.cantidad, `%${item.subTipo}%`],
                                    function(errPulpa) {
                                        if (errPulpa) {
                                            errores = true;
                                            console.error("Error al descontar pulpa:", errPulpa);
                                        }
                                        procesosPendientes--;
                                        if (procesosPendientes === 0) finalizar();
                                    }
                                );
                            } else {
                                procesosPendientes--;
                                if (procesosPendientes === 0) finalizar();
                            }
                        }
                    );
                });
                
                function finalizar() {
                    if (errores) {
                        db.run("ROLLBACK");
                        res.status(500).json({ error: "Error al descontar stock o guardar detalle" });
                    } else {
                        db.run("COMMIT");
                        res.json({ 
                            id: ventaId, 
                            mensaje: "Venta registrada y stock actualizado ✅",
                            total,
                            metodoPago
                        });
                    }
                }
            }
        );
    });
});

/* ==========================================================================
   2. RESUMEN PARA CIERRE DE CAJA
   ========================================================================== */
router.get("/resumen-turno/:turnoId", (req, res) => {
    const { turnoId } = req.params;

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
                totalAcumulado: baseInicial
            };

            filas.forEach(fila => {
                const tipo = (fila.tipo || "").toLowerCase();
                const pago = (fila.metodoPago || "").toLowerCase();
                const monto = Number(fila.total) || 0;

                if (tipo === 'venta' || tipo === 'producto' || tipo === 'productos') {
                    resumen.productos += monto;
                    if (pago === 'efectivo') {
                        resumen.efectivo += monto;
                        resumen.totalAcumulado += monto;
                    } else if (pago === 'nequi') {
                        resumen.nequi += monto;
                    }
                } else if (tipo.includes('insumo')) {
                    resumen.insumos += monto;
                    resumen.totalAcumulado -= monto;
                } else if (tipo.includes('equipo')) {
                    resumen.equipos += monto;
                    resumen.totalAcumulado -= monto;
                }
            });

            res.json(resumen);
        });
    });
});

/* ==========================================================================
   3. DETALLE DE PRODUCTOS VENDIDOS (Para reporte de cierre)
   ========================================================================== */
router.get("/detalle-productos/:turnoId", (req, res) => {
    const { turnoId } = req.params;
    const sql = `
        SELECT dv.nombre, SUM(dv.cantidad) as cantidadTotal, v.metodoPago, SUM(dv.subtotal) as total
        FROM detalle_ventas dv
        JOIN ventas v ON dv.venta_id = v.id 
        WHERE v.turnoId = ? AND v.tipo = 'venta'
        GROUP BY dv.nombre, v.metodoPago
        ORDER BY cantidadTotal DESC
    `;
    db.all(sql, [turnoId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/* ==========================================================================
   4. BALANCE FINAL DEL TURNO (Ventas vs Gastos)
   ========================================================================== */
router.get("/balance-turno/:turnoId", (req, res) => {
    const { turnoId } = req.params;

    const sqlVentas = `
        SELECT nombre, SUM(cantidad) as cantidad, SUM(subtotal) as total
        FROM detalle_ventas dv
        JOIN ventas v ON dv.venta_id = v.id
        WHERE v.turnoId = ? AND v.tipo = 'venta'
        GROUP BY nombre
        ORDER BY total DESC`;

    const sqlGastos = `
        SELECT total as monto, mesa as nombre, tipo, metodoPago, fecha
        FROM ventas 
        WHERE turnoId = ? AND (tipo = 'insumo' OR tipo = 'equipo')
        ORDER BY fecha DESC`;

    db.all(sqlVentas, [turnoId], (err, ventas) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(sqlGastos, [turnoId], (errG, gastos) => {
            if (errG) return res.status(500).json({ error: errG.message });

            const totalVentas = ventas.reduce((acc, v) => acc + (v.total || 0), 0);
            const totalGastos = gastos.reduce((acc, g) => acc + (g.monto || 0), 0);

            res.json({
                ventas,
                gastos,
                totalVentas,
                totalGastos,
                utilidadNeta: totalVentas - totalGastos
            });
        });
    });
});

module.exports = router;