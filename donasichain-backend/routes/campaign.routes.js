const router = require("express").Router();
const { body, param } = require("express-validator");
const {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  approveCampaign,
  updateCampaignStatus,
  getMyCampaigns,
  getAllCampaignsAdmin,
} = require("../controllers/campaign.controller");
const { authenticate, authorize } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

// Publik
router.get("/", getCampaigns);
router.get("/mine", authenticate, authorize("fundraiser"), getMyCampaigns);
router.get("/:id", [param("id").isInt().withMessage("ID tidak valid.")], validate, getCampaignById);

// Fundraiser
router.post(
  "/",
  authenticate,
  authorize("fundraiser"),
  [
    body("title").trim().notEmpty().withMessage("Judul wajib diisi."),
    body("description").trim().notEmpty().withMessage("Deskripsi wajib diisi."),
    body("target_amount").isInt({ min: 10000 }).withMessage("Target minimal Rp 10.000."),
    body("deadline").isDate().withMessage("Format tanggal tidak valid."),
    body("image_url").optional().isURL().withMessage("URL gambar tidak valid."),
  ],
  validate,
  createCampaign
);

router.put(
  "/:id",
  authenticate,
  authorize("fundraiser"),
  [
    param("id").isInt().withMessage("ID tidak valid."),
    body("title").trim().notEmpty().withMessage("Judul wajib diisi."),
    body("description").trim().notEmpty().withMessage("Deskripsi wajib diisi."),
    body("target_amount").isInt({ min: 10000 }).withMessage("Target minimal Rp 10.000."),
    body("deadline").isDate().withMessage("Format tanggal tidak valid."),
  ],
  validate,
  updateCampaign
);

// Admin
router.get("/admin/all", authenticate, authorize("admin"), getAllCampaignsAdmin);

router.patch(
  "/:id/approve",
  authenticate,
  authorize("admin"),
  [
    param("id").isInt().withMessage("ID tidak valid."),
    body("approved").isBoolean().withMessage("Field 'approved' harus boolean."),
    body("contract_address").optional().isLength({ min: 42, max: 42 }).withMessage("Alamat contract tidak valid."),
  ],
  validate,
  approveCampaign
);

router.patch(
  "/:id/status",
  authenticate,
  authorize("admin"),
  [
    param("id").isInt().withMessage("ID tidak valid."),
    body("status")
      .isIn(["active", "extended", "target_reached", "released", "ended"])
      .withMessage("Status tidak valid."),
  ],
  validate,
  updateCampaignStatus
);

module.exports = router;
