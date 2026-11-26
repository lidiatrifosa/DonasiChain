"use strict";

const router = require("express").Router();
const { body, param } = require("express-validator");
const {
  createVoluntaryDonation,
  handleVoluntaryWebhook,
  getVoluntaryStatus,
  getMyVoluntaryDonations,
} = require("../controllers/voluntary.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

// Webhook Midtrans — tidak pakai authenticate (dipanggil server Midtrans)
router.post("/webhook", handleVoluntaryWebhook);

// Buat donasi sukarela baru
router.post(
  "/",
  authenticate,
  [
    body("amount")
      .isInt({ min: 10000 })
      .withMessage("Nominal donasi minimal Rp 10.000."),
    body("message")
      .optional()
      .isLength({ max: 300 })
      .withMessage("Pesan maksimal 300 karakter."),
  ],
  validate,
  createVoluntaryDonation
);

// Riwayat donasi sukarela milik user
router.get("/my", authenticate, getMyVoluntaryDonations);

// Polling status donasi sukarela by order_id
router.get(
  "/status/:order_id",
  authenticate,
  [param("order_id").notEmpty().withMessage("order_id tidak valid.")],
  validate,
  getVoluntaryStatus
);

module.exports = router;
