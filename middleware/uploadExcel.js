const multer = require("multer");

const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

const storage = multer.memoryStorage();

const uploadExcel = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const original = file.originalname || "";
    const ext = original.slice(original.lastIndexOf(".")).toLowerCase();
    const isExcel = ALLOWED_EXTENSIONS.includes(ext) || /\b(excel|spreadsheet)\b/.test(file.mimetype);
    if (isExcel) cb(null, true);
    else cb(Object.assign(new Error("Solo se permiten archivos Excel (.xlsx, .xls) o CSV"), { status: 400 }), false);
  },
});

module.exports = uploadExcel;