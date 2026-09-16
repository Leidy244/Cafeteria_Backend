const { Pool, types } = require("pg");
const config = require("../config");

const pool = new Pool({
  connectionString: config.db.databaseUrl || undefined,
  host: config.db.databaseUrl ? undefined : config.db.host,
  port: config.db.databaseUrl ? undefined : config.db.port,
  user: config.db.databaseUrl ? undefined : config.db.user,
  password: config.db.databaseUrl ? undefined : config.db.password,
  database: config.db.databaseUrl ? undefined : config.db.database,
  max: 10,
  connectionTimeoutMillis: 10000,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
});

types.setTypeParser(1082, (v) => v);
types.setTypeParser(1114, (v) => v);
types.setTypeParser(1184, (v) => v);

const KEYMAP = {
  precioventa: "precioVenta",
  precioingreso: "precioIngreso",
  subtipo: "subTipo",
  metodopago: "metodoPago",
  montorecibido: "montoRecibido",
  turnoid: "turnoId",
  montoinicial: "montoInicial",
  montonequi: "montoNequi",
  montoefectivo: "montoEfectivo",
  montofinal: "montoFinal",
  fechaapertura: "fechaApertura",
  fechacierre: "fechaCierre",
  totalgastosefectivo: "totalGastosEfectivo",
  totalgastosnequi: "totalGastosNequi",
  fechacreacion: "fechaCreacion",
  cantidadtotal: "cantidadTotal",
  gastosefectivo: "gastosEfectivo",
  gastosnequi: "gastosNequi",
};

const remapRow = (row) => {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[KEYMAP[k] || k] = v;
  }
  return out;
};

const toSqlDate = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return value || null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

let txConn = null;

const toPostgresParams = (sql, params) => {
  let index = 0;
  let lastPos = 0;
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "?" && (i === 0 || sql[i - 1] !== "'")) {
      index += 1;
      out += sql.slice(lastPos, i) + "$" + index;
      lastPos = i + 1;
    } else if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "\\") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      i = j;
    }
  }
  out += sql.slice(lastPos);
  return out;
};

const cleanParams = (params) => (params || []).map((p) => (p === undefined ? null : p));

const run = async (sql, params = []) => {
  const conn = txConn || pool;
  const text = toPostgresParams(sql, cleanParams(params));
  const isInsert = /^\s*insert\s+/i.test(sql);

  let queryText = text;
  let result;
  if (isInsert && !/returning\b/i.test(text)) {
    queryText = `${text} RETURNING id`;
  }

  result = await conn.query(queryText, cleanParams(params));

  let lastID;
  if (isInsert) {
    lastID = result.rows && result.rows[0] ? result.rows[0].id : undefined;
  }

  return { lastID, changes: result.rowCount || 0 };
};

const get = async (sql, params = []) => {
  const conn = txConn || pool;
  const result = await conn.query(toPostgresParams(sql, cleanParams(params)), cleanParams(params));
  return remapRow(result.rows[0]) || null;
};

const all = async (sql, params = []) => {
  const conn = txConn || pool;
  const result = await conn.query(toPostgresParams(sql, cleanParams(params)), cleanParams(params));
  return result.rows.map(remapRow);
};

const serialize = async () => {
  await pool.query("SELECT 1");
};

const beginTransaction = async () => {
  if (!txConn) {
    txConn = await pool.connect();
    await txConn.query("BEGIN");
  }
  return txConn;
};

const commit = async () => {
  if (!txConn) return;
  const conn = txConn;
  txConn = null;
  await conn.query("COMMIT");
  conn.release();
};

const rollback = async () => {
  if (!txConn) return;
  const conn = txConn;
  txConn = null;
  await conn.query("ROLLBACK");
  conn.release();
};

const db = {
  close: async (cb) => {
    try {
      if (txConn) {
        await txConn.query("ROLLBACK");
        txConn.release();
        txConn = null;
      }
      await pool.end();
      if (typeof cb === "function") cb(null);
    } catch (err) {
      if (typeof cb === "function") cb(err);
    }
  },
};

module.exports = { db, run, get, all, serialize, beginTransaction, commit, rollback, toSqlDate };