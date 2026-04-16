const express = require("express");
const router = express.Router();
const db = require("../db/database");

router.get("/", (req, res) => {
  const query = `
    SELECT 
      nombre,
      SUM(cantidad) as vendidos,
      SUM(precioVenta - precioIngreso) as ganancia
    FROM detalle_ventas
    GROUP BY nombre
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

module.exports = router;