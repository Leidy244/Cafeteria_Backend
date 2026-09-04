const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const upload = require("../middleware/upload");
const { productSchema, productUpdateSchema } = require("../validators/product.validator");
const productController = require("../controllers/product.controller");

router.get("/", productController.getAll);
router.post("/", authenticate, authorize("admin"), upload.single("imagen"), validate(productSchema), productController.create);
router.put("/:id", authenticate, authorize("admin"), upload.single("imagen"), validate(productUpdateSchema), productController.update);
router.delete("/:id", authenticate, authorize("admin"), productController.remove);

module.exports = router;