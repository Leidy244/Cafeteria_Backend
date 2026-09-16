const { run, get, toSqlDate } = require("../db/helpers");
const analytics = require("./analytics.service");

const getStatus = async () => {
  const ultimaCaja = await get("SELECT * FROM caja ORDER BY id DESC LIMIT 1");
  if (!ultimaCaja) return { estado: "cerrado", montoFinal: 0 };

  const ahora = new Date();
  const horaActual = ahora.getHours();
  const fechaHoy = ahora.toISOString().split("T")[0];
  const fechaUltimaApertura = String(ultimaCaja.fechaApertura || "").substring(0, 10);

  if (ultimaCaja.estado === "cerrado" && horaActual >= 7 && fechaUltimaApertura !== fechaHoy) {
    const sobranteAnterior = ultimaCaja.montoFinal || 0;
    const fechaApertura = toSqlDate(ahora);
    const { lastID } = await run(
      `INSERT INTO caja (montoInicial, fechaApertura, estado) VALUES (?, ?, 'abierto')`,
      [sobranteAnterior, fechaApertura]
    );
    return { id: lastID, estado: "abierto", montoInicial: sobranteAnterior, autoAbierta: true };
  }

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