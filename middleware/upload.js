const multer = require("multer");
const { ensureDir, imagesDir } = require("../utils/fileUtil");

ensureDir(imagesDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, imagesDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(Object.assign(new Error("Solo se permiten imágenes"), { status: 400 }), false);
  },
});

module.exports = upload;
