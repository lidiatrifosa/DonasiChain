# DonasiChain 

Platform penggalangan dana transparan berbasis web dengan integrasi **Midtrans Sandbox** dan pencatatan transaksi on-chain melalui **Smart Contract Ethereum Sepolia**.

## Deskripsi Proyek

DonasiChain adalah prototipe platform penggalangan dana digital yang menggabungkan:

- **Payment Gateway** — Simulasi pembayaran via Midtrans Sandbox (Virtual Account, QRIS, E-Wallet)
- **Blockchain** — Pencatatan bukti transaksi on-chain di Ethereum Sepolia Testnet
- **Smart Contract** — Simulasi mekanisme escrow untuk pengelolaan status kampanye
- **Backend REST API** — Node.js + Express + MySQL

Donatur membayar menggunakan metode pembayaran konvensional. Setelah pembayaran diverifikasi, bukti transaksi dicatat ke smart contract dan hash transaksi dapat diperiksa melalui Sepolia Explorer.

---

## Arsitektur Sistem

```
Frontend (React + Vite)
        ↓
Backend REST API (Node.js + Express)
        ↓                    ↓
   MySQL Database      Smart Contract
                      (Ethereum Sepolia)
        ↑
Midtrans Sandbox (Webhook)
```

**Alur Donasi:**
```
Donatur bayar via Midtrans Snap
        ↓
Midtrans kirim webhook ke backend
        ↓
Backend verifikasi signature SHA512
        ↓
Update status donasi di database
        ↓ (jika sukses)
Catat bukti transaksi ke smart contract
        ↓
Tampilkan tx hash + link Sepolia Explorer
```

---

## Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | React 19, Vite, React Router |
| Backend | Node.js, Express 5, MySQL2 |
| Database | MySQL (MariaDB) |
| Payment Gateway | Midtrans Sandbox (Snap) |
| Blockchain | Ethereum Sepolia Testnet |
| Smart Contract | Solidity 0.8.24, Hardhat |
| Blockchain Client | ethers.js v6 |
| Autentikasi | JWT (jsonwebtoken) |

---

## Struktur Repository

```
DonasiChain/
├── donasichain-frontend/     # React + Vite
├── donasichain-backend/      # Node.js REST API
│   ├── config/               # Database & blockchain config
│   ├── controllers/          # Logic handler
│   ├── middleware/            # Auth & validasi
│   ├── routes/               # Definisi endpoint
│   ├── utils/                # Helper functions
│   ├── test/                 # Test suite Midtrans
│   ├── migration.sql         # Setup database
│   ├── scheduler.js          # Cron job deadline kampanye
│   └── API_DOCS.md           # Dokumentasi endpoint API
└── blockchain/               # Smart contract Solidity
    ├── contracts/
    │   └── DonasiChain.sol   # Smart contract utama
    ├── scripts/
    │   └── deploy.js         # Script deployment Sepolia
    └── test/
        └── DonasiChain.test.js
```

---

## Smart Contract

| Item | Detail |
|---|---|
| Network | Ethereum Sepolia Testnet |
| Contract Address | `0x43817db78BB1Ce89ba25837A4af9279F1B4a4517` |
| Etherscan | [Lihat di Sepolia Etherscan](https://sepolia.etherscan.io/address/0x43817db78BB1Ce89ba25837A4af9279F1B4a4517) |

Fungsi utama smart contract:
- `createCampaign()` — Catat kampanye baru saat admin menyetujui
- `recordDonation()` — Catat bukti donasi setelah webhook Midtrans terverifikasi
- `updateCampaignStatus()` — Perbarui status kampanye
- `extendCampaign()` — Perpanjang tenggat kampanye

---

## Status Kampanye

| Status | Keterangan |
|---|---|
| `active` | Kampanye aktif menerima donasi |
| `extended` | Diperpanjang 7 hari karena target belum tercapai saat deadline |
| `target_reached` | Target dana tercapai |
| `released` | Dana dicairkan ke penggalang dana |
| `ended` | Kampanye berakhir, target tidak tercapai |

---

## Cara Menjalankan

### Prasyarat
- Node.js v18+
- XAMPP (MySQL/MariaDB)
- Git

### 1. Clone repository
```bash
git clone <url-repository>
cd DonasiChain
```

### 2. Setup Database
Pastikan MySQL sudah berjalan, lalu:
```bash
mysql -u root < donasichain-backend/migration.sql
```

### 3. Setup Backend
```bash
cd donasichain-backend
npm install
cp .env.example .env   # Isi konfigurasi di .env
npm run dev
```

Konfigurasi `.env` yang diperlukan:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=donasichain

JWT_SECRET=isi_dengan_string_acak
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=Mid-client-...

SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<API_KEY>
BACKEND_WALLET_PRIVATE_KEY=<private_key>
CONTRACT_ADDRESS=0x43817db78BB1Ce89ba25837A4af9279F1B4a4517
```

### 4. Setup Frontend
```bash
cd donasichain-frontend
npm install
cp .env.example .env
npm run dev
```

Buka `http://localhost:5173`

### 5. Setup Webhook Midtrans (Development)
```bash
ngrok http 3000
# Set Payment Notification URL di dashboard Midtrans Sandbox
```

---

## Akun Demo

| Role | Email | Password |
|---|---|---|
| Admin | admin@donasichain.com | password |
| Donor | donor@donasichain.com | password |
| Fundraiser | fundraiser@donasichain.com | password |


---

## Menjalankan Test

```bash
cd donasichain-backend
npm test
```

Test suite mencakup 72 kasus uji:
- Konfigurasi Midtrans Sandbox
- Validasi format order_id
- Pemetaan status transaksi Midtrans
- Verifikasi signature webhook
- Idempotency check
- Isolasi kegagalan blockchain
- Integrasi langsung ke Midtrans Sandbox API
---

## Catatan
- Pembayaran menggunakan **Midtrans Sandbox** — tidak ada uang nyata yang berpindah
- Blockchain menggunakan **Ethereum Sepolia Testnet** — ETH testnet tidak memiliki nilai nyata
- Mekanisme escrow adalah **simulasi aturan status** — bukan penyimpanan dana rupiah di blockchain