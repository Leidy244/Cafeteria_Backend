const { z } = require("zod");

const openCashSchema = z.object({
  body: z.object({
    montoInicial: z.coerce.number().min(0, "El monto inicial debe ser positivo"),
    montoNequi: z.coerce.number().min(0).optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

const closeCashSchema = z.object({
  body: z.object({
    montoFinal: z.coerce.number().min(0).optional(),
  }),
  params: z.object({ id: z.string() }),
  query: z.object({}),
});

module.exports = { openCashSchema, closeCashSchema };
