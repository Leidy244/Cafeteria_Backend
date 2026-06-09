const express = require("express");
const cors = require("cors");

const db = require("./db/database");
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servidor funcionando ");
});

// rutas
app.use("/productos", require("./routes/productos"));
app.use("/ventas", require("./routes/ventas"));
app.use("/reporte", require("./routes/reporte"));
app.use("/pedidos", require("./routes/pedidos"));
app.use("/historial-pedidos", require("./routes/historial-pedidos"));
app.use('/imagenes', express.static(path.join(__dirname, 'public/imagenes')));
app.use("/caja", require("./routes/caja"));

app.post("/login", (req, res) => {
  const { correo, contrasena } = req.body;

  db.get(
    `SELECT id, nombre, correo, rol FROM usuarios 
     WHERE correo = ? AND contrasena = ? AND activo = 1`,
    [correo, contrasena],
    (err, usuario) => {
      if (err) return res.status(500).json({ error: "Error del servidor" });
      if (!usuario) return res.status(401).json({ error: "Credenciales incorrectas" });

      res.json({ ok: true, usuario });
    }
  );
});

app.listen(3001, () => {
  console.log("Servidor corriendo en http://localhost:3001");
  app.use(express.static(path.join(__dirname, 'public')));
});