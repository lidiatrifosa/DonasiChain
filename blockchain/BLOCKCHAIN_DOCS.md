# DonasiChain — Dokumentasi Integrasi Blockchain

## Informasi Contract

| Item | Nilai |
|---|---|
| Network | Ethereum Sepolia Testnet |
| Solidity Version | 0.8.24 |
| Contract Address | `0x43817db78BB1Ce89ba25837A4af9279F1B4a4517` |
| Deployment Tx Hash | `0x97b10076d81678bf6b639a17969fd0d0bb7a84600fb6887b6db3c449b711fdab` |
| Etherscan | https://sepolia.etherscan.io/address/0x43817db78BB1Ce89ba25837A4af9279F1B4a4517 |

---

## Struktur Folder Blockchain

```
blockchain/
├── contracts/
│   └── DonasiChain.sol       ← smart contract utama
├── scripts/
│   └── deploy.js             ← script deployment Sepolia
├── test/
│   └── DonasiChain.test.js   ← 20 skenario pengujian
├── hardhat.config.js
├── package.json
└── .env.example
```

---

## Fungsi Smart Contract

### Write Functions (membutuhkan gas)

#### `createCampaign(campaignId, title, targetAmount, deadline)`
Mencatat kampanye baru ke blockchain saat admin menyetujui kampanye.

| Parameter | Tipe | Keterangan |
|---|---|---|
| campaignId | uint256 | ID kampanye dari database MySQL |
| title | string | Judul kampanye |
| targetAmount | uint256 | Target dana dalam Rupiah (integer) |
| deadline | uint256 | Unix timestamp tenggat kampanye |

- Hak akses: `authorizedBackends` atau `owner`
- Error: `CampaignAlreadyExists`, `InvalidTarget`, `InvalidDeadline`
- Event: `CampaignCreated`

---

#### `recordDonation(campaignId, paymentRefHash, amount)`
Mencatat bukti donasi yang sudah diverifikasi Midtrans.

| Parameter | Tipe | Keterangan |
|---|---|---|
| campaignId | uint256 | ID kampanye dari database |
| paymentRefHash | bytes32 | `keccak256(order_id)` — bukan data pribadi |
| amount | uint256 | Nominal donasi dalam Rupiah |

- Hak akses: `authorizedBackends` atau `owner`
- Error: `CampaignNotFound`, `CampaignNotAcceptingDonations`, `DonationAlreadyRecorded`, `InvalidAmount`, `EmptyDonationId`
- Event: `DonationRecorded`, `CampaignStatusUpdated` (jika target tercapai)

---

#### `updateCampaignStatus(campaignId, newStatus)`
Memperbarui status kampanye. Dipanggil scheduler saat deadline lewat.

| Parameter | Tipe | Keterangan |
|---|---|---|
| campaignId | uint256 | ID kampanye dari database |
| newStatus | string | Status baru dalam huruf kapital |

Status valid: `"ACTIVE"` `"EXTENDED"` `"TARGET_REACHED"` `"RELEASED"` `"ENDED"`

- Hak akses: `authorizedBackends` atau `owner`
- Error: `CampaignNotFound`, `InvalidStatus`
- Event: `CampaignStatusUpdated`

---

#### `extendCampaign(campaignId, newDeadline)`
Memperpanjang tenggat kampanye dan mengubah status ke `EXTENDED`.

| Parameter | Tipe | Keterangan |
|---|---|---|
| campaignId | uint256 | ID kampanye dari database |
| newDeadline | uint256 | Unix timestamp tenggat baru |

- Hak akses: `authorizedBackends` atau `owner`
- Error: `CampaignNotFound`, `InvalidDeadline`
- Event: `CampaignExtended`, `CampaignStatusUpdated`

---

#### `authorizeBackend(backend)`
Menambahkan wallet backend yang diotorisasi. Hanya `owner`.

---

### Read Functions (gratis, tidak perlu gas)

#### `getCampaign(campaignId)`
Mengembalikan data kampanye lengkap.

```
returns: (id, title, targetAmount, collectedAmount, createdAt, deadline, extendedDeadline, status)
```

#### `getDonation(donationId)`
Mengembalikan data donasi berdasarkan `paymentRefHash`.

```
returns: (id, campaignId, paymentRefHash, amount, timestamp)
```

#### `isDonationRecorded(paymentRefHash)`
Mengecek apakah donasi sudah tercatat. Berguna untuk idempotency check.

```
returns: bool
```

#### `getAllCampaignIds()`
Mengembalikan semua campaign ID yang pernah dibuat.

```
returns: uint256[]
```

---

## Events

| Event | Parameter | Keterangan |
|---|---|---|
| `CampaignCreated` | campaignId, title, targetAmount, deadline, timestamp | Kampanye baru dicatat |
| `DonationRecorded` | campaignId, donationId, paymentRefHash, amount, timestamp | Donasi berhasil dicatat |
| `CampaignExtended` | campaignId, newDeadline, timestamp | Kampanye diperpanjang |
| `CampaignStatusUpdated` | campaignId, oldStatus, newStatus, timestamp | Status kampanye berubah |
| `BackendAuthorized` | backend, timestamp | Wallet backend diotorisasi |
| `BackendRevoked` | backend, timestamp | Otorisasi wallet dicabut |

