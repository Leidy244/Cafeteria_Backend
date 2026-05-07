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

router.post("/", upload.single("imagen"), (req, res) => {
    // 1. Recibimos subTipo del body
    const { nombre, precioIngreso, precioVenta, cantidad, descripcion, tipo, turnoId, subTipo } = req.body;
    const imagenRuta = req.file ? `/imagenes/${req.file.filename}` : null;

    if (!nombre || !precioIngreso || !tipo) {
        return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

    // 2. Añadimos subTipo a la consulta SQL
    const sqlProd = `INSERT INTO productos (nombre, precioIngreso, precioVenta, cantidad, descripcion, imagen, tipo, subTipo)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    const paramsProd = [
        nombre,
        Number(precioIngreso),
        Number(precioVenta || 0),
        Number(cantidad || 0),
        descripcion || "",
        imagenRuta,
        tipo.toLowerCase().trim(),
        subTipo || "general" // <--- Guardamos si es 'pulpa' o 'general'
    ];

    db.run(sqlProd, paramsProd, function (err) {
        if (err) {
            console.error("Error al insertar producto:", err.message);
            return res.status(500).json({ error: "Error al guardar el producto." });
        }

        const nuevoProductoId = this.lastID;
        const tipoL = tipo.toLowerCase().trim();

        if (tipoL === "insumo" || tipoL === "equipo") {
            const unidades = Number(cantidad || 1);
            const precioUnitario = Number(precioIngreso);
            const gastoTotal = unidades * precioUnitario;
            const tId = (turnoId && turnoId !== "null" && turnoId !== "") ? turnoId : null;

            const sqlGasto = `
                INSERT INTO ventas (total, mesa, metodoPago, estado, fecha, turnoId, tipo) 
                VALUES (?, ?, 'efectivo', 'pagado', ?, 
                COALESCE(?, (SELECT id FROM caja WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1)), ?)
            `;

            db.run(sqlGasto, [gastoTotal, nombre, new Date().toISOString(), tId, tipoL], (errGasto) => {
                if (errGasto) {
                    return res.status(201).json({ id: nuevoProductoId, mensaje: "Producto guardado, error en caja." });
                }
                return res.status(201).json({ id: nuevoProductoId, mensaje: "Producto y gasto total registrados." });
            });
        } else {
            return res.status(201).json({ id: nuevoProductoId, imagen: imagenRuta, mensaje: "Producto registrado correctamente." });
        }
    });
});

// 3. ACTUALIZAR PRODUCTO (También debe actualizar subTipo)
router.put("/:id", upload.single("imagen"), (req, res) => {
    const { nombre, precioIngreso, precioVenta, cantidad, descripcion, tipo, subTipo } = req.body;
    const { id } = req.params;

    let imagenRuta = req.body.imagen;
    if (req.file) {
        imagenRuta = `/imagenes/${req.file.filename}`;
    }

    const sql = `UPDATE productos 
                 SET nombre=?, precioIngreso=?, precioVenta=?, cantidad=?, descripcion=?, imagen=?, tipo=?, subTipo=? 
                 WHERE id=?`;

    db.run(sql, [nombre, precioIngreso, precioVenta, cantidad, descripcion, imagenRuta, tipo, subTipo, id], function (err) {
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

// Esta función se ejecuta al confirmar cualquier pedido
const descontarInventarioVariable = (productoVendido) => {
    const nombre = productoVendido.nombre.toLowerCase();
    let saborDetectado = null;

    // Lista de sabores que manejas en pulpas
    const sabores = ["mango", "mora", "chamba", "lulo", "guanabana"];

    // Buscamos si el producto vendido contiene algún sabor de pulpa
    saborDetectado = sabores.find(s => nombre.includes(s));

    if (saborDetectado) {
        // Descontamos 1 unidad del insumo que coincida con el sabor
        const sql = `
      UPDATE productos 
      SET cantidad = cantidad - 1 
      WHERE subTipo = 'pulpa' 
      AND nombre LIKE ? 
      AND cantidad > 0
    `;

        db.run(sql, [`%${saborDetectado}%`], function (err) {
            if (this.changes === 0) {
                console.warn(`⚠️ No se pudo descontar: ${saborDetectado} está agotado.`);
            }
        });
    }
};

module.exports = router;