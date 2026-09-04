const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { saleSchema } = require("../validators/sale.validator");
const saleController = require("../controllers/sale.controller");

router.post("/", validate(saleSchema), saleController.create);
router.get("/resumen-turno/:turnoId", authenticate, saleController.shiftSummary);
router.get("/detalle-productos/:turnoId", authenticate, saleController.productsSold);
router.get("/balance-turno/:turnoId", authenticate, saleController.balance);

module.exports = router;
