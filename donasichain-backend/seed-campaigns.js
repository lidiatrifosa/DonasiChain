require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./config/db");

const demoUsers = [
  { name: "Yayasan Cahaya Nusantara", email: "demo-yayasan@donasichain.com", role: "fundraiser" },
  { name: "Relawan Peduli Indonesia", email: "demo-relawan@donasichain.com", role: "fundraiser" },
  { name: "Komunitas Hijau Bersama", email: "demo-komunitas@donasichain.com", role: "fundraiser" },
];

const campaigns = [
  ["active", "Bantu Siswa Desa Punya Perangkat Belajar", "Pengadaan laptop bekas layak pakai dan kuota internet untuk siswa yang kesulitan mengikuti pembelajaran daring.", 35000000, 18200000, "2027-02-28", "/campaign-images/education.jpg"],
  ["active", "Operasi Jantung untuk Ardi, 8 Tahun", "Biaya pemeriksaan dan operasi jantung untuk seorang anak yang membutuhkan penanganan segera di rumah sakit rujukan.", 75000000, 46800000, "2027-02-15", "/campaign-images/medical.jpg"],
  ["active", "Bangun Dapur Umum Korban Banjir", "Penyediaan dapur umum, air bersih, makanan siap saji, dan kebutuhan dasar bagi keluarga terdampak banjir.", 45000000, 26300000, "2027-03-10", "/campaign-images/disaster.jpg"],

  ["extended", "Perpanjang Beasiswa Anak Pesisir", "Dana lanjutan untuk biaya sekolah, seragam, dan kebutuhan belajar siswa di kawasan pesisir yang rentan putus sekolah.", 50000000, 31500000, "2027-01-30", "/campaign-images/children.jpg"],
  ["extended", "Rehabilitasi Hutan Mangrove Demak", "Penanaman kembali mangrove dan perlindungan garis pantai bersama kelompok masyarakat pesisir.", 60000000, 34000000, "2027-02-20", "/campaign-images/environment.jpg"],
  ["extended", "Bantu Panti Asuhan Layani Anak Disabilitas", "Peningkatan fasilitas aksesibel, terapi rutin, dan kebutuhan harian bagi anak-anak dengan disabilitas di panti.", 55000000, 29700000, "2027-01-25", "/campaign-images/children.jpg"],

  ["target_reached", "Pengadaan Alat USG untuk Klinik Desa", "Pengadaan alat USG portabel agar ibu hamil di wilayah terpencil dapat memperoleh pemeriksaan rutin.", 80000000, 80000000, "2026-12-20", "/campaign-images/medical.jpg"],
  ["target_reached", "Perpustakaan Mini untuk Pulau Terpencil", "Pembangunan perpustakaan mini lengkap dengan buku bacaan anak dan pelatihan pustakawan sukarelawan.", 40000000, 40000000, "2026-12-15", "/campaign-images/education.jpg"],
  ["target_reached", "Air Bersih untuk 120 Keluarga", "Pemasangan instalasi penampungan dan penyaringan air bersih untuk keluarga di daerah kekeringan.", 65000000, 65000000, "2026-12-10", "/campaign-images/community.jpg"],

  ["released", "Pemulihan Rumah Pasca Gempa Cianjur", "Renovasi rumah sederhana, sistem sanitasi, dan bantuan material bagi keluarga yang rumahnya rusak berat.", 120000000, 120000000, "2026-11-30", "/campaign-images/disaster.jpg"],
  ["released", "Beasiswa Inspirasi untuk Pelajar Berprestasi", "Penyaluran dana pendidikan bagi 25 pelajar berprestasi dari keluarga prasejahtera.", 90000000, 90000000, "2026-11-20", "/campaign-images/education.jpg"],
  ["released", "Perawatan Lansia Tidak Mampu", "Biaya pemeriksaan rutin, obat kronis, dan pendampingan lansia yang hidup tanpa dukungan keluarga.", 70000000, 70000000, "2026-11-15", "/campaign-images/medical.jpg"],

  ["ended", "Kelas Seni untuk Anak Jalanan", "Kegiatan seni dan keterampilan mingguan bagi anak jalanan sebagai ruang aman dan jalur pendidikan nonformal.", 30000000, 11200000, "2026-10-31", "/campaign-images/children.jpg"],
  ["ended", "Bantuan Alat Panen Petani Lereng", "Pengadaan alat panen ringan dan pelatihan pascapanen untuk kelompok tani kecil.", 48000000, 19000000, "2026-10-20", "/campaign-images/community.jpg"],
  ["ended", "Restorasi Habitat Penyu Pantai Selatan", "Peralatan pemantauan, pendidikan konservasi, dan perlindungan kawasan bertelur penyu.", 55000000, 22400000, "2026-10-15", "/campaign-images/environment.jpg"],
];

async function seed() {
  const passwordHash = await bcrypt.hash("password", 12);
  const userIds = [];

  for (const user of demoUsers) {
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [user.email]);
    if (existing.length) {
      userIds.push(existing[0].id);
    } else {
      const [result] = await db.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        [user.name, user.email, passwordHash, user.role],
      );
      userIds.push(result.insertId);
    }
  }

  let inserted = 0;
  for (let i = 0; i < campaigns.length; i++) {
    const [status, title, description, targetAmount, collectedAmount, deadline, imageUrl] = campaigns[i];
    const [existing] = await db.query("SELECT id FROM campaigns WHERE title = ?", [title]);
    if (existing.length) continue;

    await db.query(
      `INSERT INTO campaigns
       (user_id, title, description, target_amount, collected_amount, deadline, status, is_approved, contract_address, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)`,
      [userIds[i % userIds.length], title, description, targetAmount, collectedAmount, deadline, status,
        "0x43817db78BB1Ce89ba25837A4af9279F1B4a4517", imageUrl],
    );
    inserted++;
  }

  console.log(`Seed kampanye selesai. ${inserted} kampanye baru ditambahkan.`);
  await db.end();
}

seed().catch(async (error) => {
  console.error("Gagal menambah data kampanye:", error.message);
  await db.end();
  process.exit(1);
});