---

## Format Data — Kesepakatan Backend ↔ Blockchain

### recordDonation
```javascript
// Di backend (donation.controller.js) — sudah sesuai:
const paymentRefHash = ethers.keccak256(ethers.toUtf8Bytes(order_id));
await c.recordDonation(campaignId, paymentRefHash, amount);
// amount = integer Rupiah, contoh: 50000
```

### updateCampaignStatus
```javascript
// Di scheduler.js — status harus huruf kapital:
await updateCampaignStatusOnChain(campaign.id, "EXTENDED"); // ✅
await updateCampaignStatusOnChain(campaign.id, "ENDED");    // ✅
// Bukan: "extended" atau "ended"
```

### createCampaign (fungsi baru — perlu ditambahkan ke approveCampaign)
```javascript
// Di campaign.controller.js — tambahkan setelah approve:
const { createCampaignOnChain } = require("../config/blockchain");

// Dalam fungsi approveCampaign, setelah commit:
if (approved) {
  setImmediate(async () => {
    const txHash = await createCampaignOnChain(
      campaignId,
      campaign.title,
      campaign.target_amount,
      campaign.deadline   // format: "2025-03-01" (YYYY-MM-DD)
    );
    if (txHash) {
      await db.query(
        "UPDATE campaigns SET contract_address = ? WHERE id = ?",
        [process.env.CONTRACT_ADDRESS, campaignId]
      );
    }
  });
}
```

---

## Cara Backend Mendapatkan Transaction Hash

Setiap fungsi di `config/blockchain.js` mengembalikan `receipt.hash` (string `0x...`).
Backend menyimpannya ke kolom `blockchain_tx_hash` di tabel `donations`.

```javascript
// Contoh alur di donation.controller.js (sudah ada):
const txHash = await recordDonationOnChain(campaignId, order_id, amount);
if (txHash) {
  await db.query(
    "UPDATE donations SET blockchain_tx_hash = ?, blockchain_status = 'recorded' WHERE order_id = ?",
    [txHash, order_id]
  );
}
```

Frontend kemudian menampilkan link:
```
https://sepolia.etherscan.io/tx/<blockchain_tx_hash>
```

---

## Setup Setelah Deployment

### 1. Isi .env backend
```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<API_KEY>
BACKEND_WALLET_PRIVATE_KEY=<private_key_wallet_backend>
CONTRACT_ADDRESS=<alamat_contract_hasil_deploy>
```

### 2. Otorisasi wallet backend
Setelah deploy, jalankan sekali dari Hardhat console atau script:
```javascript
const contract = await ethers.getContractAt("DonasiChain", "<CONTRACT_ADDRESS>");
await contract.authorizeBackend("<BACKEND_WALLET_ADDRESS>");
```

### 3. Verifikasi contract di Etherscan (opsional)
```bash
cd blockchain
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

---

## Hasil Pengujian Lokal

```
DonasiChain
  1. Pembuatan kampanye berhasil                              ✔
  2. Pembuatan kampanye dengan target tidak valid ditolak     ✔ ✔ ✔
  3. Pencatatan donasi berhasil                               ✔
  4. Pencatatan donasi ganda ditolak                          ✔
  5. Pencatatan donasi oleh wallet tidak berwenang ditolak    ✔
  6. Pencatatan donasi pada kampanye tidak valid ditolak      ✔ ✔ ✔
  7. Total dana kampanye bertambah sesuai nominal             ✔
  8. Kampanye yang targetnya tercapai dapat diperbarui        ✔ ✔
  9. Kampanye dapat diperpanjang saat tenggat awal lewat      ✔
  10. Perpanjangan oleh pihak tidak berwenang ditolak         ✔
  11. Status kampanye setelah perpanjangan dapat diperbarui   ✔
  12. Semua event penting berhasil dipancarkan                ✔ ✔ ✔ ✔

20 passing (1s)
```

---

## Catatan Keamanan

| Risiko | Pencegahan |
|---|---|
| Unauthorized access | Modifier `onlyAuthorized` — hanya wallet terdaftar yang bisa write |
| Duplicate transaction | `DonationAlreadyRecorded` error — satu `paymentRefHash` hanya bisa dicatat sekali |
| Data pribadi on-chain | `order_id` di-hash dengan `keccak256` sebelum dikirim ke contract |
| Private key leakage | Disimpan di `.env`, tidak pernah di source code, `.gitignore` sudah dikonfigurasi |
| Retry backend | Idempotency dijaga di dua lapis: backend (cek `payment_status`) dan contract (`isDonationRecorded`) |
| Gas habis / RPC error | Semua panggilan blockchain bersifat async (`setImmediate`) — tidak memblokir response ke Midtrans |
| Status tidak konsisten | Backend adalah sumber kebenaran utama; blockchain adalah pencatatan bukti. Jika blockchain gagal, `blockchain_status = 'failed'` di DB dan dapat di-retry |

**Keterbatasan:** Contract ini belum diaudit oleh pihak ketiga. Untuk produksi, diperlukan audit keamanan formal sebelum deployment ke Mainnet.
