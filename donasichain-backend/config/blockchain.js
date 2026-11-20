const { ethers } = require("ethers");

// ABI sesuai DonasiChain.sol yang sudah di-deploy ke Sepolia
const CONTRACT_ABI = [
  // Write functions
  "function createCampaign(uint256 campaignId, string calldata title, uint256 targetAmount, uint256 deadline) external",
  "function recordDonation(uint256 campaignId, bytes32 paymentRefHash, uint256 amount) external",
  "function updateCampaignStatus(uint256 campaignId, string calldata newStatus) external",
  "function extendCampaign(uint256 campaignId, uint256 newDeadline) external",
  "function authorizeBackend(address backend) external",
  "function revokeBackend(address backend) external",

  // Read functions
  "function getCampaign(uint256 campaignId) external view returns (uint256 id, string memory title, uint256 targetAmount, uint256 collectedAmount, uint256 createdAt, uint256 deadline, uint256 extendedDeadline, string memory status)",
  "function getDonation(bytes32 donationId) external view returns (bytes32 id, uint256 campaignId, bytes32 paymentRefHash, uint256 amount, uint256 timestamp)",
  "function isDonationRecorded(bytes32 paymentRefHash) external view returns (bool)",
  "function getAllCampaignIds() external view returns (uint256[] memory)",

  // Events
  "event CampaignCreated(uint256 indexed campaignId, string title, uint256 targetAmount, uint256 deadline, uint256 timestamp)",
  "event DonationRecorded(uint256 indexed campaignId, bytes32 indexed donationId, bytes32 paymentRefHash, uint256 amount, uint256 timestamp)",
  "event CampaignExtended(uint256 indexed campaignId, uint256 newDeadline, uint256 timestamp)",
  "event CampaignStatusUpdated(uint256 indexed campaignId, string oldStatus, string newStatus, uint256 timestamp)",
];

let contract = null;

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

// Daftarkan kampanye ke blockchain saat admin approve
async function createCampaignOnChain(campaignId, title, targetAmount, deadlineDate) {
  const c = getContract();
  if (!c) {
    console.warn(`Blockchain: createCampaign dilewati. campaignId=${campaignId}`);
    return null;
  }

  try {
    // Konversi deadline dari "YYYY-MM-DD" ke Unix timestamp
    const deadlineTimestamp = Math.floor(new Date(deadlineDate).getTime() / 1000);

    const tx = await c.createCampaign(campaignId, title, targetAmount, deadlineTimestamp);
    const receipt = await tx.wait();

    console.log(`Blockchain: kampanye #${campaignId} dicatat. txHash=${receipt.hash}`);
    return receipt.hash;
  } catch (err) {
    console.error(`Blockchain: createCampaign gagal. campaignId=${campaignId}`, err.message);
    return null;
  }
}

// Catat donasi ke blockchain setelah webhook Midtrans terverifikasi
// paymentRefHash = keccak256(order_id) — konsisten dengan smart contract
async function recordDonationOnChain(campaignId, orderId, amount) {
  const c = getContract();
  if (!c) {
    console.warn(`Blockchain: recordDonation dilewati. orderId=${orderId}`);
    return null;
  }

  try {
    const paymentRefHash = ethers.keccak256(ethers.toUtf8Bytes(orderId));

    const tx = await c.recordDonation(campaignId, paymentRefHash, amount);
    const receipt = await tx.wait();

    console.log(`Blockchain: donasi tercatat. orderId=${orderId} txHash=${receipt.hash}`);
    return receipt.hash;
  } catch (err) {
    console.error(`Blockchain: recordDonation gagal. orderId=${orderId}`, err.message);
    return null;
  }
}

// Update status kampanye di blockchain — status harus HURUF KAPITAL
async function updateCampaignStatusOnChain(campaignId, newStatus) {
  const c = getContract();
  if (!c) {
    console.warn(`Blockchain: updateCampaignStatus dilewati. campaignId=${campaignId}`);
    return null;
  }

  try {
    const tx = await c.updateCampaignStatus(campaignId, newStatus.toUpperCase());
    const receipt = await tx.wait();

    console.log(`Blockchain: status kampanye #${campaignId} → ${newStatus}. txHash=${receipt.hash}`);
    return receipt.hash;
  } catch (err) {
    console.error(`Blockchain: updateCampaignStatus gagal. campaignId=${campaignId}`, err.message);
    return null;
  }
}

// Perpanjang deadline kampanye di blockchain
async function extendCampaignOnChain(campaignId, newDeadlineDate) {
  const c = getContract();
  if (!c) {
    console.warn(`Blockchain: extendCampaign dilewati. campaignId=${campaignId}`);
    return null;
  }

  try {
    const newDeadlineTimestamp = Math.floor(new Date(newDeadlineDate).getTime() / 1000);

    const tx = await c.extendCampaign(campaignId, newDeadlineTimestamp);
    const receipt = await tx.wait();

    console.log(`Blockchain: kampanye #${campaignId} diperpanjang. txHash=${receipt.hash}`);
    return receipt.hash;
  } catch (err) {
    console.error(`Blockchain: extendCampaign gagal. campaignId=${campaignId}`, err.message);
    return null;
  }
}

module.exports = {
  createCampaignOnChain,
  recordDonationOnChain,
  updateCampaignStatusOnChain,
  extendCampaignOnChain,
};
