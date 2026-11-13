const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DonasiChain", function () {
  let contract;
  let owner, backend, unauthorized, other;

  // Helper: buat deadline 30 hari dari sekarang
  async function futureDeadline(days = 30) {
    const now = await time.latest();
    return now + days * 24 * 60 * 60;
  }

  // Helper: buat paymentRefHash dari order_id (sama persis dengan backend)
  function hashOrderId(orderId) {
    return ethers.keccak256(ethers.toUtf8Bytes(orderId));
  }

  beforeEach(async function () {
    [owner, backend, unauthorized, other] = await ethers.getSigners();

    const DonasiChain = await ethers.getContractFactory("DonasiChain");
    contract = await DonasiChain.deploy();

    // Otorisasi wallet backend
    await contract.connect(owner).authorizeBackend(backend.address);
  });

  // ===========================================================
  // Skenario 1: Pembuatan kampanye berhasil
  // ===========================================================
  describe("1. Pembuatan kampanye berhasil", function () {
    it("harus mencatat kampanye dan memancarkan event CampaignCreated", async function () {
      const deadline = await futureDeadline(30);

      await expect(
        contract.connect(backend).createCampaign(1, "Bantu Korban Banjir", 10_000_000, deadline)
      )
        .to.emit(contract, "CampaignCreated")
        .withArgs(1, "Bantu Korban Banjir", 10_000_000, deadline, await time.latest() + 1);

      const c = await contract.getCampaign(1);
      expect(c.id).to.equal(1);
      expect(c.title).to.equal("Bantu Korban Banjir");
      expect(c.targetAmount).to.equal(10_000_000);
      expect(c.collectedAmount).to.equal(0);
      expect(c.status).to.equal("ACTIVE");
    });
  });

  // ===========================================================
  // Skenario 2: Pembuatan kampanye dengan target tidak valid ditolak
  // ===========================================================
  describe("2. Pembuatan kampanye dengan target tidak valid ditolak", function () {
    it("harus revert jika targetAmount = 0", async function () {
      const deadline = await futureDeadline(30);
      await expect(
        contract.connect(backend).createCampaign(1, "Kampanye Test", 0, deadline)
      ).to.be.revertedWithCustomError(contract, "InvalidTarget");
    });

    it("harus revert jika deadline sudah lewat", async function () {
      const pastDeadline = (await time.latest()) - 1;
      await expect(
        contract.connect(backend).createCampaign(1, "Kampanye Test", 10_000_000, pastDeadline)
      ).to.be.revertedWithCustomError(contract, "InvalidDeadline");
    });

    it("harus revert jika campaignId sudah ada", async function () {
      const deadline = await futureDeadline(30);
      await contract.connect(backend).createCampaign(1, "Kampanye Pertama", 10_000_000, deadline);
      await expect(
        contract.connect(backend).createCampaign(1, "Kampanye Duplikat", 5_000_000, deadline)
      ).to.be.revertedWithCustomError(contract, "CampaignAlreadyExists");
    });
  });

  // ===========================================================
  // Skenario 3: Pencatatan donasi berhasil
  // ===========================================================
  describe("3. Pencatatan donasi berhasil", function () {
    beforeEach(async function () {
      const deadline = await futureDeadline(30);
      await contract.connect(backend).createCampaign(1, "Bantu Korban Banjir", 10_000_000, deadline);
    });

    it("harus mencatat donasi dan memancarkan event DonationRecorded", async function () {
      const orderId = "DONASI-1-2-1704067200000";
      const refHash = hashOrderId(orderId);

      await expect(contract.connect(backend).recordDonation(1, refHash, 50_000))
        .to.emit(contract, "DonationRecorded")
        .withArgs(1, refHash, refHash, 50_000, await time.latest() + 1);

      const d = await contract.getDonation(refHash);
      expect(d.campaignId).to.equal(1);
      expect(d.amount).to.equal(50_000);
    });
  });

  // ===========================================================
  // Skenario 4: Pencatatan donasi ganda ditolak
  // ===========================================================
  describe("4. Pencatatan donasi ganda ditolak", function () {
    it("harus revert jika donationId (paymentRefHash) sudah tercatat", async function () {
      const deadline = await futureDeadline(30);
      await contract.connect(backend).createCampaign(1, "Kampanye Test", 10_000_000, deadline);

      const refHash = hashOrderId("DONASI-1-2-1704067200000");
      await contract.connect(backend).recordDonation(1, refHash, 50_000);

      await expect(
        contract.connect(backend).recordDonation(1, refHash, 50_000)
      ).to.be.revertedWithCustomError(contract, "DonationAlreadyRecorded");
    });
  });

  // ===========================================================
  // Skenario 5: Pencatatan donasi oleh wallet tidak berwenang ditolak
  // ===========================================================
  describe("5. Pencatatan donasi oleh wallet tidak berwenang ditolak", function () {
    it("harus revert jika dipanggil wallet yang tidak diotorisasi", async function () {
      const deadline = await futureDeadline(30);
      await contract.connect(backend).createCampaign(1, "Kampanye Test", 10_000_000, deadline);

      const refHash = hashOrderId("DONASI-1-3-1704067200000");
      await expect(
        contract.connect(unauthorized).recordDonation(1, refHash, 50_000)
      ).to.be.revertedWithCustomError(contract, "NotAuthorizedBackend");
    });
  });

  // ===========================================================
  // Skenario 6: Pencatatan donasi pada kampanye tidak valid ditolak
  // ===========================================================
  describe("6. Pencatatan donasi pada kampanye tidak valid ditolak", function () {
    it("harus revert jika campaignId tidak ada", async function () {
      const refHash = hashOrderId("DONASI-99-1-1704067200000");
      await expect(
        contract.connect(backend).recordDonation(99, refHash, 50_000)
      ).to.be.revertedWithCustomError(contract, "CampaignNotFound");
    });

    it("harus revert jika kampanye berstatus ENDED", async function () {
      const deadline = await futureDeadline(30);
      await contract.connect(backend).createCampaign(1, "Kampanye Test", 10_000_000, deadline);
      await contract.connect(backend).updateCampaignStatus(1, "ENDED");

      const refHash = hashOrderId("DONASI-1-4-1704067200000");
      await expect(
        contract.connect(backend).recordDonation(1, refHash, 50_000)
      ).to.be.revertedWithCustomError(contract, "CampaignNotAcceptingDonations");
    });

    it("harus revert jika amount = 0", async function () {
      const deadline = await futureDeadline(30);
      await contract.connect(backend).createCampaign(1, "Kampanye Test", 10_000_000, deadline);

      const refHash = hashOrderId("DONASI-1-5-1704067200000");
      await expect(
        contract.connect(backend).recordDonation(1, refHash, 0)
      ).to.be.revertedWithCustomError(contract, "InvalidAmount");
    });
  });

  // ===========================================================
  // Skenario 7: Total dana kampanye bertambah sesuai nominal
  // ===========================================================
  describe("7. Total dana kampanye bertambah sesuai nominal", function () {
    it("collectedAmount harus bertambah setiap donasi dicatat", async function () {
      const deadline = await futureDeadline(30);
      await contract.connect(backend).createCampaign(1, "Kampanye Test", 10_000_000, deadline);

      await contract.connect(backend).recordDonation(1, hashOrderId("ORDER-A"), 50_000);
      await contract.connect(backend).recordDonation(1, hashOrderId("ORDER-B"), 150_000);
      await contract.connect(backend).recordDonation(1, hashOrderId("ORDER-C"), 300_000);

      const c = await contract.getCampaign(1);
      expect(c.collectedAmount).to.equal(500_000);
    });
  });

  // ===========================================================
  // Skenario 8: Kampanye yang targetnya tercapai dapat diperbarui statusnya
  // ===========================================================
  describe("8. Kampanye yang targetnya tercapai dapat diperbarui statusnya", function () {
    it("status otomatis berubah ke TARGET_REACHED saat collectedAmount >= targetAmount", async function () {
      const deadline = await futureDeadline(30);
      await contract.connect(backend).createCampaign(1, "Kampanye Test", 100_000, deadline);

      await expect(
        contract.connect(backend).recordDonation(1, hashOrderId("ORDER-FULL"), 100_000)
      )
        .to.emit(contract, "CampaignStatusUpdated")
        .withArgs(1, "ACTIVE", "TARGET_REACHED", await time.latest() + 1);

      const c = await contract.getCampaign(1);
      expect(c.status).to.equal("TARGET_REACHED");
    });

    it("admin dapat mengubah status ke RELEASED setelah target tercapai", async function () {
      const deadline = await futureDeadline(30);
      await contract.connect(backend).createCampaign(1, "Kampanye Test", 100_000, deadline);
      await contract.connect(backend).recordDonation(1, hashOrderId("ORDER-FULL"), 100_000);

      await expect(contract.connect(owner).updateCampaignStatus(1, "RELEASED"))
        .to.emit(contract, "CampaignStatusUpdated")
        .withArgs(1, "TARGET_REACHED", "RELEASED", await time.latest() + 1);
    });
  });

  // ===========================================================
  // Skenario 9: Kampanye yang belum mencapai target pada tenggat awal dapat diperpanjang
  // ===========================================================
  describe("9. Kampanye dapat diperpanjang saat tenggat awal lewat", function () {
    it("harus mencatat perpanjangan dan memancarkan event CampaignExtended", async function () {
      const deadline = await futureDeadline(1);
      await contract.connect(backend).createCampaign(1, "Kampanye Test", 10_000_000, deadline);

      // Simulasi waktu melewati deadline
      await time.increase(2 * 24 * 60 * 60);

      const newDeadline = await futureDeadline(7);
      await expect(contract.connect(backend).extendCampaign(1, newDeadline))
        .to.emit(contract, "CampaignExtended")
        .withArgs(1, newDeadline, await time.latest() + 1);

      const c = await contract.getCampaign(1);
      expect(c.status).to.equal("EXTENDED");
      expect(c.extendedDeadline).to.equal(newDeadline);
    });
  });

  // ===========================================================
  // Skenario 10: Perpanjangan kampanye oleh pihak tidak berwenang ditolak
  // ===========================================================
  describe("10. Perpanjangan kampanye oleh pihak tidak berwenang ditolak", function () {
    it("harus revert jika dipanggil wallet yang tidak diotorisasi", async function () {
      const deadline = await futureDeadline(1);
      await contract.connect(backend).createCampaign(1, "Kampanye Test", 10_000_000, deadline);

      await time.increase(2 * 24 * 60 * 60);
      const newDeadline = await futureDeadline(7);

      await expect(
        contract.connect(unauthorized).extendCampaign(1, newDeadline)
      ).to.be.revertedWithCustomError(contract, "NotAuthorizedBackend");
    });
  });

  // ===========================================================
  // Skenario 11: Status kampanye setelah masa perpanjangan dapat diperbarui
  // ===========================================================
  describe("11. Status kampanye setelah perpanjangan dapat diperbarui ke ENDED", function () {
    it("backend dapat mengubah status ke ENDED setelah extended_deadline lewat", async function () {
      const deadline = await futureDeadline(1);
      await contract.connect(backend).createCampaign(1, "Kampanye Test", 10_000_000, deadline);

      await time.increase(2 * 24 * 60 * 60);
      const newDeadline = await futureDeadline(7);
      await contract.connect(backend).extendCampaign(1, newDeadline);

      // Simulasi extended_deadline lewat
      await time.increase(8 * 24 * 60 * 60);

      await expect(contract.connect(backend).updateCampaignStatus(1, "ENDED"))
        .to.emit(contract, "CampaignStatusUpdated")
        .withArgs(1, "EXTENDED", "ENDED", await time.latest() + 1);

      const c = await contract.getCampaign(1);
      expect(c.status).to.equal("ENDED");
    });
  });

  // ===========================================================
  // Skenario 12: Event yang diharapkan berhasil dipancarkan
  // ===========================================================
  describe("12. Semua event penting berhasil dipancarkan", function () {
    it("BackendAuthorized dipancarkan saat authorizeBackend dipanggil", async function () {
      await expect(contract.connect(owner).authorizeBackend(other.address))
        .to.emit(contract, "BackendAuthorized")
        .withArgs(other.address, await time.latest() + 1);
    });

    it("BackendRevoked dipancarkan saat revokeBackend dipanggil", async function () {
      await contract.connect(owner).authorizeBackend(other.address);
      await expect(contract.connect(owner).revokeBackend(other.address))
        .to.emit(contract, "BackendRevoked")
        .withArgs(other.address, await time.latest() + 1);
    });

    it("isDonationRecorded mengembalikan true setelah donasi dicatat", async function () {
      const deadline = await futureDeadline(30);
      await contract.connect(backend).createCampaign(1, "Kampanye Test", 10_000_000, deadline);

      const refHash = hashOrderId("DONASI-1-6-1704067200000");
      expect(await contract.isDonationRecorded(refHash)).to.equal(false);

      await contract.connect(backend).recordDonation(1, refHash, 75_000);
      expect(await contract.isDonationRecorded(refHash)).to.equal(true);
    });

    it("getAllCampaignIds mengembalikan semua ID kampanye yang dibuat", async function () {
      const deadline = await futureDeadline(30);
      await contract.connect(backend).createCampaign(1, "Kampanye A", 10_000_000, deadline);
      await contract.connect(backend).createCampaign(2, "Kampanye B", 5_000_000, deadline);
      await contract.connect(backend).createCampaign(3, "Kampanye C", 8_000_000, deadline);

      const ids = await contract.getAllCampaignIds();
      expect(ids.map(Number)).to.deep.equal([1, 2, 3]);
    });
  });
});
