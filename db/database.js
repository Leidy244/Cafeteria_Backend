const { run } = require("./helpers");

const createIndex = async (sql) => {
  try {
    await run(sql);
  } catch (err) {
    if (err.code !== "ER_DUP_KEYNAME") throw err;
  }
};

const initDatabase = async () => {
  await run(`CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre TEXT,
    precioIngreso DOUBLE,
    precioVenta DOUBLE,
    cantidad INT,
    descripcion TEXT,
    imagen TEXT,
    tipo VARCHAR(20),
    subTipo VARCHAR(50) DEFAULT 'general'
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await run(`CREATE TABLE IF NOT EXISTS ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    carrito TEXT,
    total DOUBLE NOT NULL,
    mesa VARCHAR(50) DEFAULT 'N/A',
    metodoPago VARCHAR(20) NOT NULL,
    montoRecibido DOUBLE DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pagado',
    fecha DATETIME NOT NULL,
    turnoId INT NOT NULL,
    tipo VARCHAR(20) DEFAULT 'venta'
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await run(`CREATE TABLE IF NOT EXISTS detalle_ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT,
    producto_id INT,
    nombre TEXT,
    precioIngreso DOUBLE,
    precioVenta DOUBLE,
    cantidad INT,
    subtotal DOUBLE,
    FOREIGN KEY(venta_id) REFERENCES ventas(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await run(`CREATE TABLE IF NOT EXISTS caja (
    id INT AUTO_INCREMENT PRIMARY KEY,
    montoInicial DOUBLE DEFAULT 0,
    montoEfectivo DOUBLE DEFAULT 0,
    montoNequi DOUBLE DEFAULT 0,
    totalGastosEfectivo DOUBLE DEFAULT 0,
    totalGastosNequi DOUBLE DEFAULT 0,
    montoFinal DOUBLE DEFAULT 0,
    fechaApertura DATETIME,
    fechaCierre DATETIME,
    estado VARCHAR(20) DEFAULT 'cerrado'
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await run(`CREATE TABLE IF NOT EXISTS pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mesa TEXT,
    total DOUBLE,
    carrito TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente',
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_pago DATETIME
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre TEXT NOT NULL,
    correo VARCHAR(255) UNIQUE NOT NULL,
    contrasena TEXT NOT NULL,
    rol VARCHAR(20) DEFAULT 'admin',
    activo TINYINT DEFAULT 1,
    fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await createIndex(`CREATE INDEX idx_ventas_turno ON ventas(turnoId)`);
  await createIndex(`CREATE INDEX idx_ventas_tipo ON ventas(tipo)`);
  await createIndex(`CREATE INDEX idx_detalle_venta ON detalle_ventas(venta_id)`);
  await createIndex(`CREATE INDEX idx_pedidos_estado ON pedidos(estado)`);
  await createIndex(`CREATE INDEX idx_usuarios_correo ON usuarios(correo)`);

  console.log("  Base de datos inicializada con índices");
};

module.exports = { initDatabase };