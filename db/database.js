const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./cafeteria.db");

// 1. PRODUCTOS
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

// 2. VENTAS
db.run(`CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total REAL NOT NULL,
  mesa TEXT DEFAULT 'N/A',
  metodoPago TEXT NOT NULL,
  estado TEXT DEFAULT 'pagado',
  fecha TEXT NOT NULL,
  turnoId INTEGER NOT NULL, 
  tipo TEXT DEFAULT 'venta', 
  FOREIGN KEY(turnoId) REFERENCES caja(id)
)`);

// 3. DETALLE VENTAS
db.run(`CREATE TABLE IF NOT EXISTS detalle_ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER, 
    producto_id INTEGER,
    nombre TEXT,
    precioIngreso REAL,
    precioVenta REAL,
    cantidad INTEGER,
    FOREIGN KEY(venta_id) REFERENCES ventas(id)
)`);

// 4. CAJA
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

// 5. PEDIDOS
db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa TEXT,
    total REAL,
    carrito TEXT,
    estado TEXT DEFAULT 'pendiente',
    fecha TEXT DEFAULT CURRENT_TIMESTAMP,
    fecha_pago TEXT
)`);

// 6. USUARIOS
db.run(`CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  correo TEXT UNIQUE NOT NULL,
  contrasena TEXT NOT NULL,
  rol TEXT DEFAULT 'admin',
  activo INTEGER DEFAULT 1,
  fechaCreacion TEXT DEFAULT CURRENT_TIMESTAMP
)`);

// Admin por defecto
// Admin por defecto
db.get(`SELECT id FROM usuarios WHERE correo = 'admin@juyasia.com'`, (err, row) => {
  if (!row) {
    db.run(`INSERT INTO usuarios (nombre, correo, contrasena, rol) 
            VALUES ('Administrador', 'admin@juyasia.com', 'admin123', 'admin')`);
  }
});

// Cajero por defecto
db.get(`SELECT id FROM usuarios WHERE correo = 'caja@juyasia.com'`, (err, row) => {
  if (!row) {
    db.run(`INSERT INTO usuarios (nombre, correo, contrasena, rol) 
            VALUES ('Cajero', 'caja@juyasia.com', 'caja123', 'cajero')`);
  }
});

module.exports = db;