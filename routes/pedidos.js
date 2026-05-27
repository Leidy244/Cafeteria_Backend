const express = require("express");
const router = express.Router();
const db = require("../db/database");

// ✅ OBTENER PEDIDOS PENDIENTES
router.get("/", (req, res) => {
    db.all("SELECT * FROM pedidos WHERE estado = 'pendiente' ORDER BY fecha DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const pedidos = rows.map(row => ({ ...row, carrito: JSON.parse(row.carrito) }));
        res.json(pedidos);
    });
});

// ✅ CREAR PEDIDO NUEVO
router.post("/", (req, res) => {
    const { carrito, total, mesa, estado } = req.body;
    const carritoJSON = JSON.stringify(carrito);

    db.run(
        `INSERT INTO pedidos (carrito, total, mesa, estado) VALUES (?, ?, ?, ?)`,
        [carritoJSON, total, mesa, estado || "pendiente"],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const pedidoId = this.lastID;

            carrito.forEach(item => {
                // Descuento stock normal
                db.run(
                    `UPDATE productos SET cantidad = MAX(0, CAST(cantidad AS INTEGER) - ?) WHERE id = ?`,
                    [item.cantidad || 1, item.id]
                );

                // Descuento pulpa por subTipo
                const tieneVinculo = item.subTipo &&
                    item.subTipo !== 'general' &&
                    item.subTipo !== 'pulpa';

                if (tieneVinculo) {
                    console.log(`🍓 [POST pedido] Verificando pulpa: ${item.subTipo}`);

                    db.get(
                        `SELECT cantidad FROM productos WHERE subTipo = 'pulpa' AND LOWER(nombre) LIKE LOWER(?)`,
                        [`%${item.subTipo}%`],
                        function (errCheck, pulpa) {
                            if (!pulpa || pulpa.cantidad <= 0) {
                                console.warn(`⚠️ Sin stock de pulpa para: ${item.subTipo}`);
                                return;
                            }
                            db.run(
                                `UPDATE productos 
                                 SET cantidad = MAX(0, cantidad - ?)
                                 WHERE subTipo = 'pulpa' 
                                 AND LOWER(nombre) LIKE LOWER(?)
                                 AND cantidad > 0`,
                                [item.cantidad || 1, `%${item.subTipo}%`],
                                function (errPulpa) {
                                    if (errPulpa) console.error("❌ Error pulpa POST:", errPulpa.message);
                                    if (this.changes > 0) {
                                        console.log(`✅ Pulpa ${item.subTipo} descontada.`);
                                    } else {
                                        console.warn(`⚠️ Sin stock de pulpa para: ${item.subTipo}`);
                                    }
                                }
                            );
                        }
                    );
                }
            });

            res.json({ id: pedidoId, mensaje: "Guardado ✅" });
        }
    );
});

// ✅ ACTUALIZAR PEDIDO (descuenta solo la diferencia)
router.put("/:id", (req, res) => {
    const { carrito, total, mesa, estado } = req.body;
    const pedidoId = req.params.id;

    db.get(`SELECT carrito FROM pedidos WHERE id = ?`, [pedidoId], (err, row) => {
        if (err || !row) return res.status(500).json({ error: "No encontrado" });

        const carritoViejo = JSON.parse(row.carrito);

        db.run(
            `UPDATE pedidos SET carrito = ?, total = ?, mesa = ?, estado = ? WHERE id = ?`,
            [JSON.stringify(carrito), total, mesa, estado || "pendiente", pedidoId],
            function (errUpdate) {
                if (errUpdate) return res.status(500).json({ error: errUpdate.message });

                carrito.forEach(itemNuevo => {
                    const itemViejo = carritoViejo.find(v => v.id === itemNuevo.id);
                    const cantAnt = itemViejo ? itemViejo.cantidad : 0;
                    const dif = itemNuevo.cantidad - cantAnt;

                    if (dif > 0) {
                        // Descuento stock normal por diferencia
                        db.run(
                            `UPDATE productos SET cantidad = MAX(0, CAST(cantidad AS INTEGER) - ?) WHERE id = ?`,
                            [dif, itemNuevo.id]
                        );

                        // Descuento pulpa por diferencia y subTipo
                        const tieneVinculo = itemNuevo.subTipo &&
                            itemNuevo.subTipo !== 'general' &&
                            itemNuevo.subTipo !== 'pulpa';

                        if (tieneVinculo) {
                            console.log(`🍓 [PUT pedido] Verificando pulpa: ${itemNuevo.subTipo} (dif: ${dif})`);

                            db.get(
                                `SELECT cantidad FROM productos WHERE subTipo = 'pulpa' AND LOWER(nombre) LIKE LOWER(?)`,
                                [`%${itemNuevo.subTipo}%`],
                                function (errCheck, pulpa) {
                                    if (!pulpa || pulpa.cantidad <= 0) {
                                        console.warn(`⚠️ Sin stock de pulpa para: ${itemNuevo.subTipo}`);
                                        return;
                                    }
                                    db.run(
                                        `UPDATE productos 
                                         SET cantidad = MAX(0, cantidad - ?)
                                         WHERE subTipo = 'pulpa' 
                                         AND LOWER(nombre) LIKE LOWER(?)
                                         AND cantidad > 0`,
                                        [dif, `%${itemNuevo.subTipo}%`],
                                        function (errPulpa) {
                                            if (errPulpa) console.error("❌ Error pulpa PUT:", errPulpa.message);
                                            if (this.changes > 0) {
                                                console.log(`✅ Pulpa ${itemNuevo.subTipo} descontada (dif x${dif}).`);
                                            } else {
                                                console.warn(`⚠️ Sin stock de pulpa para: ${itemNuevo.subTipo}`);
                                            }
                                        }
                                    );
                                }
                            );
                        }
                    }
                });

                res.json({ mensaje: "Actualizado ✅" });
            }
        );
    });
});

// ✅ ELIMINAR PEDIDO
router.delete("/:id", (req, res) => {
    db.run("DELETE FROM pedidos WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Eliminado" });
    });
});

module.exports = router;