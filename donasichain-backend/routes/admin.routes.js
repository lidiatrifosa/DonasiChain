const router = require("express").Router();
const { getDashboardStats, triggerDeadlineCheck, getVoluntaryStats } = require("../controllers/admin.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/stats", authenticate, authorize("admin"), getDashboardStats);
router.post("/check-deadlines", authenticate, authorize("admin"), triggerDeadlineCheck);
router.get("/voluntary/stats", authenticate, authorize("admin"), getVoluntaryStats);

module.exports = router;
