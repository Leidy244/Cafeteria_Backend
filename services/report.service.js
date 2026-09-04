const analytics = require("./analytics.service");

const getFullBalance = async () => {
  const turnoId = await analytics.getCurrentTurnoId();

  if (!turnoId) {
    return { ventas: [], gastos: [], totalVentas: 0, totalGastos: 0, utilidadNeta: 0 };
  }

  return analytics.getShiftBalance(turnoId, { byPaymentMethod: true });
};

module.exports = { getFullBalance };