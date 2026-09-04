const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "..", "public");
const imagesDir = path.join(publicDir, "imagenes");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const imagePathFromUrl = (url) => {
  if (!url) return null;
  const clean = url.startsWith("/") ? url.slice(1) : url;
  return path.join(publicDir, clean);
};

const removeImage = (imageUrl) => {
  const filePath = imagePathFromUrl(imageUrl);
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

module.exports = { ensureDir, removeImage, imagePathFromUrl, imagesDir, publicDir };
