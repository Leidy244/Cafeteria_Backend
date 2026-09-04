const config = require("./config");
const app = require("./app");
const { db } = require("./db/helpers");
const { initDatabase } = require("./db/database");
const { seedUsers } = require("./services/user.service");

const server = app.listen(config.port, async () => {
  console.log(`\n  Juyasia Backend v2.0`);
  console.log(`  Servidor corriendo en http://localhost:${config.port}`);
  console.log(`  Entorno: ${config.nodeEnv}\n`);

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