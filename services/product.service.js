const { run, get, all } = require("../db/helpers");

const EXPENSE_TYPES = ["insumo", "equipo"];

const isExpenseType = (tipo) => {
  const t = (tipo || "").toLowerCase().trim();
  return EXPENSE_TYPES.includes(t);
};

const getAll = () => all("SELECT * FROM productos");

const getById = (id) => get("SELECT * FROM productos WHERE id = ?", [id]);

const create = (data) =>
  run(
    `INSERT INTO productos (nombre, precioIngreso, precioVenta, cantidad, descripcion, imagen, tipo, subTipo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.nombre,
      Number(data.precioIngreso),
      Number(data.precioVenta || 0),
      Number(data.cantidad || 0),
      data.descripcion || "",
      data.imagen || null,
      data.tipo.toLowerCase().trim(),
      data.subTipo || "general",
    ]
  );

const update = (id, data) =>
  run(
    `UPDATE productos
     SET nombre=?, precioIngreso=?, precioVenta=?, cantidad=?, descripcion=?, imagen=?, tipo=?, subTipo=?
     WHERE id=?`,
    [
      data.nombre,
      data.precioIngreso,
      data.precioVenta,
      data.cantidad,
      data.descripcion,
      data.imagen,
      data.tipo,
      data.subTipo,
      id,
    ]
  );

const remove = (id) => run("DELETE FROM productos WHERE id = ?", [id]);

const getImage = (id) => get("SELECT imagen FROM productos WHERE id = ?", [id]);

const registerExpense = async (data) => {
  const { nombre, precioIngreso, cantidad, metodoPago, turnoId } = data;

  const unidades = Number(cantidad || 1);
  const precioUnitario = Number(precioIngreso);
  const gastoTotal = unidades * precioUnitario;
  const tipo = data.tipo.toLowerCase().trim();
  const metodo = metodoPago || "efectivo";

  const tId = turnoId && turnoId !== "null" ? turnoId : null;

  await run(
    `INSERT INTO ventas (total, mesa, metodoPago, estado, fecha, turnoId, tipo)
     VALUES (?, ?, ?, 'pagado', ?, COALESCE(?, (SELECT id FROM caja WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1)), ?)`,
    [gastoTotal, `COMPRA: ${nombre}`, metodo, new Date().toISOString(), tId, tipo]
  );
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  getImage,
  isExpenseType,
  registerExpense,
};
