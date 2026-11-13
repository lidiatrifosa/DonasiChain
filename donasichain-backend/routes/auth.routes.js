const router = require("express").Router();
const { body } = require("express-validator");
const { register, login, getProfile } = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Nama wajib diisi."),
    body("email").isEmail().withMessage("Format email tidak valid.").normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("Password minimal 8 karakter."),
    body("role").optional().isIn(["donor", "fundraiser"]).withMessage("Role tidak valid."),
  ],
  validate,
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Format email tidak valid.").normalizeEmail(),
    body("password").notEmpty().withMessage("Password wajib diisi."),
  ],
  validate,
  login
);

router.get("/profile", authenticate, getProfile);

module.exports = router;
