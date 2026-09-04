const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { openCashSchema, closeCashSchema } = require("../validators/cashRegister.validator");
const cashRegisterController = require("../controllers/cashRegister.controller");

router.get("/estado", cashRegisterController.getStatus);
router.post("/abrir", authenticate, validate(openCashSchema), cashRegisterController.open);
router.put("/cerrar/:id", authenticate, validate(closeCashSchema), cashRegisterController.close);
router.get("/resumen-turno/:id", authenticate, cashRegisterController.shiftSummary);

module.exports = router;
