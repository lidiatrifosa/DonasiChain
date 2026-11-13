# DonasiChain API Documentation

Base URL: `http://localhost:3000`

Semua request body menggunakan `Content-Type: application/json`.
Endpoint yang membutuhkan autentikasi menggunakan header:
```
Authorization: Bearer <token>
```

---

## Auth

### POST /api/auth/register
Registrasi pengguna baru.

**Request Body:**
```json
{
  "name": "Budi Santoso",
  "email": "budi@example.com",
  "password": "password123",
  "role": "donor"
}
```
- `role`: opsional, nilai: `donor` (default) atau `fundraiser`

**Response 201:**
```json
{
  "success": true,
  "message": "Registrasi berhasil.",
  "data": {
    "id": 1,
    "name": "Budi Santoso",
    "email": "budi@example.com",
    "role": "donor"
  }
}
```

**Response 409** — Email sudah terdaftar.

---

### POST /api/auth/login
Login dan dapatkan JWT token.

**Request Body:**
```json
{
  "email": "budi@example.com",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Login berhasil.",
  "data": {
    "token": "<jwt_token>",
    "user": {
      "id": 1,
      "name": "Budi Santoso",
      "email": "budi@example.com",
      "role": "donor"
    }
  }
}
```

**Response 401** — Email atau password salah.

---

### GET /api/auth/profile
Ambil profil user yang sedang login. 🔒 Auth required.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Budi Santoso",
    "email": "budi@example.com",
    "role": "donor",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
}
```

---

## Kampanye

### GET /api/campaigns
Daftar kampanye yang sudah disetujui. Publik.

**Query Params:**
| Param | Tipe | Keterangan |
|---|---|---|
| status | string | Filter: `active`, `extended`, `target_reached`, `released`, `ended` |
| page | integer | Default: 1 |
| limit | integer | Default: 10 |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Bantu Korban Banjir",
      "description": "...",
      "target_amount": 10000000,
      "collected_amount": 3500000,
      "deadline": "2025-03-01",
      "extended_deadline": null,
      "status": "active",
      "image_url": "https://...",
      "created_at": "2025-01-01T00:00:00.000Z",
      "fundraiser_name": "Yayasan ABC"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 25 }
}
```

---

### GET /api/campaigns/:id
Detail kampanye. Publik.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Bantu Korban Banjir",
    "description": "Deskripsi lengkap kampanye...",
    "target_amount": 10000000,
    "collected_amount": 3500000,
    "deadline": "2025-03-01",
    "extended_deadline": null,
    "status": "active",
    "is_approved": true,
    "contract_address": "0x...",
    "image_url": "https://...",
    "created_at": "2025-01-01T00:00:00.000Z",
    "fundraiser_name": "Yayasan ABC"
  }
}
```

**Response 404** — Kampanye tidak ditemukan.

---

### POST /api/campaigns
Buat kampanye baru. 🔒 Role: `fundraiser`.

**Request Body:**
```json
{
  "title": "Bantu Korban Banjir",
  "description": "Deskripsi lengkap kampanye...",
  "target_amount": 10000000,
  "deadline": "2025-03-01",
  "image_url": "https://example.com/image.jpg"
}
```
- `image_url`: opsional

**Response 201:**
```json
{
  "success": true,
  "message": "Kampanye berhasil dibuat dan menunggu persetujuan admin.",
  "data": {
    "id": 1,
    "title": "Bantu Korban Banjir",
    "status": "active",
    "is_approved": false
  }
}
```

---

### PUT /api/campaigns/:id
Edit kampanye. 🔒 Role: `fundraiser` (pemilik). Hanya bisa diedit sebelum disetujui admin.

**Request Body:** sama dengan POST /api/campaigns.

**Response 200:**
```json
{ "success": true, "message": "Kampanye berhasil diperbarui." }
```

---

### GET /api/campaigns/mine
Daftar kampanye milik fundraiser yang login. 🔒 Role: `fundraiser`.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Bantu Korban Banjir",
      "target_amount": 10000000,
      "collected_amount": 3500000,
      "deadline": "2025-03-01",
      "extended_deadline": null,
      "status": "active",
      "is_approved": true,
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### GET /api/campaigns/admin/all
Semua kampanye termasuk yang belum disetujui. 🔒 Role: `admin`.

**Response 200:** sama dengan GET /api/campaigns tapi tanpa filter `is_approved`.

---

### PATCH /api/campaigns/:id/approve
Setujui atau tolak kampanye. 🔒 Role: `admin`.

**Request Body:**
```json
{
  "approved": true,
  "contract_address": "0x1234567890abcdef1234567890abcdef12345678"
}
```
- `contract_address`: opsional, diisi setelah smart contract di-deploy

**Response 200:**
```json
{ "success": true, "message": "Kampanye disetujui." }
```

---

### PATCH /api/campaigns/:id/status
Update status kampanye. 🔒 Role: `admin`.

**Request Body:**
```json
{
  "status": "released",
  "note": "Dana dicairkan ke rekening penggalang dana."
}
```
- `status`: `active` | `extended` | `target_reached` | `released` | `ended`
- `note`: opsional

**Response 200:**
```json
{ "success": true, "message": "Status kampanye diperbarui menjadi 'released'." }
```

> Catatan: Jika status diubah ke `extended` dan belum ada `extended_deadline`, sistem otomatis menambahkan 7 hari dari `deadline` awal.

---

## Donasi

### POST /api/donations
Buat donasi baru dan dapatkan Snap token Midtrans. 🔒 Role: `donor`.

**Request Body:**
```json
{
  "campaign_id": 1,
  "amount": 50000,
  "message": "Semoga lekas pulih."
}
```
- `amount`: minimal Rp 10.000
- `message`: opsional, maksimal 300 karakter

**Response 201:**
```json
{
  "success": true,
  "message": "Donasi berhasil dibuat. Selesaikan pembayaran.",
  "data": {
    "donation_id": 5,
    "order_id": "DONASI-1-2-1704067200000",
    "snap_token": "<midtrans_snap_token>",
    "redirect_url": "https://app.sandbox.midtrans.com/snap/v2/vtweb/...",
    "amount": 50000
  }
}
```

> Frontend menggunakan `snap_token` untuk membuka Midtrans Snap popup.

---

### POST /api/donations/webhook
Notifikasi pembayaran dari Midtrans. **Publik** (dipanggil server Midtrans, bukan frontend).

> ⚠️ URL ini harus bisa diakses publik. Gunakan ngrok saat development lokal:
> `ngrok http 3000` → set webhook URL di dashboard Midtrans ke `https://<ngrok-url>/api/donations/webhook`

