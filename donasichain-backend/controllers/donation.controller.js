const crypto = require("crypto");
const midtransClient = require("midtrans-client");
const db = require("../config/db");
const { recordDonationOnChain } = require("../config/blockchain");

const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// POST /api/donations — buat donasi baru, return snap_token ke frontend
async function createDonation(req, res) {
  const { campaign_id, amount, message } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Validasi kampanye
    const [campaigns] = await conn.query(
      "SELECT * FROM campaigns WHERE id = ? AND is_approved = TRUE",
      [campaign_id]
    );
    if (campaigns.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Kampanye tidak ditemukan atau belum disetujui." });
    }

    const campaign = campaigns[0];
    const acceptableStatuses = ["active", "extended"];
    if (!acceptableStatuses.includes(campaign.status)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Kampanye tidak menerima donasi saat ini." });
    }

    // Buat order_id unik
    const order_id = `DONASI-${campaign_id}-${req.user.id}-${Date.now()}`;

    // Ambil data user
    const [users] = await conn.query("SELECT name, email FROM users WHERE id = ?", [req.user.id]);
    const user = users[0];

    // Buat transaksi Midtrans Snap
    const midtransParam = {
      transaction_details: {
        order_id,
        gross_amount: parseInt(amount),
      },
      customer_details: {
        first_name: user.name,
        email: user.email,
      },
      item_details: [
        {
          id: `CAMPAIGN-${campaign_id}`,
          price: parseInt(amount),
          quantity: 1,
          name: `Donasi: ${campaign.title}`.substring(0, 50),
        },
      ],
    };

    const transaction = await snap.createTransaction(midtransParam);

    // Simpan donasi dengan status pending
    const [result] = await conn.query(
      `INSERT INTO donations (campaign_id, user_id, order_id, amount, snap_token, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [campaign_id, req.user.id, order_id, parseInt(amount), transaction.token, message || null]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Donasi berhasil dibuat. Selesaikan pembayaran.",
      data: {
        donation_id: result.insertId,
        order_id,
        snap_token: transaction.token,
        redirect_url: transaction.redirect_url,
        amount: parseInt(amount),
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("createDonation error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  } finally {
    conn.release();
  }
}

// POST /api/donations/webhook — notifikasi dari Midtrans
async function handleWebhook(req, res) {
  const notification = req.body;

  // 1. Verifikasi signature Midtrans
  // Format: SHA512(order_id + status_code + gross_amount + server_key)
  const signatureString =
    notification.order_id +
    notification.status_code +
    notification.gross_amount +
    process.env.MIDTRANS_SERVER_KEY;

  const expectedSignature = crypto
    .createHash("sha512")
    .update(signatureString)
    .digest("hex");

  if (notification.signature_key !== expectedSignature) {
    console.warn(`Webhook: signature tidak valid. order_id=${notification.order_id}`);
    return res.status(403).json({ success: false, message: "Signature tidak valid." });
  }

  const { order_id, transaction_status, fraud_status, payment_type, transaction_id } = notification;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 2. Cari donasi berdasarkan order_id
    const [donations] = await conn.query(
      "SELECT * FROM donations WHERE order_id = ?",
      [order_id]
    );

    if (donations.length === 0) {
      await conn.rollback();
      // Tetap return 200 agar Midtrans tidak retry terus
      return res.status(200).json({ success: false, message: "Donasi tidak ditemukan." });
    }

    const donation = donations[0];

    // 3. Cegah pemrosesan berulang — jika sudah final, abaikan
    const finalStatuses = ["success", "failed", "expired"];
    if (finalStatuses.includes(donation.payment_status)) {
      await conn.rollback();
      console.log(`Webhook: notifikasi berulang diabaikan. order_id=${order_id} status=${donation.payment_status}`);
      return res.status(200).json({ success: true, message: "Notifikasi sudah diproses sebelumnya." });
    }

    // 4. Tentukan payment_status berdasarkan notifikasi Midtrans
    let newPaymentStatus = "pending";

    if (transaction_status === "capture") {
      newPaymentStatus = fraud_status === "accept" ? "success" : "failed";
    } else if (transaction_status === "settlement") {
      newPaymentStatus = "success";
    } else if (["cancel", "deny", "failure"].includes(transaction_status)) {
      newPaymentStatus = "failed";
    } else if (transaction_status === "expire") {
      newPaymentStatus = "expired";
    } else if (transaction_status === "pending") {
      newPaymentStatus = "pending";
    }

    // 5. Update status donasi
    await conn.query(
      `UPDATE donations
       SET payment_status = ?, payment_method = ?, midtrans_transaction_id = ?, updated_at = NOW()
       WHERE order_id = ?`,
      [newPaymentStatus, payment_type || null, transaction_id || null, order_id]
    );

    // 6. Jika sukses: update collected_amount kampanye + cek target
    if (newPaymentStatus === "success") {
      await conn.query(
        "UPDATE campaigns SET collected_amount = collected_amount + ? WHERE id = ?",
        [donation.amount, donation.campaign_id]
      );

      // Cek apakah target tercapai
      const [updatedCampaign] = await conn.query(
        "SELECT * FROM campaigns WHERE id = ?",
        [donation.campaign_id]
      );
      const campaign = updatedCampaign[0];

      if (
        campaign.collected_amount >= campaign.target_amount &&
        campaign.status !== "target_reached" &&
        campaign.status !== "released"
      ) {
        await conn.query(
          "UPDATE campaigns SET status = 'target_reached' WHERE id = ?",
          [donation.campaign_id]
        );
        await conn.query(
          `INSERT INTO campaign_status_logs (campaign_id, old_status, new_status, note)
           VALUES (?, ?, 'target_reached', 'Target dana tercapai secara otomatis.')`,
          [donation.campaign_id, campaign.status]
        );
      }

      await conn.commit();

      // 7. Catat ke blockchain (async, tidak memblokir response)
      // Jalankan setelah commit agar data DB sudah konsisten
      setImmediate(async () => {
        try {
          const txHash = await recordDonationOnChain(
            donation.campaign_id,
            order_id,
            donation.amount
          );

          if (txHash) {
            await db.query(
              "UPDATE donations SET blockchain_tx_hash = ?, blockchain_status = 'recorded' WHERE order_id = ?",
              [txHash, order_id]
            );
          } else {
            await db.query(
              "UPDATE donations SET blockchain_status = 'failed' WHERE order_id = ?",
              [order_id]
            );
          }
        } catch (blockchainErr) {
          console.error("Blockchain async error:", blockchainErr.message);
          await db.query(
            "UPDATE donations SET blockchain_status = 'failed' WHERE order_id = ?",
            [order_id]
          );
        }
      });
    } else {
      await conn.commit();
    }

    return res.status(200).json({ success: true, message: "Notifikasi berhasil diproses." });
  } catch (err) {
    await conn.rollback();
    console.error("handleWebhook error:", err);
    // Tetap return 200 agar Midtrans tidak retry berulang kali
    return res.status(200).json({ success: false, message: "Terjadi kesalahan saat memproses notifikasi." });
  } finally {
    conn.release();
  }
}

// GET /api/donations/:id — detail donasi milik user yang login
async function getDonationById(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT d.id, d.order_id, d.amount, d.payment_status, d.payment_method,
              d.blockchain_tx_hash, d.blockchain_status, d.message, d.created_at,
              c.title AS campaign_title, c.id AS campaign_id
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       WHERE d.id = ? AND d.user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Donasi tidak ditemukan." });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getDonationById error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// GET /api/donations/status/:order_id — polling status donasi by order_id (untuk frontend)
async function getDonationStatusByOrderId(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT d.order_id, d.amount, d.payment_status, d.payment_method,
              d.blockchain_tx_hash, d.blockchain_status, d.updated_at,
              c.title AS campaign_title, c.id AS campaign_id
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       WHERE d.order_id = ? AND d.user_id = ?`,
      [req.params.order_id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Donasi tidak ditemukan." });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getDonationStatusByOrderId error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

module.exports = { createDonation, handleWebhook, getDonationById, getDonationStatusByOrderId };
