const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const config = require("../config");

const dbDir = path.dirname(config.dbPath);
if (dbDir && dbDir !== ".") fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(config.dbPath);

db.serialize(() => {
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA busy_timeout = 5000");
});

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

const serialize = (callback) =>
  new Promise((resolve, reject) => {
    db.serialize(() => {
      try {
        callback(db);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });

const beginTransaction = () => run("BEGIN TRANSACTION");
const commit = () => run("COMMIT");
const rollback = () => run("ROLLBACK");

module.exports = { db, run, get, all, serialize, beginTransaction, commit, rollback };