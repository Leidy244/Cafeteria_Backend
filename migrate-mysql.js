const sqlite3 = require("sqlite3").verbose();
const mysql = require("mysql2/promise");
const config = require("./config");
const { initDatabase } = require("./db/database");

const DATE_COLS = {
  ventas: ["fecha"],
  caja: ["fechaApertura", "fechaCierre"],
  pedidos: ["fecha", "fecha_pago"],
  usuarios: ["fechaCreacion"],
  productos: [],
  detalle_ventas: [],
};

const toSqlDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const m = value.match(/^\d{4}-\d{2}-\d{2}(?:[T t](\d{2}):(\d{2}):(\d{2}))?/);
    if (m) {
      const time = m[1] ? `${m[1]}:${m[2]}:${m[3]}` : "00:00:00";
      return `${m[0].substring(0, 10)} ${time}`;
    }
  }
  return value;
};

const main = async () => {
  const sqlite = new sqlite3.Database("./cafeteria.db", sqlite3.OPEN_READONLY);

  await initDatabase();

  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  const tables = ["productos", "usuarios", "pedidos", "ventas", "detalle_ventas", "caja"];

  try {
    for (const table of tables) {
      const rows = await new Promise((resolve, reject) =>
        sqlite.all(`SELECT * FROM ${table}`, (err, r) => (err ? reject(err) : resolve(r)))
      );
      const dateCols = new Set(DATE_COLS[table]);

      for (const row of rows) {
        const keys = Object.keys(row);
        const cols = keys.map((k) => `\`${k}\``).join(", ");
        const ph = keys.map(() => "?").join(", ");
        const vals = keys.map((k) => (dateCols.has(k) ? toSqlDate(row[k]) : row[k]));
        await conn.execute(`INSERT INTO \`${table}\` (${cols}) VALUES (${ph})`, vals);
      }

      if (rows.length > 0) {
        const maxId = Math.max(...rows.map((r) => r.id));
        if (Number.isFinite(maxId)) {
          await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${maxId + 1}`);
        }
      }

      console.log(`  ${table}: ${rows.length} filas migradas`);
    }

    await conn.end();
    sqlite.close();
    console.log("  Migración completada");
  } catch (err) {
    console.error("  Error en migración:", err.message, err.code);
    await conn.end();
    sqlite.close();
    process.exit(1);
  }
};

main();