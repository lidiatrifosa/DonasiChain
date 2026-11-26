require("dotenv").config();
const { ethers } = require("ethers");
const db = require("./config/db");

const CONTRACT_ABI = [
  "function createCampaign(uint256 campaignId, string calldata title, uint256 targetAmount, uint256 deadline) external",
  "function recordDonation(uint256 campaignId, bytes32 paymentRefHash, uint256 amount) external",
  "function updateCampaignStatus(uint256 campaignId, string calldata newStatus) external",
  "function extendCampaign(uint256 campaignId, uint256 newDeadline) external",
  "function getCampaign(uint256 campaignId) view returns (uint256 id, string title, uint256 targetAmount, uint256 collectedAmount, uint256 createdAt, uint256 deadline, uint256 extendedDeadline, string status)",
  "function getAllCampaignIds() view returns (uint256[])",
  "function isDonationRecorded(bytes32 paymentRefHash) view returns (bool)",
];

function deadlineTimestamp(campaign) {
  const databaseDeadline = Math.floor(new Date(campaign.deadline).getTime() / 1000);
  const minimumDeadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  return Math.max(databaseDeadline, minimumDeadline);
}

async function waitForTransaction(contractFunction, label) {
  const tx = await contractFunction();
  console.log(`${label}: tx ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`${label}: confirmed in block ${receipt.blockNumber}`);
  return receipt.hash;
}

async function syncBlockchain() {
  if (!process.env.SEPOLIA_RPC_URL || !process.env.BACKEND_WALLET_PRIVATE_KEY || !process.env.CONTRACT_ADDRESS) {
    throw new Error("Konfigurasi blockchain backend belum lengkap.");
  }

  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.BACKEND_WALLET_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

  const [campaigns] = await db.query(
    `SELECT id, title, target_amount, collected_amount, deadline, status
     FROM campaigns
     WHERE is_approved = TRUE
     ORDER BY id`,
  );

  const existingIds = (await contract.getAllCampaignIds()).map((id) => id.toString());
  const existing = new Set(existingIds);

  let created = 0;
  let donations = 0;
  let statuses = 0;

  for (const campaign of campaigns) {
    const campaignId = Number(campaign.id);
    const targetAmount = BigInt(campaign.target_amount);
    const collectedAmount = BigInt(campaign.collected_amount);

    if (!existing.has(String(campaignId))) {
      await waitForTransaction(
        () => contract.createCampaign(campaignId, campaign.title, targetAmount, deadlineTimestamp(campaign)),
        `Create campaign #${campaignId}`,
      );
      created++;
    } else {
      console.log(`Campaign #${campaignId} already exists on-chain`);
    }

    const onChain = await contract.getCampaign(campaignId);
    const onChainCollected = onChain.collectedAmount;

    if (campaign.status === "active" || campaign.status === "extended") {
      const desiredCollected = collectedAmount > 0n ? collectedAmount : 100000n;
      const amountToRecord = desiredCollected > onChainCollected
        ? desiredCollected - onChainCollected
        : 0n;

      if (amountToRecord > 0n) {
        const orderId = `DEMO-SEPOLIA-CAMPAIGN-${campaignId}-${Date.now()}`;
        const paymentRefHash = ethers.keccak256(ethers.toUtf8Bytes(orderId));
        await waitForTransaction(
          () => contract.recordDonation(campaignId, paymentRefHash, amountToRecord),
          `Record demo donation #${campaignId}`,
        );
        donations++;
      }
    } else if (campaign.status === "target_reached" || campaign.status === "released") {
      const amountToRecord = targetAmount > onChainCollected
        ? targetAmount - onChainCollected
        : 0n;

      if (amountToRecord > 0n) {
        const orderId = `DEMO-SEPOLIA-CAMPAIGN-${campaignId}-${Date.now()}`;
        const paymentRefHash = ethers.keccak256(ethers.toUtf8Bytes(orderId));
        await waitForTransaction(
          () => contract.recordDonation(campaignId, paymentRefHash, amountToRecord),
          `Record target donation #${campaignId}`,
        );
        donations++;
      }
    }

    const blockchainStatus =
      campaign.status === "target_reached" ? "TARGET_REACHED"
      : campaign.status === "released" ? "RELEASED"
      : campaign.status === "ended" ? "ENDED"
      : campaign.status === "extended" ? "EXTENDED"
      : "ACTIVE";

    await waitForTransaction(
      () => contract.updateCampaignStatus(campaignId, blockchainStatus),
      `Set status #${campaignId} to ${blockchainStatus}`,
    );
    statuses++;
  }

  console.log(
    `Sinkronisasi selesai: ${created} kampanye dibuat, ${donations} donasi dicatat, ${statuses} status diperbarui.`,
  );
}

syncBlockchain()
  .catch((error) => {
    console.error("Sinkronisasi blockchain gagal:", error.shortMessage || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
