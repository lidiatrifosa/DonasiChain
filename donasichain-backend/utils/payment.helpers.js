"use strict";

const crypto = require("crypto");

function verifyWebhookSignature(notification, serverKey) {
  const raw = notification.order_id + notification.status_code + notification.gross_amount + serverKey;
  const expected = crypto.createHash("sha512").update(raw).digest("hex");
  const received = String(notification.signature_key || "").padStart(128, "0");
  return received === expected;
}

function mapMidtransStatus(transaction_status, fraud_status) {
  if (transaction_status === "capture") {
    if (fraud_status === "accept") return "success";
    if (fraud_status === "challenge") return "pending";
    return "failed";
  }
  if (transaction_status === "settlement") return "success";
  if (["cancel", "deny", "failure"].includes(transaction_status)) return "failed";
  if (transaction_status === "expire") return "expired";
  if (transaction_status === "pending") return "pending";
  return "pending";
}

function isFinalPaymentStatus(paymentStatus) {
  return ["success", "failed", "expired"].includes(paymentStatus);
}

function applySnapTokenVisibility(donation) {
  if (donation.payment_status !== "pending") {
    delete donation.snap_token;
  }
  return donation;
}

function webhookAmountMatchesDb(grossAmountStr, dbAmount) {
  if (
    typeof grossAmountStr !== "string" ||
    !/^\d+(\.\d{1,2})?$/.test(grossAmountStr)
  ) {
    return false;
  }

  const parsed = Number(grossAmountStr);

  if (!Number.isFinite(parsed) || !Number.isSafeInteger(Number(dbAmount))) {
    return false;
  }

  return parsed === Number(dbAmount);
}

module.exports = {
  verifyWebhookSignature,
  mapMidtransStatus,
  isFinalPaymentStatus,
  applySnapTokenVisibility,
  webhookAmountMatchesDb,
};
