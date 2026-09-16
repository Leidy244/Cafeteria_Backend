const { run } = require("./helpers");

const createIndex = async (sql) => {
  try {
    await run(sql);
  } catch (err) {
    if (err.code !== "42P07") throw err;
  }
};

const initDatabase = async () => {
  await run(`CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre TEXT,
    precioIngreso DOUBLE PRECISION,
    precioVenta DOUBLE PRECISION,
    cantidad INT,
    descripcion TEXT,
    imagen TEXT,
    tipo VARCHAR(20),
    subTipo VARCHAR(50) DEFAULT 'general'
  )`);

  await run(`CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    carrito TEXT,
    total DOUBLE PRECISION NOT NULL,
    mesa VARCHAR(50) DEFAULT 'N/A',
    metodoPago VARCHAR(20) NOT NULL,
    montoRecibido DOUBLE PRECISION DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pagado',
    fecha TIMESTAMP NOT NULL,
    turnoId INT NOT NULL,
    tipo VARCHAR(20) DEFAULT 'venta'
  )`);

  await run(`CREATE TABLE IF NOT EXISTS detalle_ventas (
    id SERIAL PRIMARY KEY,
    venta_id INT,
    producto_id INT,
    nombre TEXT,
    precioIngreso DOUBLE PRECISION,
    precioVenta DOUBLE PRECISION,
    cantidad INT,
    subtotal DOUBLE PRECISION,
    FOREIGN KEY(venta_id) REFERENCES ventas(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS caja (
    id SERIAL PRIMARY KEY,
    montoInicial DOUBLE PRECISION DEFAULT 0,
    montoEfectivo DOUBLE PRECISION DEFAULT 0,
    montoNequi DOUBLE PRECISION DEFAULT 0,
    totalGastosEfectivo DOUBLE PRECISION DEFAULT 0,
    totalGastosNequi DOUBLE PRECISION DEFAULT 0,
    montoFinal DOUBLE PRECISION DEFAULT 0,
    fechaApertura TIMESTAMP,
    fechaCierre TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'cerrado'
  )`);

  await run(`CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    mesa TEXT,
    total DOUBLE PRECISION,
    carrito TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_pago TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    correo VARCHAR(255) UNIQUE NOT NULL,
    contrasena TEXT NOT NULL,
    rol VARCHAR(20) DEFAULT 'admin',
    activo SMALLINT DEFAULT 1,
    fechaCreacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await createIndex(`CREATE INDEX IF NOT EXISTS idx_ventas_turno ON ventas(turnoId)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_ventas_tipo ON ventas(tipo)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_detalle_venta ON detalle_ventas(venta_id)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)`);
  await createIndex(`CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo)`);

  console.log("  Base de datos inicializada con índices");
};

module.exports = { initDatabase };