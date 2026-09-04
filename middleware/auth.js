const jwt = require("jsonwebtoken");
const config = require("../config");
const { get } = require("../db/helpers");

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  try {
    const decoded = jwt.verify(header.split(" ")[1], config.jwtSecret);
    const user = await get("SELECT id, nombre, correo, rol, activo FROM usuarios WHERE id = ?", [decoded.id]);
    if (!user || !user.activo) {
      return res.status(401).json({ error: "Usuario no encontrado o inactivo" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "No autenticado" });
  }
  if (roles.length > 0 && !roles.includes(req.user.rol)) {
    return res.status(403).json({ error: "No tienes permiso para esta acción" });
  }
  next();
};

module.exports = { authenticate, authorize };
