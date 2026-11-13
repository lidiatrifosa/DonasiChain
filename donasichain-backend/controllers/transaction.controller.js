const db = require("../config/db");

// GET /api/transactions/me — riwayat donasi user yang sedang login
async function getMyTransactions(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [transactions] = await db.query(
      `SELECT d.id, d.order_id, d.amount, d.payment_status, d.payment_method,
              d.blockchain_tx_hash, d.blockchain_status, d.message, d.created_at,
              c.id AS campaign_id, c.title AS campaign_title
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       WHERE d.user_id = ?
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM donations WHERE user_id = ?",
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      data: transactions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    console.error("getMyTransactions error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// GET /api/transactions/campaign/:id — riwayat donasi per kampanye (publik)
async function getCampaignTransactions(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [transactions] = await db.query(
      `SELECT d.id, d.amount, d.payment_status, d.blockchain_tx_hash,
              d.blockchain_status, d.message, d.created_at,
              u.name AS donor_name
       FROM donations d
       JOIN users u ON d.user_id = u.id
       WHERE d.campaign_id = ? AND d.payment_status = 'success'
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.params.id, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM donations WHERE campaign_id = ? AND payment_status = 'success'",
      [req.params.id]
    );

    return res.status(200).json({
      success: true,
      data: transactions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    console.error("getCampaignTransactions error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// GET /api/admin/transactions — semua transaksi (admin)
async function getAllTransactionsAdmin(req, res) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "";
    const params = [];

    if (status) {
      whereClause = "WHERE d.payment_status = ?";
      params.push(status);
    }

    const [transactions] = await db.query(
      `SELECT d.id, d.order_id, d.amount, d.payment_status, d.payment_method,
              d.midtrans_transaction_id, d.blockchain_tx_hash, d.blockchain_status,
              d.created_at, d.updated_at,
              u.name AS donor_name, u.email AS donor_email,
              c.title AS campaign_title, c.id AS campaign_id
       FROM donations d
       JOIN users u ON d.user_id = u.id
       JOIN campaigns c ON d.campaign_id = c.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM donations d ${whereClause}`,
      params
    );

    return res.status(200).json({
      success: true,
      data: transactions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    console.error("getAllTransactionsAdmin error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// GET /api/admin/reconciliation — rekonsiliasi DB vs blockchain (admin)
async function getReconciliation(req, res) {
  try {
    const [data] = await db.query(
      `SELECT d.id, d.order_id, d.amount, d.payment_status,
              d.blockchain_tx_hash, d.blockchain_status,
              c.title AS campaign_title
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       WHERE d.payment_status = 'success'
       ORDER BY d.created_at DESC`
    );

    const recorded = data.filter((d) => d.blockchain_status === "recorded").length;
    const notRecorded = data.filter((d) => d.blockchain_status !== "recorded").length;

    return res.status(200).json({
      success: true,
      summary: {
        total_success_donations: data.length,
        recorded_on_blockchain: recorded,
        not_recorded_on_blockchain: notRecorded,
      },
      data,
    });
  } catch (err) {
    console.error("getReconciliation error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

module.exports = {
  getMyTransactions,
  getCampaignTransactions,
  getAllTransactionsAdmin,
  getReconciliation,
};
