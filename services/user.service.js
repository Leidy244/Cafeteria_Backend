const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { get, run } = require("../db/helpers");

const login = async (correo, contrasena) => {
  const usuario = await get(
    "SELECT id, nombre, correo, contrasena, rol, activo FROM usuarios WHERE correo = ? AND activo = 1",
    [correo]
  );

  if (!usuario) {
    throw Object.assign(new Error("Credenciales incorrectas"), { status: 401 });
  }

  const valid = await bcrypt.compare(contrasena, usuario.contrasena);
  if (!valid) {
    throw Object.assign(new Error("Credenciales incorrectas"), { status: 401 });
  }

  const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  return {
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
  };
};

const hashPassword = (password) => bcrypt.hash(password, config.bcryptRounds);

const isBcryptHash = (value) => typeof value === "string" && value.startsWith("$2") && value.length >= 60;

const ensureUser = async ({ nombre, correo, contrasena, rol }) => {
  const existing = await get("SELECT id, contrasena FROM usuarios WHERE correo = ?", [correo]);

  if (!existing) {
    const hash = await hashPassword(contrasena);
    await run("INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES (?, ?, ?, ?)", [
      nombre,
      correo,
      hash,
      rol,
    ]);
    console.log(`  Usuario ${rol} (${correo}) creado`);
    return;
  }

  if (!isBcryptHash(existing.contrasena)) {
    const hash = await hashPassword(contrasena);
    await run("UPDATE usuarios SET contrasena = ? WHERE id = ?", [hash, existing.id]);
    console.log(`  Usuario ${rol} (${correo}): contraseña heredada corregida`);
  }
};

const seedUsers = async () => {
  await ensureUser({ nombre: "Administrador", correo: "admin@juyasia.com", contrasena: "admin123", rol: "admin" });
  await ensureUser({ nombre: "Cajero", correo: "caja@juyasia.com", contrasena: "caja123", rol: "cajero" });
};

module.exports = { login, hashPassword, seedUsers };
