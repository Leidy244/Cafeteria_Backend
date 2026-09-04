const { z } = require("zod");

const productSchema = z.object({
  body: z.object({
    nombre: z.string().min(1, "El nombre es obligatorio"),
    precioIngreso: z.coerce.number().min(0, "El precio de ingreso debe ser positivo"),
    precioVenta: z.coerce.number().min(0).optional(),
    cantidad: z.coerce.number().int().min(0).optional(),
    descripcion: z.string().optional(),
    tipo: z.enum(["venta", "insumo", "equipo"], { errorMap: () => ({ message: "Tipo inválido: debe ser venta, insumo o equipo" }) }),
    subTipo: z.string().optional(),
    metodoPago: z.enum(["efectivo", "nequi"]).optional(),
    turnoId: z.string().optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

const productUpdateSchema = z.object({
  body: z.object({
    nombre: z.string().min(1),
    precioIngreso: z.coerce.number().min(0),
    precioVenta: z.coerce.number().min(0).optional(),
    cantidad: z.coerce.number().int().min(0).optional(),
    descripcion: z.string().optional(),
    imagen: z.string().optional(),
    tipo: z.enum(["venta", "insumo", "equipo"]),
    subTipo: z.string().optional(),
  }),
  params: z.object({ id: z.string() }),
  query: z.object({}),
});

module.exports = { productSchema, productUpdateSchema };
