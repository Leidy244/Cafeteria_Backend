require("dotenv").config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT, 10) || 3001,
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "cafeteria",
  },
  jwtSecret: process.env.JWT_SECRET || "fallback_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:5173,https://cafeteria-ivat.onrender.com").split(",").map((s) => s.trim()).filter(Boolean),
};
