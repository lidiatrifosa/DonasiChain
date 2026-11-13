const db = require("../config/db");

// Helper: catat perubahan status kampanye
async function logStatusChange(conn, campaignId, oldStatus, newStatus, changedBy = null, note = null) {
  await conn.query(
    "INSERT INTO campaign_status_logs (campaign_id, old_status, new_status, changed_by, note) VALUES (?, ?, ?, ?, ?)",
    [campaignId, oldStatus, newStatus, changedBy, note]
  );
}

// GET /api/campaigns — daftar kampanye yang sudah disetujui (publik)
async function getCampaigns(req, res) {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "WHERE c.is_approved = TRUE";
    const params = [];

    if (status) {
      whereClause += " AND c.status = ?";
      params.push(status);
    }

    const [campaigns] = await db.query(
      `SELECT c.id, c.title, c.description, c.target_amount, c.collected_amount,
              c.deadline, c.extended_deadline, c.status, c.image_url,
              c.created_at, u.name AS fundraiser_name
       FROM campaigns c
       JOIN users u ON c.user_id = u.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM campaigns c ${whereClause}`,
      params
    );

    return res.status(200).json({
      success: true,
      data: campaigns,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    console.error("getCampaigns error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// GET /api/campaigns/:id — detail kampanye (publik)
async function getCampaignById(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT c.*, u.name AS fundraiser_name
       FROM campaigns c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ? AND c.is_approved = TRUE`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Kampanye tidak ditemukan." });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getCampaignById error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// POST /api/campaigns — buat kampanye baru (fundraiser)
async function createCampaign(req, res) {
  const { title, description, target_amount, deadline, image_url } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO campaigns (user_id, title, description, target_amount, deadline, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, title, description, target_amount, deadline, image_url || null]
    );

    return res.status(201).json({
      success: true,
      message: "Kampanye berhasil dibuat dan menunggu persetujuan admin.",
      data: { id: result.insertId, title, status: "active", is_approved: false },
    });
  } catch (err) {
    console.error("createCampaign error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// PUT /api/campaigns/:id — edit kampanye (fundraiser pemilik, hanya jika belum disetujui)
async function updateCampaign(req, res) {
  const { title, description, target_amount, deadline, image_url } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM campaigns WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Kampanye tidak ditemukan." });
    }

    const campaign = rows[0];
    if (campaign.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Bukan kampanye Anda." });
    }
    if (campaign.is_approved) {
      return res.status(400).json({ success: false, message: "Kampanye yang sudah disetujui tidak dapat diedit." });
    }

    await db.query(
      `UPDATE campaigns SET title = ?, description = ?, target_amount = ?, deadline = ?, image_url = ?
       WHERE id = ?`,
      [title, description, target_amount, deadline, image_url || null, req.params.id]
    );

    return res.status(200).json({ success: true, message: "Kampanye berhasil diperbarui." });
  } catch (err) {
    console.error("updateCampaign error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// PATCH /api/campaigns/:id/approve — setujui atau tolak kampanye (admin)
async function approveCampaign(req, res) {
  const { approved, contract_address } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query("SELECT * FROM campaigns WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Kampanye tidak ditemukan." });
    }

    if (approved) {
      await conn.query(
        "UPDATE campaigns SET is_approved = TRUE, contract_address = ? WHERE id = ?",
        [contract_address || null, req.params.id]
      );
      await conn.commit();
      return res.status(200).json({ success: true, message: "Kampanye disetujui." });
    } else {
      await conn.query("UPDATE campaigns SET is_approved = FALSE WHERE id = ?", [req.params.id]);
      await conn.commit();
      return res.status(200).json({ success: true, message: "Kampanye ditolak." });
    }
  } catch (err) {
    await conn.rollback();
    console.error("approveCampaign error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  } finally {
    conn.release();
  }
}

// PATCH /api/campaigns/:id/status — update status kampanye (admin)
async function updateCampaignStatus(req, res) {
  const { status, note } = req.body;
  const allowedStatuses = ["active", "extended", "target_reached", "released", "ended"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Status tidak valid." });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query("SELECT * FROM campaigns WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Kampanye tidak ditemukan." });
    }

    const campaign = rows[0];
    const oldStatus = campaign.status;

    let extraUpdate = "";
    const extraParams = [];

    // Jika diperpanjang, set extended_deadline otomatis
    if (status === "extended" && !campaign.extended_deadline) {
      const extensionDays = parseInt(process.env.CAMPAIGN_EXTENSION_DAYS) || 7;
      extraUpdate = ", extended_deadline = DATE_ADD(deadline, INTERVAL ? DAY)";
      extraParams.push(extensionDays);
    }

    await conn.query(
      `UPDATE campaigns SET status = ? ${extraUpdate} WHERE id = ?`,
      [status, ...extraParams, req.params.id]
    );

    await logStatusChange(conn, req.params.id, oldStatus, status, req.user.id, note || null);

    await conn.commit();
    return res.status(200).json({ success: true, message: `Status kampanye diperbarui menjadi '${status}'.` });
  } catch (err) {
    await conn.rollback();
    console.error("updateCampaignStatus error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  } finally {
    conn.release();
  }
}

// GET /api/campaigns/mine — kampanye milik fundraiser yang login
async function getMyCampaigns(req, res) {
  try {
    const [campaigns] = await db.query(
      `SELECT id, title, target_amount, collected_amount, deadline, extended_deadline,
              status, is_approved, created_at
       FROM campaigns WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, data: campaigns });
  } catch (err) {
    console.error("getMyCampaigns error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

// GET /api/admin/campaigns — semua kampanye termasuk belum disetujui (admin)
async function getAllCampaignsAdmin(req, res) {
  try {
    const [campaigns] = await db.query(
      `SELECT c.id, c.title, c.target_amount, c.collected_amount, c.deadline,
              c.status, c.is_approved, c.created_at, u.name AS fundraiser_name, u.email AS fundraiser_email
       FROM campaigns c
       JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC`
    );
    return res.status(200).json({ success: true, data: campaigns });
  } catch (err) {
    console.error("getAllCampaignsAdmin error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
}

module.exports = {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  approveCampaign,
  updateCampaignStatus,
  getMyCampaigns,
  getAllCampaignsAdmin,
};
