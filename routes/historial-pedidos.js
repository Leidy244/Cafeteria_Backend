const express = require("express");
const router = express.Router();
const db = require("../db/database");

// Pedidos pagados 
router.get("/pagados", (req, res) => {
  db.all(
    "SELECT * FROM pedidos WHERE estado = 'pagado' ORDER BY fecha DESC",
    [],
    (err, rows) => {
      if (err) return res.status(500).send(err);
      const pedidos = rows.map(row => ({
        ...row,
        carrito: JSON.parse(row.carrito)
      }));
      res.json(pedidos);
    }
  );
});

module.exports = router;