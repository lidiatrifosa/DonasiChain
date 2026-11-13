const jwt = require("jsonwebtoken");

// Verifikasi JWT — wajib login
function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Token tidak ditemukan." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Token tidak valid atau sudah kedaluwarsa." });
  }
}

// Batasi akses berdasarkan role
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Akses ditolak." });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
