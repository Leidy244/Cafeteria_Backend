const fs = require("fs");
const path = require("path");
const { db } = require("./helpers");

const dbDir = path.dirname(require("../config").dbPath);
if (dbDir && dbDir !== ".") fs.mkdirSync(dbDir, { recursive: true });

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    precioIngreso REAL,
    precioVenta REAL,
    cantidad INTEGER,
    descripcion TEXT,
    imagen TEXT,
    tipo TEXT,
    subTipo TEXT DEFAULT 'general'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carrito TEXT,
    total REAL NOT NULL,
    mesa TEXT DEFAULT 'N/A',
    metodoPago TEXT NOT NULL,
    montoRecibido REAL DEFAULT 0,
    estado TEXT DEFAULT 'pagado',
    fecha TEXT NOT NULL,
    turnoId INTEGER NOT NULL,
    tipo TEXT DEFAULT 'venta'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS detalle_ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER,
    producto_id INTEGER,
    nombre TEXT,
    precioIngreso REAL,
    precioVenta REAL,
    cantidad INTEGER,
    subtotal REAL,
    FOREIGN KEY(venta_id) REFERENCES ventas(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    montoInicial REAL DEFAULT 0,
    montoEfectivo REAL DEFAULT 0,
    montoNequi REAL DEFAULT 0,
    totalGastosEfectivo REAL DEFAULT 0,
    totalGastosNequi REAL DEFAULT 0,
    montoFinal REAL DEFAULT 0,
    fechaApertura TEXT,
    fechaCierre TEXT,
    estado TEXT DEFAULT 'cerrado'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa TEXT,
    total REAL,
    carrito TEXT,
    estado TEXT DEFAULT 'pendiente',
    fecha TEXT DEFAULT CURRENT_TIMESTAMP,
    fecha_pago TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT UNIQUE NOT NULL,
    contrasena TEXT NOT NULL,
    rol TEXT DEFAULT 'admin',
    activo INTEGER DEFAULT 1,
    fechaCreacion TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Indexes for performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_ventas_turno ON ventas(turnoId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ventas_tipo ON ventas(tipo)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_detalle_venta ON detalle_ventas(venta_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo)`);

  console.log("  Base de datos inicializada con índices");
});

module.exports = db;