const { z } = require("zod");

const loginSchema = z.object({
  body: z.object({
    correo: z.string().email("Correo inválido"),
    contrasena: z.string().min(1, "La contraseña es obligatoria"),
  }),
  params: z.object({}),
  query: z.object({}),
});

module.exports = { loginSchema };
