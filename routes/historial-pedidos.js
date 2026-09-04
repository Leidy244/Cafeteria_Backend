const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const orderController = require("../controllers/order.controller");

router.get("/pagados", authenticate, orderController.getHistory);

module.exports = router;
