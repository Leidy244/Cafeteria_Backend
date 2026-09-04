const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const reportController = require("../controllers/report.controller");

router.get("/balance-completo", authenticate, reportController.fullBalance);

module.exports = router;
