const errorHandler = (err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON inválido en el cuerpo de la petición" });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "El archivo excede el tamaño máximo de 25MB" });
  }

  if (err.code === "SQLITE_CONSTRAINT") {
    return res.status(409).json({ error: "Violación de restricción en la base de datos" });
  }

  res.status(err.status || 500).json({
    error: err.message || "Error interno del servidor",
  });
};

module.exports = errorHandler;
