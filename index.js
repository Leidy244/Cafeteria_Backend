const config = require("./config");
const app = require("./app");
const { db } = require("./db/helpers");
const { initDatabase } = require("./db/database");
const { seedUsers } = require("./services/user.service");

const server = app.listen(config.port, async () => {
  console.log(`\n  Juyasia Backend v2.0`);
  console.log(`  Servidor corriendo en http://localhost:${config.port}`);
  console.log(`  Entorno: ${config.nodeEnv}\n`);
  if (config.db.databaseUrl) {
    try {
      console.log(`  DB: DATABASE_URL detectada (${new URL(config.db.databaseUrl).host})`);
    } catch {
      console.log(`  DB: DATABASE_URL detectada (formato invalido)`);
    }
  } else {
    console.log(`  DB: Sin DATABASE_URL -> host local ${config.db.host}:${config.db.port}`);
  }

  try {
    await initDatabase();
    await seedUsers();
    console.log("  Usuarios inicializados correctamente\n");
  } catch (err) {
    console.error("  Error al inicializar usuarios:", err.message);
  }
});

const shutdown = (signal) => {
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  server.close(() => {
    db.close((err) => {
      if (err) console.error("Error al cerrar la BD:", err.message);
      else console.log("Base de datos cerrada.");
      process.exit(0);
    });
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));