const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const midtransClient = require("midtrans-client");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Inisialisasi Midtrans Sandbox
let snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// Endpoint API  membuat tagihan
app.post("/api/buat-donasi", async (req, res) => {
  try {
    // Data dummy (simulasi donasi)
    let parameter = {
      transaction_details: {
        order_id: "DONASI-" + Date.now(), // ID 
        gross_amount: 10000, // Nominal Rp 10.000
      },
      customer_details: {
        first_name: "Donatur",
        email: "donatur@example.com",
      },
    };

    // Minta Midtrans membuat token
    const transaction = await snap.createTransaction(parameter);

    res.status(200).json({
      message: "Berhasil membuat tagihan!",
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal membuat tagihan" });
  }
});

// Jalankan server di port 3000
app.listen(3000, () => {
  console.log("Server berjalan di http://localhost:3000");
});
