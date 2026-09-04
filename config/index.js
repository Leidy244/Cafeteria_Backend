require("dotenv").config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT, 10) || 3001,
  dbPath: process.env.DB_PATH || "./cafeteria.db",
  jwtSecret: process.env.JWT_SECRET || "fallback_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:5173,https://cafeteria-ivat.onrender.com").split(",").map((s) => s.trim()).filter(Boolean),
};
