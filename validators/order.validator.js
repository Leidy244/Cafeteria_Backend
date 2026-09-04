const { z } = require("zod");

const orderItemSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  cantidad: z.number().int().min(1),
  precioVenta: z.number().min(0),
});

const orderBodySchema = z.object({
  carrito: z.array(orderItemSchema).min(1, "El carrito debe tener al menos un item"),
  total: z.number().min(0),
  mesa: z.string().optional(),
  estado: z.enum(["pendiente", "pagado", "cancelado"]).optional(),
});

const orderSchema = z.object({
  body: orderBodySchema,
  params: z.object({}),
  query: z.object({}),
});

const orderUpdateSchema = z.object({
  body: z
    .object({
      carrito: z.array(orderItemSchema).min(1, "El carrito debe tener al menos un item"),
      total: z.number().min(0),
      mesa: z.string().optional(),
      estado: z.enum(["pendiente", "pagado", "cancelado"]).optional(),
    })
    .partial(),
  params: z.object({ id: z.string() }),
  query: z.object({}),
});

module.exports = { orderSchema, orderUpdateSchema };