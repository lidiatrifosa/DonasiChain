const { ethers } = require("ethers");

// ============================================================
// Blockchain Service — DonasiChain Smart Contract Integration
// Network: Ethereum Sepolia Testnet
//
// File ini menggantikan placeholder sebelumnya.
// ABI diambil langsung dari hasil kompilasi Hardhat.
// ============================================================

const CONTRACT_ABI = [
  // --- Write Functions ---
  "function createCampaign(uint256 campaignId, string calldata title, uint256 targetAmount, uint256 deadline) external",
  "function recordDonation(uint256 campaignId, bytes32 paymentRefHash, uint256 amount) external",
  "function extendCampaign(uint256 campaignId, uint256 newDeadline) external",
  "function updateCampaignStatus(uint256 campaignId, string calldata newStatus) external",
  "function authorizeBackend(address backend) external",
  "function revokeBackend(address backend) external",

  // --- Read Functions ---
  "function getCampaign(uint256 campaignId) external view returns (uint256 id, string memory title, uint256 targetAmount, uint256 collectedAmount, uint256 createdAt, uint256 deadline, uint256 extendedDeadline, string memory status)",
  "function getDonation(bytes32 donationId) external view returns (bytes32 id, uint256 campaignId, bytes32 paymentRefHash, uint256 amount, uint256 timestamp)",
  "function isDonationRecorded(bytes32 paymentRefHash) external view returns (bool)",
  "function getAllCampaignIds() external view returns (uint256[] memory)",
  "function owner() external view returns (address)",
  "function authorizedBackends(address) external view returns (bool)",

  // --- Events ---
  "event CampaignCreated(uint256 indexed campaignId, string title, uint256 targetAmount, uint256 deadline, uint256 timestamp)",
  "event DonationRecorded(uint256 indexed campaignId, bytes32 indexed donationId, bytes32 paymentRefHash, uint256 amount, uint256 timestamp)",
  "event CampaignExtended(uint256 indexed campaignId, uint256 newDeadline, uint256 timestamp)",
  "event CampaignStatusUpdated(uint256 indexed campaignId, string oldStatus, string newStatus, uint256 timestamp)",

  // --- Custom Errors ---
  "error NotOwner()",
  "error NotAuthorizedBackend()",
  "error CampaignAlreadyExists(uint256 campaignId)",
  "error CampaignNotFound(uint256 campaignId)",
  "error CampaignNotAcceptingDonations(uint256 campaignId, string currentStatus)",
  "error DonationAlreadyRecorded(bytes32 donationId)",
  "error InvalidAmount()",
  "error InvalidTarget()",
  "error InvalidDeadline()",
  "error InvalidStatus()",
  "error EmptyDonationId()",
];

let contract = null;


