const express = require("express");
const router = express.Router();
const db = require("../db/database");

/* ==========================================================================
   1. REGISTRAR VENTA, INSUMO O EQUIPO (POST /ventas)
   ========================================================================== */
router.post("/", (req, res) => {
    const { carrito, total, mesa, metodoPago, turnoId, tipo } = req.body;
    const pagoNormalizado = metodoPago ? metodoPago.toLowerCase().trim() : "efectivo";
    const tipoFinal = tipo || "venta";

    // A. Insertamos la cabecera de la venta
    db.run(
        `INSERT INTO ventas (total, mesa, metodoPago, estado, fecha, turnoId, tipo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [total, mesa || "N/A", pagoNormalizado, "pagado", new Date().toISOString(), turnoId || null, tipoFinal],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const ventaId = this.lastID;

            // Si es un gasto simple sin carrito de productos
            if (!carrito || carrito.length === 0) {
                return res.json({ mensaje: `${tipoFinal} registrado ✅`, ventaId });
            }

            // 1. Agrupamos productos usando la cantidad real que viene del frontend
            const productosVendidos = {};
            carrito.forEach(item => {
                const id = item.id;
                // Usamos item.cantidad (lo que el usuario eligió) o 1 por defecto
                const cantidadReal = Number(item.cantidad) || 1; 

                if (!productosVendidos[id]) {
                    productosVendidos[id] = { ...item, cantidadAcumulada: 0 };
                }
                
                // Sumamos la cantidad real al acumulado
                productosVendidos[id].cantidadAcumulada += cantidadReal;
            });

            const itemsUnicos = Object.values(productosVendidos);
            let completados = 0;

            // 2. Procesamos cada producto único para actualizar stock y detalles
            itemsUnicos.forEach(prod => {
                
                // B. Insertar en detalle_ventas con la cantidad acumulada real
                db.run(
                    `INSERT INTO detalle_ventas (venta_id, producto_id, nombre, precioIngreso, precioVenta, cantidad) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [ventaId, prod.id, prod.nombre, prod.precioIngreso, prod.precioVenta, prod.cantidadAcumulada],
                    (errDetalle) => {
                        if (errDetalle) console.error("❌ Error detalle:", errDetalle.message);

                        // C. Descontar del stock la cantidad acumulada (ej: las 5 galletas de una vez)
                        db.run(
                            `UPDATE productos 
                             SET cantidad = cantidad - ? 
                             WHERE id = ? AND cantidad >= ?`,
                            [prod.cantidadAcumulada, prod.id, prod.cantidadAcumulada],
                            function (errStock) {
                                if (errStock) {
                                    console.error("❌ Error stock:", errStock.message);
                                } else if (this.changes === 0) {
                                    console.warn(`⚠️ Stock insuficiente para ID: ${prod.id}`);
                                }

                                completados++;
                                // Cuando todos los productos terminan, respondemos y limpiamos pedidos
                                if (completados === itemsUnicos.length) {
                                    if (mesa && mesa !== "N/A") {
                                        db.run(`DELETE FROM pedidos WHERE mesa = ?`, [mesa]);
                                    }
                                    return res.json({ mensaje: "Venta y stock actualizados correctamente ✅", ventaId });
                                }
                            }
                        );
                    }
                );
            });
        }
    );
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
                    if (pago.includes('efectivo')) {
                        resumen.efectivo += monto;
                        resumen.totalAcumulado += monto;
                    } else if (pago.includes('nequi')) {
                        resumen.nequi += monto;
                    }
                } 
                else if (tipo.includes('insu')) {
                    resumen.insumos += monto;
                    resumen.totalAcumulado -= monto;
                } else if (tipo.includes('equi')) {
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
        SELECT dv.nombre, SUM(dv.cantidad) as cantidadTotal, v.metodoPago
        FROM detalle_ventas dv
        JOIN ventas v ON dv.venta_id = v.id 
        WHERE v.turnoId = ?
        GROUP BY dv.nombre, v.metodoPago
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
        SELECT nombre, SUM(cantidad) as cant, SUM(precioVenta * cantidad) as subtotal 
        FROM detalle_ventas 
        WHERE venta_id IN (SELECT id FROM ventas WHERE turnoId = ? AND tipo = 'venta')
        GROUP BY nombre`;

    const sqlGastos = `
        SELECT total as monto, mesa as nombre, tipo 
        FROM ventas 
        WHERE turnoId = ? AND (tipo = 'insumo' OR tipo = 'equipo')`;

    db.all(sqlVentas, [turnoId], (err, ventas) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(sqlGastos, [turnoId], (errG, gastos) => {
            if (errG) return res.status(500).json({ error: errG.message });

            const totalVentas = ventas.reduce((acc, v) => acc + (v.subtotal || 0), 0);
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