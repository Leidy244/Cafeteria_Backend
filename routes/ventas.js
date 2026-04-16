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

            // 1. Agrupamos productos para no hacer mil updates a la misma fila
            const productosVendidos = {};
            carrito.forEach(item => {
                const id = item.id;
                if (!productosVendidos[id]) {
                    productosVendidos[id] = { ...item, cantidadAcumulada: 0 };
                }
                productosVendidos[id].cantidadAcumulada += 1;
            });

            const itemsUnicos = Object.values(productosVendidos);
            let completados = 0;

            itemsUnicos.forEach(prod => {
                // A. Insertar en detalle_ventas (Tu tabla tiene estas columnas exactas)
                db.run(
                    `INSERT INTO detalle_ventas (venta_id, producto_id, nombre, precioIngreso, precioVenta, cantidad) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [ventaId, prod.id, prod.nombre, prod.precioIngreso, prod.precioVenta, prod.cantidadAcumulada],
                    (errDetalle) => {
                        if (errDetalle) console.error("❌ Error detalle:", errDetalle.message);

                        // B. DESCONTAR STOCK (La solución al infinito y al cero)
                        // Forzamos que cantidad sea tratada como número y el ID coincida
                        // B. DESCONTAR STOCK REAL (Con validación de límite)
                        db.run(
                            `UPDATE productos 
     SET cantidad = cantidad - ? 
     WHERE id = ? AND cantidad >= ?`, // Solo resta si la cantidad actual es mayor o igual a la pedida
                            [prod.cantidadTotal, prod.id, prod.cantidadTotal],
                            function (errStock) {
                                if (errStock) {
                                    console.error("❌ Error stock:", errStock.message);
                                } else {
                                    // Si this.changes es 0, significa que no se cumplió el "WHERE" (no había suficiente stock)
                                    if (this.changes === 0) {
                                        console.error(`⚠️ Stock insuficiente para el ID: ${prod.id}`);
                                        // Aquí podrías manejar un error más específico si quisieras
                                    }
                                }

                                completados++;
                                if (completados === itemsUnicos.length) {
                                    if (mesa && mesa !== "N/A") {
                                        db.run(`DELETE FROM pedidos WHERE mesa = ?`, [mesa]);
                                    }
                                    return res.json({ mensaje: "Venta y stock actualizados ✅", ventaId });
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
   2. RESUMEN PARA CIERRE DE CAJA (Insumos, Equipos, Ventas)
   ========================================================================== */
router.get("/resumen-cierre/:turnoId", (req, res) => {
    const { turnoId } = req.params;
    const sql = `
        SELECT 
            LOWER(tipo) as tipo, 
            SUM(total) as subtotal 
        FROM ventas 
        WHERE turnoId = ? 
        GROUP BY LOWER(tipo)
    `;
    db.all(sql, [turnoId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const resumen = { venta: 0, insumo: 0, equipo: 0 };
        rows.forEach(row => {
            if (resumen.hasOwnProperty(row.tipo)) {
                resumen[row.tipo] = row.subtotal;
            }
        });

        console.log("📊 Resumen Enviado:", resumen);
        res.json(resumen);
    });
});

/* ==========================================================================
   3. RESUMEN POR MÉTODO DE PAGO (Efectivo vs Nequi)
   ========================================================================== */
router.get("/resumen-pagos/:turnoId", (req, res) => {
    const { turnoId } = req.params;
    const sql = `
        SELECT 
            LOWER(metodoPago) as metodo, 
            SUM(total) as subtotal 
        FROM ventas 
        WHERE turnoId = ? AND LOWER(tipo) = 'venta'
        GROUP BY LOWER(metodoPago)
    `;
    db.all(sql, [turnoId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const pagos = { efectivo: 0, nequi: 0 };
        rows.forEach(row => {
            if (pagos.hasOwnProperty(row.metodo)) {
                pagos[row.metodo] = row.subtotal;
            }
        });
        res.json(pagos);
    });
});

/* ==========================================================================
   4. DETALLE DE PRODUCTOS VENDIDOS (Para el reporte de cierre)
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

module.exports = router;