const { run, get, all, beginTransaction, commit, rollback, toSqlDate } = require("../db/helpers");
const XLSX = require("xlsx");

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
    [gastoTotal, `COMPRA: ${nombre}`, metodo, toSqlDate(new Date()), tId, tipo]
  );
};

const normalizeKey = (key) =>
  key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const COLUMN_MAP = {
  nombre: "nombre",
  nombredelproducto: "nombre",
  producto: "nombre",
  articulo: "nombre",
  precioingreso: "precioIngreso",
  preciodeingreso: "precioIngreso",
  preciocompra: "precioIngreso",
  precioventa: "precioVenta",
  preciodeventa: "precioVenta",
  preciopublico: "precioVenta",
  precio: "precioVenta",
  cantidad: "cantidad",
  stock: "cantidad",
  descripcion: "descripcion",
  tipo: "tipo",
  subtipo: "subTipo",
  categoria: "subTipo",
};

const VALID_TYPES = ["venta", "insumo", "equipo"];

const importFromExcel = async (buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw Object.assign(new Error("El archivo no contiene hojas de cálculo"), { status: 400 });

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rows.length === 0) throw Object.assign(new Error("El archivo Excel está vacío o no tiene filas de datos"), { status: 400 });

  const normalizados = [];
  const errores = [];

  rows.forEach((row, index) => {
    const fila = index + 2;
    const mapped = {};

    for (const [rawKey, value] of Object.entries(row)) {
      const target = COLUMN_MAP[normalizeKey(rawKey)];
      if (target && mapped[target] === undefined) mapped[target] = value;
    }

    const nombre = String(mapped.nombre || "").trim();
    if (!nombre) {
      errores.push({ fila, error: "El nombre es obligatorio" });
      return;
    }

    const tipo = String(mapped.tipo || "venta").toLowerCase().trim();
    if (!VALID_TYPES.includes(tipo)) {
      errores.push({ fila, error: `Tipo inválido: '${mapped.tipo}'. Debe ser venta, insumo o equipo` });
      return;
    }

    normalizados.push({
      nombre,
      precioIngreso: Number(mapped.precioIngreso) || 0,
      precioVenta: Number(mapped.precioVenta) || 0,
      cantidad: Number(mapped.cantidad) || 0,
      descripcion: String(mapped.descripcion || "").trim(),
      imagen: null,
      tipo,
      subTipo: String(mapped.subTipo || "general").trim() || "general",
    });
  });

  await beginTransaction();
  try {
    for (const data of normalizados) {
      await create(data);
    }
    await commit();
  } catch (err) {
    await rollback();
    throw Object.assign(new Error(`Error al guardar los datos en la base de datos: ${err.message}`), { status: 500 });
  }

  return {
    total: rows.length,
    insertados: normalizados.length,
    errores,
  };
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
  importFromExcel,
};
