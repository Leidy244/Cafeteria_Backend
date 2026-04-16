const express = require("express");
const cors = require("cors");

const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servidor funcionando 🔥");
});

// rutas
app.use("/productos", require("./routes/productos"));
app.use("/ventas", require("./routes/ventas"));
app.use("/reporte", require("./routes/reporte"));
app.use("/pedidos", require("./routes/pedidos"));
app.use("/historial-pedidos", require("./routes/historial-pedidos"));
app.use('/imagenes', express.static(path.join(__dirname, 'public/imagenes')));
app.use("/caja", require("./routes/caja"));

app.listen(3001, () => {
  console.log("Servidor corriendo en http://localhost:3001");
});