function dateToWIBTimestamp(dateValue) {
  const dateString =
    dateValue instanceof Date
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(dateValue)
      : String(dateValue).slice(0, 10);

  const timestamp = new Date(
    `${dateString}T00:00:00+07:00`
  ).getTime();

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Tanggal deadline tidak valid: ${dateValue}`);
  }

  return Math.floor(timestamp / 1000);
}


function getContract() {
  if (contract) return contract;

  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!rpcUrl || !privateKey || !contractAddress) {
    console.warn("Blockchain: konfigurasi belum lengkap. Integrasi blockchain dinonaktifkan.");
    return null;
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    return contract;
  } catch (err) {
    console.error("Blockchain: gagal inisialisasi contract:", err.message);
    return null;
  }
}

// ============================================================
// recordDonationOnChain
// Dipanggil oleh donation.controller.js setelah webhook Midtrans sukses.
//
// Parameter:
//   campaignId      — integer, ID kampanye dari database
//   donationOrderId — string, order_id Midtrans (contoh: "DONASI-1-2-1704067200000")
//   amount          — integer, nominal donasi dalam Rupiah
//
// Return: txHash (string) atau null jika gagal
// ============================================================
async function recordDonationOnChain(campaignId, donationOrderId, amount) {
  const c = getContract();
  if (!c) {
    console.warn(`Blockchain: recordDonation dilewati (contract tidak tersedia). orderId=${donationOrderId}`);
    return null;
  }

  try {
    // Hash order_id sebagai referensi pembayaran — tidak menyimpan data pribadi on-chain
    const paymentRefHash = ethers.keccak256(ethers.toUtf8Bytes(donationOrderId));

    const tx = await c.recordDonation(campaignId, paymentRefHash, amount);
    const receipt = await tx.wait();

    console.log(`Blockchain: donasi tercatat. txHash=${receipt.hash} orderId=${donationOrderId}`);
    return receipt.hash;
  } catch (err) {
    console.error(`Blockchain: recordDonation gagal. orderId=${donationOrderId}`, err.message);
    return null;
  }
}

// ============================================================
// updateCampaignStatusOnChain
// Dipanggil oleh scheduler.js saat status kampanye berubah.
//
// Parameter:
//   campaignId — integer, ID kampanye dari database
//   newStatus  — string huruf kapital: "EXTENDED" | "ENDED" | "TARGET_REACHED" | "RELEASED"
//
// Return: txHash (string) atau null jika gagal
// ============================================================
async function updateCampaignStatusOnChain(campaignId, newStatus) {
  const c = getContract();
  if (!c) {
    console.warn(`Blockchain: updateCampaignStatus dilewati (contract tidak tersedia). campaignId=${campaignId}`);
    return null;
  }

  try {
    const tx = await c.updateCampaignStatus(campaignId, newStatus);
    const receipt = await tx.wait();

    console.log(`Blockchain: status kampanye diperbarui. campaignId=${campaignId} status=${newStatus} txHash=${receipt.hash}`);
    return receipt.hash;
  } catch (err) {
    console.error(`Blockchain: updateCampaignStatus gagal. campaignId=${campaignId}`, err.message);
    return null;
  }
}

// ============================================================
// createCampaignOnChain
// Dipanggil saat admin menyetujui kampanye (approveCampaign).
//
// Parameter:
//   campaignId   — integer, ID kampanye dari database
//   title        — string, judul kampanye
//   targetAmount — integer, target dana dalam Rupiah
//   deadline     — Date object atau string tanggal (YYYY-MM-DD)
//
// Return: txHash (string) atau null jika gagal
// ============================================================
async function createCampaignOnChain(campaignId, title, targetAmount, deadline) {
  const c = getContract();
  if (!c) {
    console.warn(`Blockchain: createCampaign dilewati (contract tidak tersedia). campaignId=${campaignId}`);
    return null;
  }

  try {
    // Konversi deadline ke Unix timestamp (detik)
   const deadlineTimestamp = dateToWIBTimestamp(deadline);

    const tx = await c.createCampaign(campaignId, title, targetAmount, deadlineTimestamp);
    const receipt = await tx.wait();

    console.log(`Blockchain: kampanye dicatat. campaignId=${campaignId} txHash=${receipt.hash}`);
    return receipt.hash;
  } catch (err) {
    console.error(`Blockchain: createCampaign gagal. campaignId=${campaignId}`, err.message);
    return null;
  }
}

// ============================================================
// extendCampaignOnChain
// Dipanggil saat kampanye diperpanjang (scheduler atau admin).
//
// Parameter:
//   campaignId    — integer, ID kampanye dari database
//   newDeadline   — Date object atau string tanggal (YYYY-MM-DD)
//
// Return: txHash (string) atau null jika gagal
// ============================================================
async function extendCampaignOnChain(campaignId, newDeadline) {
  const c = getContract();
  if (!c) {
    console.warn(`Blockchain: extendCampaign dilewati (contract tidak tersedia). campaignId=${campaignId}`);
    return null;
  }

  try {
    const newDeadlineTimestamp = dateToWIBTimestamp(newDeadline);

    const tx = await c.extendCampaign(campaignId, newDeadlineTimestamp);
    const receipt = await tx.wait();

    console.log(`Blockchain: kampanye diperpanjang. campaignId=${campaignId} txHash=${receipt.hash}`);
    return receipt.hash;
  } catch (err) {
    console.error(`Blockchain: extendCampaign gagal. campaignId=${campaignId}`, err.message);
    return null;
  }
}

module.exports = {
  recordDonationOnChain,
  updateCampaignStatusOnChain,
  createCampaignOnChain,
  extendCampaignOnChain,
};
