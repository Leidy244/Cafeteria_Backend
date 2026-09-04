const { z } = require("zod");

const cartItemSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  cantidad: z.number().int().min(1),
  precioVenta: z.number().min(0),
  subTipo: z.string().optional(),
});

const saleSchema = z.object({
  body: z.object({
    carrito: z.array(cartItemSchema).min(1, "El carrito debe tener al menos un item"),
    total: z.number().min(0, "El total debe ser positivo"),
    mesa: z.string().optional(),
    metodoPago: z.enum(["efectivo", "nequi"], { errorMap: () => ({ message: "Método de pago inválido" }) }),
    turnoId: z.coerce.number(),
    montoRecibido: z.number().min(0).optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

module.exports = { saleSchema };
