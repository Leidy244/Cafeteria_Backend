const mysql = require("mysql2/promise");
const config = require("../config");

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 10000,
  dateStrings: true,
});

const toSqlDate = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return value || null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

let txConn = null;

const run = async (sql, params = []) => {
  const conn = txConn || pool;
  const [result] = await conn.execute(sql, params);
  return { lastID: result.insertId, changes: result.affectedRows };
};

const get = async (sql, params = []) => {
  const conn = txConn || pool;
  const [rows] = await conn.execute(sql, params);
  return rows[0] || null;
};

const all = async (sql, params = []) => {
  const conn = txConn || pool;
  const [rows] = await conn.execute(sql, params);
  return rows;
};

const serialize = async () => {
  await pool.query("SELECT 1");
};

const beginTransaction = async () => {
  if (!txConn) {
    txConn = await pool.getConnection();
    await txConn.beginTransaction();
  }
  return txConn;
};

const commit = async () => {
  if (!txConn) return;
  const conn = txConn;
  txConn = null;
  await conn.commit();
  conn.release();
};

const rollback = async () => {
  if (!txConn) return;
  const conn = txConn;
  txConn = null;
  await conn.rollback();
  conn.release();
};

const db = {
  close: async (cb) => {
    try {
      if (txConn) {
        await txConn.rollback();
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