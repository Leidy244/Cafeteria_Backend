const { run, get, toSqlDate } = require("../db/helpers");
const analytics = require("./analytics.service");

const getStatus = async () => {
  const ultimaCaja = await get("SELECT * FROM caja ORDER BY id DESC LIMIT 1");
  if (!ultimaCaja) return { estado: "cerrado", montoFinal: 0 };
  return ultimaCaja;
};

const open = (data) => {
  const { montoInicial, montoNequi } = data;
  const fecha = toSqlDate(new Date());
  return run(
    `INSERT INTO caja (montoInicial, montoNequi, estado, fechaApertura) VALUES (?, ?, 'abierto', ?)`,
    [montoInicial, montoNequi, fecha]
  );
};

const close = (id, montoFinal) =>
  run(`UPDATE caja SET estado = 'cerrado', fechaCierre = ?, montoFinal = ? WHERE id = ?`, [
    toSqlDate(new Date()),
    montoFinal || 0,
    id,
  ]);

const getShiftSummary = (turnoId) => analytics.getTurnoAggregate(turnoId);

module.exports = { getStatus, open, close, getShiftSummary };