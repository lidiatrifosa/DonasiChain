const router = require("express").Router();
const { getDashboardStats, triggerDeadlineCheck } = require("../controllers/admin.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/stats", authenticate, authorize("admin"), getDashboardStats);
router.post("/check-deadlines", authenticate, authorize("admin"), triggerDeadlineCheck);

module.exports = router;
