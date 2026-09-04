const { run, get, all } = require("../db/helpers");

const parseCart = (row) => {
  if (!row) return null;
  try {
    return { ...row, carrito: JSON.parse(row.carrito) };
  } catch {
    return { ...row, carrito: [] };
  }
};

const getPending = () =>
  all("SELECT * FROM pedidos WHERE estado = 'pendiente' ORDER BY fecha DESC").then((rows) =>
    rows.map(parseCart)
  );

const getHistory = () =>
  all("SELECT * FROM pedidos WHERE estado = 'pagado' ORDER BY fecha DESC").then((rows) =>
    rows.map(parseCart)
  );

const create = (data) => {
  const { carrito, total, mesa, estado } = data;
  return run(
    `INSERT INTO pedidos (carrito, total, mesa, estado, fecha)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [JSON.stringify(carrito), total, mesa, estado || "pendiente"]
  );
};

const update = (id, data) => {
  const fields = [];
  const params = [];

  if (data.carrito !== undefined) {
    fields.push("carrito = ?");
    params.push(JSON.stringify(data.carrito));
  }
  if (data.total !== undefined) {
    fields.push("total = ?");
    params.push(data.total);
  }
  if (data.mesa !== undefined) {
    fields.push("mesa = ?");
    params.push(data.mesa);
  }
  if (data.estado !== undefined) {
    fields.push("estado = ?");
    params.push(data.estado);
  }

  if (fields.length === 0) {
    return Promise.resolve({ lastID: 0, changes: 0 });
  }

  params.push(id);
  return run(`UPDATE pedidos SET ${fields.join(", ")} WHERE id = ?`, params);
};

const getById = (id) => get("SELECT * FROM pedidos WHERE id = ?", [id]);

const remove = (id) => run("DELETE FROM pedidos WHERE id = ?", [id]);

module.exports = { getPending, getHistory, create, update, getById, remove };