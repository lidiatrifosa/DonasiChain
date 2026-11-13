const db = require("../config/db");
const { checkCampaignDeadlines } = require("../scheduler");

// GET /api/admin/stats — statistik ringkasan untuk dashboard admin
async function getDashboardStats(req, res) {
  try {
    const [[campaignStats]] = await db.query(
      `SELECT
         COUNT(*) AS total_campaigns,
         SUM(is_approved = TRUE) AS approved_campaigns,
         SUM(is_approved = FALSE) AS pending_approval,
         SUM(status = 'active' AND is_approved = TRUE) AS active_campaigns,
         SUM(status = 'extended') AS extended_campaigns,
         SUM(status = 'target_reached') AS target_reached_campaigns,
         SUM(status = 'released') AS released_campaigns,
         SUM(status = 'ended') AS ended_campaigns
       FROM campaigns`
    );

    const [[donationStats]] = await db.query(
      `SELECT
         COUNT(*) AS total_donations,
         SUM(payment_status = 'success') AS successful_donations,
         SUM(payment_status = 'pending') AS pending_donations,
         SUM(payment_status = 'failed') AS failed_donations,
         SUM(payment_status = 'expired') AS expired_donations,
         COALESCE(SUM(CASE WHEN payment_status = 'success' THEN amount ELSE 0 END), 0) AS total_collected
       FROM donations`
    );

    const [[userStats]] = await db.query(
      `SELECT
         COUNT(*) AS total_users,
         SUM(role = 'donor') AS total_donors,
         SUM(role = 'fundraiser') AS total_fundraisers,
         SUM(role = 'admin') AS total_admins
       FROM users`
    );

    const [[blockchainStats]] = await db.query(
      `SELECT
         SUM(blockchain_status = 'recorded') AS recorded_on_chain,
         SUM(blockchain_status = 'failed') AS failed_on_chain,
         SUM(blockchain_status = 'not_recorded') AS not_recorded
       FROM donations WHERE payment_status = 'success'`
    );

    return res.status(200).json({
      success: true,
      data: {
        campaigns: campaignStats,
        donations: donationStats,
        users: userStats,
        blockchain: blockchainStats,
      },
    });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// POST /api/admin/check-deadlines — trigger cek deadline manual (untuk testing)
async function triggerDeadlineCheck(req, res) {
  try {
    await checkCampaignDeadlines();
    return res.status(200).json({
      success: true,
      message: "Pengecekan deadline kampanye selesai. Lihat log server untuk detail.",
    });
  } catch (err) {
    console.error("triggerDeadlineCheck error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

module.exports = { getDashboardStats, triggerDeadlineCheck };
