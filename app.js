const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const config = require("./config");
const errorHandler = require("./middleware/errorHandler");
const validate = require("./middleware/validate");
const authController = require("./controllers/auth.controller");
const { loginSchema } = require("./validators/auth.validator");

const app = express();

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));

// Rate limiting on auth
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.use("/login", loginLimiter);

// Body parsing & logging
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// Static files
app.use("/imagenes", express.static(path.join(__dirname, "public/imagenes")));

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Authentication endpoint
app.post("/login", validate(loginSchema), authController.login);

// Mount modular route groups
app.use("/productos", require("./routes/productos"));
app.use("/ventas", require("./routes/ventas"));
app.use("/reporte", require("./routes/reporte"));
app.use("/pedidos", require("./routes/pedidos"));
app.use("/historial-pedidos", require("./routes/historial-pedidos"));
app.use("/caja", require("./routes/caja"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;