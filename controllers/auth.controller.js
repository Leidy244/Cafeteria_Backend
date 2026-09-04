const userService = require("../services/user.service");
const asyncHandler = require("../utils/asyncHandler");

const login = asyncHandler(async (req, res) => {
  const { correo, contrasena } = req.body;
  const result = await userService.login(correo, contrasena);
  res.json({ ok: true, ...result });
});

module.exports = { login };
