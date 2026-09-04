const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { orderSchema, orderUpdateSchema } = require("../validators/order.validator");
const orderController = require("../controllers/order.controller");

router.get("/", orderController.getPending);
router.post("/", validate(orderSchema), orderController.create);
router.put("/:id", validate(orderUpdateSchema), orderController.update);
router.delete("/:id", authenticate, authorize("admin"), orderController.remove);

module.exports = router;