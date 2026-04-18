const express = require("express");
const router = express.Router();
const db = require("../db/database");
const multer = require("multer");
const path = require("path");
const fs = require('fs');

/* ==========================================================================
   CONFIGURACIÓN DE ALMACENAMIENTO (MULTER)
   ========================================================================== */
const dir = './public/imagenes';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: "public/imagenes/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });

/* ==========================================================================
   RUTAS DE PRODUCTOS
   ========================================================================== */

// 1. OBTENER TODOS LOS PRODUCTOS
router.get("/", (req, res) => {
    db.all("SELECT * FROM productos", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. CREAR PRODUCTO (Corregido: Manejo de flujo y tipos de datos)
router.post("/", upload.single("imagen"), (req, res) => {
    const { nombre, precioIngreso, precioVenta, cantidad, descripcion, tipo, turnoId } = req.body;
    const imagenRuta = req.file ? `/imagenes/${req.file.filename}` : null;

    if (!nombre || !precioIngreso || !tipo) {
        return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

    const sqlProd = `INSERT INTO productos (nombre, precioIngreso, precioVenta, cantidad, descripcion, imagen, tipo)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;

    const paramsProd = [
        nombre,
        Number(precioIngreso),
        Number(precioVenta || 0),
        Number(cantidad || 0),
        descripcion || "",
        imagenRuta,
        tipo.toLowerCase().trim()
    ];

    db.run(sqlProd, paramsProd, function (err) {
        if (err) {
            console.error("Error al insertar producto:", err.message);
            return res.status(500).json({ error: "Error al guardar el producto." });
        }

        const nuevoProductoId = this.lastID;
        const tipoL = tipo.toLowerCase().trim();

        // --- LÓGICA DE GASTO ---
       // --- LÓGICA DE GASTO (Corregida y Limpia) ---
        if (tipoL === "insumo" || tipoL === "equipo") {
            const unidades = Number(cantidad || 1);
            const precioUnitario = Number(precioIngreso);
            const gastoTotal = unidades * precioUnitario;

            const tId = (turnoId && turnoId !== "null" && turnoId !== "") ? turnoId : null;

            // Aquí es donde sucede la magia: cambiamos 'INVENTARIO' por la variable nombre
            const sqlGasto = `
                INSERT INTO ventas (total, mesa, metodoPago, estado, fecha, turnoId, tipo) 
                VALUES (?, ?, 'efectivo', 'pagado', ?, 
                COALESCE(?, (SELECT id FROM caja WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1)), ?)
            `;

            // Ejecutamos UNA SOLA VEZ el gasto con los datos reales
            db.run(sqlGasto, [
                gastoTotal, 
                nombre,       // <--- Aquí enviamos el nombre real (ej: "Café", "Leche")
                new Date().toISOString(), 
                tId, 
                tipoL
            ], (errGasto) => {
                if (errGasto) {
                    console.error("❌ Error al registrar gasto:", errGasto.message);
                    return res.status(201).json({ id: nuevoProductoId, mensaje: "Producto guardado, error en caja." });
                }
                console.log(`✅ Gasto de ${tipoL} registrado: ${nombre} por $${gastoTotal}`);
                return res.status(201).json({ id: nuevoProductoId, mensaje: "Producto y gasto total registrados." });
            });
        }
        else {
            return res.status(201).json({
                id: nuevoProductoId,
                imagen: imagenRuta,
                mensaje: "Producto registrado correctamente."
            });
        }
    });
});

// 3. ACTUALIZAR PRODUCTO (Corregido para manejar imagen previa)
router.put("/:id", upload.single("imagen"), (req, res) => {
    const { nombre, precioIngreso, precioVenta, cantidad, descripcion, tipo } = req.body;
    const { id } = req.params;

    let imagenRuta = req.body.imagen;
    if (req.file) {
        imagenRuta = `/imagenes/${req.file.filename}`;
    }

    const sql = `UPDATE productos 
                 SET nombre=?, precioIngreso=?, precioVenta=?, cantidad=?, descripcion=?, imagen=?, tipo=? 
                 WHERE id=?`;

    db.run(sql, [nombre, precioIngreso, precioVenta, cantidad, descripcion, imagenRuta, tipo, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Actualizado correctamente", imagen: imagenRuta });
    });
});

// 5. ELIMINAR PRODUCTO
router.delete("/:id", (req, res) => {
    const { id } = req.params;
    db.get("SELECT imagen FROM productos WHERE id = ?", [id], (err, row) => {
        if (row && row.imagen) {
            const pathArchivo = path.join(__dirname, '..', 'public', row.imagen);
            if (fs.existsSync(pathArchivo)) fs.unlinkSync(pathArchivo);
        }
        db.run("DELETE FROM productos WHERE id = ?", [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ mensaje: "Eliminado correctamente" });
        });
    });
});

module.exports = router;