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

    db.run(
        `INSERT INTO ventas (total, mesa, metodoPago, estado, fecha, turnoId, tipo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [total, mesa || "N/A", pagoNormalizado, "pagado", new Date().toISOString(), turnoId || null, tipoFinal],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const ventaId = this.lastID;

            if (!carrito || carrito.length === 0) {
                return res.json({ mensaje: `${tipoFinal} registrado ✅`, ventaId });
            }

            // Agrupamos productos para no hacer múltiples inserts del mismo item
            const productosVendidos = {};
            carrito.forEach(item => {
                const id = item.id;
                const cantidadReal = Number(item.cantidad) || 1; 

                if (!productosVendidos[id]) {
                    productosVendidos[id] = { ...item, cantidadAcumulada: 0 };
                }
                productosVendidos[id].cantidadAcumulada += cantidadReal;
            });

            const itemsUnicos = Object.values(productosVendidos);
            let completados = 0;

            itemsUnicos.forEach(prod => {
                // A. Insertar detalle de venta
                db.run(
                    `INSERT INTO detalle_ventas (venta_id, producto_id, nombre, precioIngreso, precioVenta, cantidad) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [ventaId, prod.id, prod.nombre, prod.precioIngreso, prod.precioVenta, prod.cantidadAcumulada],
                    (errDetalle) => {
                        if (errDetalle) console.error("❌ Error detalle:", errDetalle.message);

                        // B. Descuento de Stock Normal
                        // Quitamos la restricción "AND cantidad >= ?" para productos tipo 'venta' 
                        // que dependen de pulpas, así el "Jugo" puede bajar a negativo o 0 sin frenar la lógica.
                        db.run(
                            `UPDATE productos SET cantidad = cantidad - ? WHERE id = ?`,
                            [prod.cantidadAcumulada, prod.id]
                        );

                        // C. ✨ LÓGICA DE PULPAS: Descuento automático por sabor
                        // Esta es la parte que controla las 20 unidades reales de tu insumo
                        const sabores = ["Mango", "Mora", "Fresa", "Lulo", "Maracuya", "Guanabana", "Chamba"];
                        const saborEncontrado = sabores.find(s => 
                            prod.nombre.toLowerCase().includes(s.toLowerCase())
                        );

                        if (saborEncontrado) {
                            console.log(`🍓 Sabor detectado: ${saborEncontrado}. Buscando insumo...`);
                            
                            db.run(
                                `UPDATE productos 
                                 SET cantidad = cantidad - ? 
                                 WHERE subTipo = 'pulpa' 
                                 AND nombre LIKE ? 
                                 AND cantidad > 0`,
                                [prod.cantidadAcumulada, `%${saborEncontrado}%`],
                                function(errPulpa) {
                                    if (errPulpa) console.error("❌ Error pulpa:", errPulpa.message);
                                    if (this.changes > 0) {
                                        console.log(`✅ Stock REAL de Pulpa ${saborEncontrado} actualizado.`);
                                    } else {
                                        console.warn(`⚠️ No se encontró stock de pulpa para ${saborEncontrado}`);
                                    }
                                }
                            );
                        }

                        completados++;
                        if (completados === itemsUnicos.length) {
                            if (mesa && mesa !== "N/A") {
                                db.run(`DELETE FROM pedidos WHERE mesa = ?`, [mesa]);
                            }
                            return res.json({ mensaje: "Venta e inventario de pulpas sincronizados ✅", ventaId });
                        }
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
                    resumen.totalAcumulado -= monto; // Los insumos restan a la caja (gasto)
                } else if (tipo.includes('equi')) {
                    resumen.equipos += monto;
                    resumen.totalAcumulado -= monto; // Los equipos restan a la caja (gasto)
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