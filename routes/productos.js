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
    // 1. Recibimos también metodoPago del body
    const { nombre, precioIngreso, precioVenta, cantidad, descripcion, tipo, turnoId, subTipo, metodoPago } = req.body;
    const imagenRuta = req.file ? `/imagenes/${req.file.filename}` : null;

    if (!nombre || !precioIngreso || !tipo) {
        return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

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
        subTipo || "general"
    ];

    db.run(sqlProd, paramsProd, function (err) {
        if (err) {
            console.error("Error al insertar producto:", err.message);
            return res.status(500).json({ error: "Error al guardar el producto." });
        }

        const nuevoProductoId = this.lastID;
        const tipoL = tipo.toLowerCase().trim();

        // 2. LÓGICA DE DESCUENTO DE CAJA PARA INSUMOS/EQUIPO
        if (tipoL === "insumo" || tipoL === "equipo") {
            const unidades = Number(cantidad || 1);
            const precioUnitario = Number(precioIngreso);
            const gastoTotal = unidades * precioUnitario;

            // Usamos el metodoPago que viene del frontend, o por defecto efectivo
            const metodo = metodoPago || 'efectivo';

            const tId = (turnoId && turnoId !== "null" && turnoId !== "") ? turnoId : null;

            /* Guardamos el gasto en la tabla 'ventas'. 
               IMPORTANTE: Guardamos el valor como NEGATIVO para que al sumar el reporte 
               se reste del total automáticamente, o lo marcamos por el 'tipo'.
            */
            const sqlGasto = `
                INSERT INTO ventas (total, mesa, metodoPago, estado, fecha, turnoId, tipo) 
                VALUES (?, ?, ?, 'pagado', ?, 
                COALESCE(?, (SELECT id FROM caja WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1)), ?)
            `;

            // Nota: Guardamos gastoTotal (positivo) pero el 'tipo' (insumo/equipo) 
            // le dirá a tu reporte que es una salida de dinero.
            db.run(sqlGasto, [gastoTotal, `COMPRA: ${nombre}`, metodo, new Date().toISOString(), tId, tipoL], (errGasto) => {
                if (errGasto) {
                    console.error("Error al registrar gasto:", errGasto.message);
                    return res.status(201).json({ id: nuevoProductoId, mensaje: "Producto guardado, error en reporte de caja." });
                }
                return res.status(201).json({ id: nuevoProductoId, mensaje: `Compra registrada en ${metodo}.` });
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