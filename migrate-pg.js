const sqlite3 = require("sqlite3").verbose();
const { Pool, types } = require("pg");
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
    const m = value.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2}))?/);
    if (m) {
      const time = m[2] ? `${m[2]}:${m[3]}:${m[4]}` : "00:00:00";
      return `${m[1]} ${time}`;
    }
  }
  return value;
};

const syncSequences = async (pool) => {
  const tables = ["productos", "usuarios", "pedidos", "ventas", "detalle_ventas", "caja"];
  for (const table of tables) {
    await pool.query(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'),
                    COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`
    );
  }
};

const main = async () => {
  const sqlite = new sqlite3.Database("./cafeteria.db", sqlite3.OPEN_READONLY);

  await initDatabase();

  const pool = new Pool({
    connectionString: config.db.databaseUrl || undefined,
    host: config.db.databaseUrl ? undefined : config.db.host,
    port: config.db.databaseUrl ? undefined : config.db.port,
    user: config.db.databaseUrl ? undefined : config.db.user,
    password: config.db.databaseUrl ? undefined : config.db.password,
    database: config.db.databaseUrl ? undefined : config.db.database,
    ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
  });

  const tables = ["productos", "usuarios", "pedidos", "ventas", "detalle_ventas", "caja"];

  const conn = await pool.connect();

  try {
    for (const table of tables) {
      const rows = await new Promise((resolve, reject) =>
        sqlite.all(`SELECT * FROM ${table}`, (err, r) => (err ? reject(err) : resolve(r)))
      );
      const dateCols = new Set(DATE_COLS[table]);
      const cols = Object.keys(rows[0] || {});

      if (cols.length > 0) {
        const c = cols.map((k) => `"${k}"`).join(", ");
        const ph = cols.map((_, i) => `$${i + 1}`).join(", ");
        for (const row of rows) {
          const vals = cols.map((k) => (dateCols.has(k) ? toSqlDate(row[k]) : row[k]));
          await conn.query(`INSERT INTO "${table}" (${c}) VALUES (${ph})`, vals);
        }
      }

      console.log(`  ${table}: ${rows.length} filas migradas`);
    }

    await syncSequences(pool);
    console.log("  Secuencias sincronizadas");

    conn.release();
    await pool.end();
    sqlite.close();
    console.log("  Migración completada");
  } catch (err) {
    console.error("  Error en migración:", err.message);
    conn.release();
    await pool.end();
    sqlite.close();
    process.exit(1);
  }
};

main();