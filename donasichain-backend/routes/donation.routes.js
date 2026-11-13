const router = require("express").Router();
const { body, param } = require("express-validator");
const { createDonation, handleWebhook, getDonationById, getDonationStatusByOrderId } = require("../controllers/donation.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

// Webhook Midtrans — tidak pakai authenticate (dipanggil oleh server Midtrans)
router.post("/webhook", handleWebhook);

// Buat donasi baru
router.post(
  "/",
  authenticate,
  [
    body("campaign_id").isInt({ min: 1 }).withMessage("campaign_id tidak valid."),
    body("amount").isInt({ min: 10000 }).withMessage("Nominal donasi minimal Rp 10.000."),
    body("message").optional().isLength({ max: 300 }).withMessage("Pesan maksimal 300 karakter."),
  ],
  validate,
  createDonation
);

// Polling status donasi by order_id (untuk frontend setelah redirect dari Midtrans)
router.get(
  "/status/:order_id",
  authenticate,
  [param("order_id").notEmpty().withMessage("order_id tidak valid.")],
  validate,
  getDonationStatusByOrderId
);

// Detail donasi milik user by ID
router.get(
  "/:id",
  authenticate,
  [param("id").isInt().withMessage("ID tidak valid.")],
  validate,
  getDonationById
);

module.exports = router;