**Request Body** (dikirim otomatis oleh Midtrans):
```json
{
  "order_id": "DONASI-1-2-1704067200000",
  "status_code": "200",
  "gross_amount": "50000.00",
  "signature_key": "<sha512_hash>",
  "transaction_status": "settlement",
  "fraud_status": "accept",
  "payment_type": "bank_transfer",
  "transaction_id": "<midtrans_transaction_id>"
}
```

**Alur verifikasi:**
1. Verifikasi `signature_key` = SHA512(`order_id` + `status_code` + `gross_amount` + `server_key`)
2. Cek apakah `order_id` ada di database
3. Cek apakah status sudah final (idempotency) — jika ya, abaikan
4. Update `payment_status` sesuai `transaction_status`
5. Jika sukses: update `collected_amount` kampanye, cek target tercapai
6. Catat donasi ke smart contract Ethereum Sepolia (async)

**Response 200** (selalu 200 agar Midtrans tidak retry):
```json
{ "success": true, "message": "Notifikasi berhasil diproses." }
```

**Mapping status Midtrans → DonasiChain:**
| transaction_status | fraud_status | payment_status |
|---|---|---|
| capture | accept | success |
| capture | challenge/deny | failed |
| settlement | - | success |
| cancel / deny / failure | - | failed |
| expire | - | expired |
| pending | - | pending |

---

### GET /api/donations/status/:order_id
Polling status donasi berdasarkan order_id. 🔒 Auth required.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "order_id": "DONASI-1-2-1704067200000",
    "amount": 50000,
    "payment_status": "success",
    "payment_method": "bank_transfer",
    "blockchain_tx_hash": "0xabc123...",
    "blockchain_status": "recorded",
    "updated_at": "2025-01-01T00:05:00.000Z",
    "campaign_title": "Bantu Korban Banjir",
    "campaign_id": 1
  }
}
```

---

### GET /api/donations/:id
Detail donasi berdasarkan ID. 🔒 Auth required (hanya milik sendiri).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "order_id": "DONASI-1-2-1704067200000",
    "amount": 50000,
    "payment_status": "success",
    "payment_method": "bank_transfer",
    "blockchain_tx_hash": "0xabc123...",
    "blockchain_status": "recorded",
    "message": "Semoga lekas pulih.",
    "created_at": "2025-01-01T00:00:00.000Z",
    "campaign_title": "Bantu Korban Banjir",
    "campaign_id": 1
  }
}
```

---

## Transaksi

### GET /api/transactions/me
Riwayat donasi user yang sedang login. 🔒 Auth required.

**Query Params:** `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "order_id": "DONASI-1-2-1704067200000",
      "amount": 50000,
      "payment_status": "success",
      "payment_method": "bank_transfer",
      "blockchain_tx_hash": "0xabc123...",
      "blockchain_status": "recorded",
      "message": "Semoga lekas pulih.",
      "created_at": "2025-01-01T00:00:00.000Z",
      "campaign_id": 1,
      "campaign_title": "Bantu Korban Banjir"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 3 }
}
```

