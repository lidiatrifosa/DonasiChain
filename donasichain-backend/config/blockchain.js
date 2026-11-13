const { ethers } = require("ethers");

// ============================================================
// Blockchain Service — Integrasi Smart Contract Ethereum Sepolia
//
// File ini adalah "slot" integrasi untuk tim blockchain.
// Sesuaikan ABI dan nama fungsi setelah smart contract di-deploy.
// ============================================================

// ABI minimal — sesuaikan dengan smart contract tim blockchain
// Fungsi yang dibutuhkan backend:
//   1. recordDonation(campaignId, hashedDonorRef, amount)
//   2. updateCampaignStatus(campaignId, newStatus)
const CONTRACT_ABI = [
  // Contoh ABI — GANTI dengan ABI asli dari tim blockchain
  "function recordDonation(uint256 campaignId, bytes32 hashedDonorRef, uint256 amount) external",
  "function updateCampaignStatus(uint256 campaignId, string calldata newStatus) external",
  "event DonationRecorded(uint256 indexed campaignId, bytes32 hashedDonorRef, uint256 amount)",
  "event CampaignStatusUpdated(uint256 indexed campaignId, string newStatus)",
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

// Catat donasi ke smart contract setelah pembayaran Midtrans terverifikasi
async function recordDonationOnChain(campaignId, donationOrderId, amount) {
  const c = getContract();
  if (!c) {
    console.warn(`Blockchain: recordDonation dilewati (contract tidak tersedia). orderId=${donationOrderId}`);
    return null;
  }

  try {
    // Hash order_id sebagai referensi donatur (tidak menyimpan data pribadi on-chain)
    const hashedRef = ethers.keccak256(ethers.toUtf8Bytes(donationOrderId));
    const amountInWei = ethers.parseUnits(String(amount), 0); // amount dalam Rupiah (integer)

    const tx = await c.recordDonation(campaignId, hashedRef, amountInWei);
    const receipt = await tx.wait();

    console.log(`Blockchain: donasi tercatat. txHash=${receipt.hash}`);
    return receipt.hash;
  } catch (err) {
    console.error(`Blockchain: recordDonation gagal. orderId=${donationOrderId}`, err.message);
    return null;
  }
}

// Update status kampanye di smart contract
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

module.exports = { recordDonationOnChain, updateCampaignStatusOnChain };
