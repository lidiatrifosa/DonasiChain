"use strict";

const midtransClient = require("midtrans-client");
const db = require("../config/db");
const {
  verifyWebhookSignature,
  mapMidtransStatus,
  isFinalPaymentStatus,
  applySnapTokenVisibility,
  webhookAmountMatchesDb,
} = require("../utils/payment.helpers");

// Gunakan instance Snap yang sama dengan konfigurasi existing
const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

const VALID_AMOUNTS = [10000, 25000, 50000, 100000];
const MIN_AMOUNT = 10000;

// POST /api/voluntary — buat donasi sukarela baru
async function createVoluntaryDonation(req, res) {
  const { amount, message } = req.body;
  const parsedAmount = parseInt(amount);

  // Validasi nominal di backend — tidak percaya frontend
  if (!amount || isNaN(parsedAmount) || parsedAmount < MIN_AMOUNT) {
    return res.status(400).json({
      success: false,
      message: `Nominal donasi minimal Rp ${MIN_AMOUNT.toLocaleString("id-ID")}.`,
    });
  }

  if (message && message.length > 300) {
    return res.status(400).json({
      success: false,
      message: "Pesan maksimal 300 karakter.",
    });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [users] = await conn.query(
      "SELECT name, email FROM users WHERE id = ?",
      [req.user.id]
    );

    if (users.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
    }

    const user = users[0];
    const order_id = `VOLUNTARY-${req.user.id}-${Date.now()}`;

    const midtransParam = {
      transaction_details: {
        order_id,
        gross_amount: parsedAmount,
      },
      customer_details: {
        first_name: user.name,
        email: user.email,
      },
      item_details: [
        {
          id: "VOLUNTARY-PLATFORM",
          price: parsedAmount,
          quantity: 1,
          name: "Donasi Sukarela DonasiChain".substring(0, 50),
        },
      ],
    };

    const transaction = await snap.createTransaction(midtransParam);

    await conn.query(
      `INSERT INTO voluntary_donations (user_id, order_id, amount, snap_token, message)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, order_id, parsedAmount, transaction.token, message || null]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Donasi sukarela berhasil dibuat. Selesaikan pembayaran.",
      data: {
        order_id,
        snap_token: transaction.token,
        redirect_url: transaction.redirect_url,
        amount: parsedAmount,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("createVoluntaryDonation error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  } finally {
    conn.release();
  }
}

// POST /api/voluntary/webhook — notifikasi Midtrans untuk donasi sukarela
async function handleVoluntaryWebhook(req, res) {
  const notification = req.body;

  // Hanya proses order_id dengan prefix VOLUNTARY
  if (!notification.order_id || !notification.order_id.startsWith("VOLUNTARY-")) {
    return res.status(200).json({ success: false, message: "Bukan order voluntary." });
  }

  if (!verifyWebhookSignature(notification, process.env.MIDTRANS_SERVER_KEY)) {
    console.warn(`VoluntaryWebhook: signature tidak valid. order_id=${notification.order_id}`);
    return res.status(403).json({ success: false, message: "Signature tidak valid." });
  }

  const { order_id, transaction_status, fraud_status, payment_type, transaction_id } = notification;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT * FROM voluntary_donations WHERE order_id = ? FOR UPDATE",
      [order_id]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(200).json({ success: false, message: "Donasi sukarela tidak ditemukan." });
    }

    const donation = rows[0];

    if (!webhookAmountMatchesDb(notification.gross_amount, donation.amount)) {
      await conn.rollback();
      console.warn(`VoluntaryWebhook: nominal tidak cocok. order_id=${order_id}`);
      return res.status(200).json({ success: false, message: "Nominal tidak cocok." });
    }

    // Idempotency — abaikan jika status sudah final
    if (isFinalPaymentStatus(donation.payment_status)) {
      await conn.rollback();
      console.log(`VoluntaryWebhook: notifikasi berulang diabaikan. order_id=${order_id} status=${donation.payment_status}`);
      return res.status(200).json({ success: true, message: "Notifikasi sudah diproses sebelumnya." });
    }

    const newPaymentStatus = mapMidtransStatus(transaction_status, fraud_status);

    await conn.query(
      `UPDATE voluntary_donations
       SET payment_status = ?, payment_method = ?, midtrans_transaction_id = ?, updated_at = NOW()
       WHERE order_id = ?`,
      [newPaymentStatus, payment_type || null, transaction_id || null, order_id]
    );

    await conn.commit();

    if (newPaymentStatus === "success") {
      console.log(`VoluntaryWebhook: donasi sukarela berhasil. order_id=${order_id} amount=${donation.amount}`);
    }

    return res.status(200).json({ success: true, message: "Notifikasi berhasil diproses." });
  } catch (err) {
    await conn.rollback();
    console.error("handleVoluntaryWebhook error:", err);
    return res.status(200).json({ success: false, message: "Terjadi kesalahan saat memproses notifikasi." });
  } finally {
    conn.release();
  }
}

// GET /api/voluntary/status/:order_id — polling status pembayaran
async function getVoluntaryStatus(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT vd.order_id, vd.amount, vd.payment_status, vd.payment_method,
              vd.snap_token, vd.midtrans_transaction_id, vd.message,
              vd.created_at, vd.updated_at
       FROM voluntary_donations vd
       WHERE vd.order_id = ? AND vd.user_id = ?`,
      [req.params.order_id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Donasi sukarela tidak ditemukan." });
    }

    return res.status(200).json({
      success: true,
      data: applySnapTokenVisibility(rows[0]),
    });
  } catch (err) {
    console.error("getVoluntaryStatus error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// GET /api/voluntary/my — riwayat donasi sukarela milik user
async function getMyVoluntaryDonations(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(
      `SELECT id, order_id, amount, payment_status, payment_method,
              midtrans_transaction_id, message, created_at, updated_at
       FROM voluntary_donations
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM voluntary_donations WHERE user_id = ?",
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    console.error("getMyVoluntaryDonations error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

module.exports = {
  createVoluntaryDonation,
  handleVoluntaryWebhook,
  getVoluntaryStatus,
  getMyVoluntaryDonations,
};
