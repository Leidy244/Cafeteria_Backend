const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./cafeteria.db");

// Ejecutar todas las creaciones de tablas en serie
db.serialize(() => {
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
    )`, (err) => {
        if (err) console.error("Error creando productos:", err);
        else console.log("✅ Tabla productos lista");
    });

    // 2. VENTAS
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
    )`, (err) => {
        if (err) console.error("Error creando ventas:", err);
        else console.log("✅ Tabla ventas lista");
    });

    // 3. DETALLE VENTAS
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
    )`, (err) => {
        if (err) console.error("Error creando detalle_ventas:", err);
        else console.log("✅ Tabla detalle_ventas lista");
    });

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
    )`, (err) => {
        if (err) console.error("Error creando caja:", err);
        else console.log("✅ Tabla caja lista");
    });

    // 5. PEDIDOS
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesa TEXT,
        total REAL,
        carrito TEXT,
        estado TEXT DEFAULT 'pendiente',
        fecha TEXT DEFAULT CURRENT_TIMESTAMP,
        fecha_pago TEXT
    )`, (err) => {
        if (err) console.error("Error creando pedidos:", err);
        else console.log("✅ Tabla pedidos lista");
    });

    // 6. USUARIOS
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        correo TEXT UNIQUE NOT NULL,
        contrasena TEXT NOT NULL,
        rol TEXT DEFAULT 'admin',
        activo INTEGER DEFAULT 1,
        fechaCreacion TEXT DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error("Error creando usuarios:", err);
        else {
            console.log("✅ Tabla usuarios lista");
            
            // Insertar usuarios después de crear la tabla
            db.get(`SELECT id FROM usuarios WHERE correo = 'admin@juyasia.com'`, (err, row) => {
                if (!row && !err) {
                    db.run(`INSERT INTO usuarios (nombre, correo, contrasena, rol) 
                            VALUES ('Administrador', 'admin@juyasia.com', 'admin123', 'admin')`);
                    console.log("✅ Usuario admin creado");
                }
            });

            db.get(`SELECT id FROM usuarios WHERE correo = 'caja@juyasia.com'`, (err, row) => {
                if (!row && !err) {
                    db.run(`INSERT INTO usuarios (nombre, correo, contrasena, rol) 
                            VALUES ('Cajero', 'caja@juyasia.com', 'caja123', 'cajero')`);
                    console.log("✅ Usuario cajero creado");
                }
            });
        }
    });
});

module.exports = db;