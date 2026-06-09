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

// ✅ CREAR PEDIDO NUEVO (SIN descontar stock)
router.post("/", (req, res) => {
    const { carrito, total, mesa, estado } = req.body;
    const carritoJSON = JSON.stringify(carrito);

    db.run(
        `INSERT INTO pedidos (carrito, total, mesa, estado, fecha) 
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [carritoJSON, total, mesa, estado || "pendiente"],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, mensaje: "Pedido guardado ✅ (sin afectar stock)" });
        }
    );
});

// ✅ ACTUALIZAR PEDIDO (SIN descontar stock) - SOLO UNA VEZ
router.put("/:id", (req, res) => {
    const { carrito, total, mesa, estado } = req.body;
    const pedidoId = req.params.id;

    db.get(`SELECT carrito FROM pedidos WHERE id = ?`, [pedidoId], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ error: "Pedido no encontrado" });
        }

        db.run(
            `UPDATE pedidos SET carrito = ?, total = ?, mesa = ?, estado = ? WHERE id = ?`,
            [JSON.stringify(carrito), total, mesa, estado || "pendiente", pedidoId],
            function (errUpdate) {
                if (errUpdate) {
                    return res.status(500).json({ error: errUpdate.message });
                }
                
                res.json({ 
                    mensaje: "Pedido actualizado ✅ (sin afectar stock)",
                    id: pedidoId 
                });
            }
        );
    });
});

// ✅ ELIMINAR PEDIDO
router.delete("/:id", (req, res) => {
    db.run("DELETE FROM pedidos WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Pedido eliminado" });
    });
});

module.exports = router;