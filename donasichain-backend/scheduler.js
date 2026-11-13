const cron = require("node-cron");
const db = require("./config/db");
const { updateCampaignStatusOnChain } = require("./config/blockchain");

// ============================================================
// Scheduler DonasiChain
// Berjalan setiap hari pukul 00:05 WIB
// Mengecek kampanye yang deadline-nya sudah lewat
// ============================================================

function startScheduler() {
  // Setiap hari pukul 00:05
  cron.schedule("5 0 * * *", checkCampaignDeadlines, { timezone: "Asia/Jakarta" });
  console.log("Scheduler aktif: cek deadline kampanye setiap hari pukul 00:05 WIB.");
}

async function checkCampaignDeadlines() {
  console.log("[Scheduler] Mulai cek deadline kampanye...");
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // 1. Kampanye 'active' yang deadline-nya sudah lewat dan target belum tercapai
    //    → ubah ke 'extended' (perpanjangan 7 hari)
    const [toExtend] = await conn.query(
      `SELECT id, status, deadline, collected_amount, target_amount
       FROM campaigns
       WHERE status = 'active'
         AND is_approved = TRUE
         AND deadline < ?
         AND collected_amount < target_amount`,
      [today]
    );

    for (const campaign of toExtend) {
      const extensionDays = parseInt(process.env.CAMPAIGN_EXTENSION_DAYS) || 7;
      await conn.query(
        `UPDATE campaigns
         SET status = 'extended',
             extended_deadline = DATE_ADD(deadline, INTERVAL ? DAY)
         WHERE id = ?`,
        [extensionDays, campaign.id]
      );
      await conn.query(
        `INSERT INTO campaign_status_logs (campaign_id, old_status, new_status, note)
         VALUES (?, 'active', 'extended', 'Deadline awal terlewat, kampanye diperpanjang otomatis.')`,
        [campaign.id]
      );
      console.log(`[Scheduler] Kampanye #${campaign.id} diperpanjang ${extensionDays} hari.`);

      // Update status di blockchain (fire and forget)
      updateCampaignStatusOnChain(campaign.id, "EXTENDED").catch((err) =>
        console.error(`[Scheduler] Blockchain updateStatus gagal untuk kampanye #${campaign.id}:`, err.message)
      );
    }

    // 2. Kampanye 'extended' yang extended_deadline-nya sudah lewat dan target belum tercapai
    //    → ubah ke 'ended'
    const [toEnd] = await conn.query(
      `SELECT id, status
       FROM campaigns
       WHERE status = 'extended'
         AND is_approved = TRUE
         AND extended_deadline < ?
         AND collected_amount < target_amount`,
      [today]
    );

    for (const campaign of toEnd) {
      await conn.query(
        "UPDATE campaigns SET status = 'ended' WHERE id = ?",
        [campaign.id]
      );
      await conn.query(
        `INSERT INTO campaign_status_logs (campaign_id, old_status, new_status, note)
         VALUES (?, 'extended', 'ended', 'Masa perpanjangan berakhir, target tidak tercapai.')`,
        [campaign.id]
      );
      console.log(`[Scheduler] Kampanye #${campaign.id} berakhir (target tidak tercapai).`);

      updateCampaignStatusOnChain(campaign.id, "ENDED").catch((err) =>
        console.error(`[Scheduler] Blockchain updateStatus gagal untuk kampanye #${campaign.id}:`, err.message)
      );
    }

    await conn.commit();
    console.log(
      `[Scheduler] Selesai. Diperpanjang: ${toExtend.length}, Berakhir: ${toEnd.length}.`
    );
  } catch (err) {
    await conn.rollback();
    console.error("[Scheduler] Error saat cek deadline:", err.message);
  } finally {
    conn.release();
  }
}

// Export checkCampaignDeadlines agar bisa dipanggil manual (untuk testing/admin)
module.exports = { startScheduler, checkCampaignDeadlines };