---

### GET /api/transactions/campaign/:id
Riwayat donasi sukses per kampanye. Publik.

**Query Params:** `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "amount": 50000,
      "payment_status": "success",
      "blockchain_tx_hash": "0xabc123...",
      "blockchain_status": "recorded",
      "message": "Semoga lekas pulih.",
      "created_at": "2025-01-01T00:00:00.000Z",
      "donor_name": "Budi Santoso"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 12 }
}
```

---

### GET /api/transactions/admin/all
Semua transaksi. 🔒 Role: `admin`.

**Query Params:** `page`, `limit`, `status` (filter payment_status)

---

### GET /api/transactions/admin/reconciliation
Rekonsiliasi data donasi sukses vs status blockchain. 🔒 Role: `admin`.

**Response 200:**
```json
{
  "success": true,
  "summary": {
    "total_success_donations": 50,
    "recorded_on_blockchain": 48,
    "not_recorded_on_blockchain": 2
  },
  "data": [...]
}
```

---

## Admin

### GET /api/admin/stats
Statistik ringkasan dashboard. 🔒 Role: `admin`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "campaigns": {
      "total_campaigns": 10,
      "approved_campaigns": 8,
      "pending_approval": 2,
      "active_campaigns": 5,
      "extended_campaigns": 1,
      "target_reached_campaigns": 1,
      "released_campaigns": 1,
      "ended_campaigns": 0
    },
    "donations": {
      "total_donations": 120,
      "successful_donations": 100,
      "pending_donations": 5,
      "failed_donations": 10,
      "expired_donations": 5,
      "total_collected": 15000000
    },
    "users": {
      "total_users": 50,
      "total_donors": 40,
      "total_fundraisers": 9,
      "total_admins": 1
    },
    "blockchain": {
      "recorded_on_chain": 98,
      "failed_on_chain": 2,
      "not_recorded": 0
    }
  }
}
```

---

### POST /api/admin/check-deadlines
Trigger pengecekan deadline kampanye secara manual. 🔒 Role: `admin`.
Normalnya berjalan otomatis setiap hari pukul 00:05 WIB.

**Response 200:**
```json
{ "success": true, "message": "Pengecekan deadline kampanye selesai. Lihat log server untuk detail." }
```

---

## Error Response Format

Semua error menggunakan format berikut:

```json
{
  "success": false,
  "message": "Pesan error.",
  "errors": [
    { "field": "email", "message": "Format email tidak valid." }
  ]
}
```
- `errors`: hanya ada pada response validasi (HTTP 422)

| HTTP Status | Keterangan |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized (token tidak ada / tidak valid) |
| 403 | Forbidden (role tidak sesuai / signature tidak valid) |
| 404 | Not Found |
| 409 | Conflict (data duplikat) |
| 422 | Unprocessable Entity (validasi gagal) |
| 500 | Internal Server Error |

---

## Alur Integrasi Blockchain

```
Donatur bayar via Midtrans Snap
        ↓
Midtrans kirim webhook POST /api/donations/webhook
        ↓
Backend verifikasi signature SHA512
        ↓
Cek idempotency (sudah diproses?)
        ↓
Update payment_status di DB
        ↓ (jika success)
Update collected_amount kampanye
        ↓
Cek apakah target tercapai → update status kampanye
        ↓
[Async] Panggil smart contract recordDonation()
        ↓
Simpan blockchain_tx_hash ke DB
        ↓
Frontend polling GET /api/donations/status/:order_id
        ↓
Tampilkan tx hash + link Sepolia Explorer ke donatur
```

---

## Setup & Cara Menjalankan

### 1. Install dependencies
```bash
npm install
```

### 2. Setup database
```bash
mysql -u root -p < migration.sql
```

### 3. Konfigurasi .env
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=donasichain

JWT_SECRET=ganti_dengan_string_acak_panjang
JWT_EXPIRES_IN=7d

MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=Mid-client-...

SEPOLIA_RPC_URL=https://rpc.sepolia.org
BACKEND_WALLET_PRIVATE_KEY=
CONTRACT_ADDRESS=

CAMPAIGN_EXTENSION_DAYS=7
```

### 4. Jalankan server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

### 5. Setup webhook Midtrans (development)
```bash
# Install ngrok, lalu:
ngrok http 3000
# Copy URL ngrok, set di dashboard Midtrans Sandbox:
# Payment Notification URL: https://<ngrok-url>/api/donations/webhook
```

### 6. Isi CONTRACT_ADDRESS setelah smart contract di-deploy
Setelah tim blockchain men-deploy smart contract ke Sepolia, isi:
- `CONTRACT_ADDRESS` di `.env`
- `BACKEND_WALLET_PRIVATE_KEY` dengan private key wallet yang akan menandatangani transaksi
- Sesuaikan ABI di `config/blockchain.js` dengan ABI smart contract asli
