const productService = require("../services/product.service");
const asyncHandler = require("../utils/asyncHandler");
const { removeImage } = require("../utils/fileUtil");

const getAll = asyncHandler(async (_req, res) => {
  const productos = await productService.getAll();
  res.json(productos);
});

const create = asyncHandler(async (req, res) => {
  const imagen = req.file ? `/imagenes/${req.file.filename}` : null;
  const data = { ...req.body, imagen };

  const { lastID } = await productService.create(data);

  if (productService.isExpenseType(req.body.tipo)) {
    await productService.registerExpense(req.body, req.file);
    return res.status(201).json({
      id: lastID,
      mensaje: `Compra registrada en ${req.body.metodoPago || "efectivo"}.`,
    });
  }

  res.status(201).json({ id: lastID, imagen, mensaje: "Producto registrado correctamente." });
});

const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await productService.getById(id);
  if (!existing) throw Object.assign(new Error("Producto no encontrado"), { status: 404 });

  let imagen = existing.imagen;
  if (req.file) {
    imagen = `/imagenes/${req.file.filename}`;
    if (existing.imagen) removeImage(existing.imagen);
  }

  await productService.update(id, { ...req.body, imagen });
  res.json({ mensaje: "Actualizado correctamente", imagen });
});

const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const row = await productService.getImage(id);
  if (row && row.imagen) removeImage(row.imagen);

  await productService.remove(id);
  res.json({ mensaje: "Eliminado correctamente" });
});

module.exports = { getAll, create, update, remove };
