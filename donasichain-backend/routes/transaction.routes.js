const router = require("express").Router();
const { param } = require("express-validator");
const {
  getMyTransactions,
  getCampaignTransactions,
  getAllTransactionsAdmin,
  getReconciliation,
} = require("../controllers/transaction.controller");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

// Riwayat donasi user yang login
router.get("/me", authenticate, getMyTransactions);

// Riwayat donasi per kampanye (publik)
router.get(
  "/campaign/:id",
  [param("id").isInt().withMessage("ID tidak valid.")],
  validate,
  getCampaignTransactions
);

// Admin
router.get("/admin/all", authenticate, authorize("admin"), getAllTransactionsAdmin);
router.get("/admin/reconciliation", authenticate, authorize("admin"), getReconciliation);

module.exports = router;
