const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(50));
  console.log("DonasiChain — Deployment ke Ethereum Sepolia");
  console.log("=".repeat(50));
  console.log("Deployer address :", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance  :", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Saldo deployer 0 ETH. Dapatkan Sepolia ETH dari https://sepoliafaucet.com");
  }

  console.log("\nMen-deploy DonasiChain...");
  const DonasiChain = await ethers.getContractFactory("DonasiChain");
  const contract = await DonasiChain.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT BERHASIL");
  console.log("=".repeat(50));
  console.log("Network          :", hre.network.name);
  console.log("Contract Address :", contractAddress);
  console.log("Tx Hash          :", deployTx.hash);
  console.log("Etherscan        :", `https://sepolia.etherscan.io/address/${contractAddress}`);
  console.log("=".repeat(50));
  console.log("\nLangkah selanjutnya:");
  console.log(`1. Isi CONTRACT_ADDRESS=${contractAddress} di .env backend`);
  console.log(`2. Isi CONTRACT_ADDRESS=${contractAddress} di .env blockchain`);
  console.log("3. Sesuaikan ABI di donasichain-backend/config/blockchain.js");
  console.log("4. Otorisasi wallet backend dengan memanggil authorizeBackend()");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
