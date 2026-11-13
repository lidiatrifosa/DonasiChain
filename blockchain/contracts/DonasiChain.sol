// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DonasiChain
 * @notice Smart contract pencatatan donasi dan manajemen kampanye DonasiChain.
 *         Contract ini TIDAK menyimpan atau mengelola dana (ETH/Rupiah).
 *         Fungsinya murni sebagai pencatatan bukti transaksi di Ethereum Sepolia.
 *
 * Alur integrasi:
 *   Backend (Midtrans webhook verified) → recordDonation() → event DonationRecorded
 *   Scheduler / Admin → updateCampaignStatus() → event CampaignStatusUpdated
 */
contract DonasiChain {
    // =========================================================
    // Custom Errors — lebih hemat gas dibanding string revert
    // =========================================================
    error NotOwner();
    error NotAuthorizedBackend();
    error CampaignAlreadyExists(uint256 campaignId);
    error CampaignNotFound(uint256 campaignId);
    error CampaignNotAcceptingDonations(uint256 campaignId, string currentStatus);
    error CampaignDeadlinePassed(uint256 campaignId);
    error DonationAlreadyRecorded(bytes32 donationId);
    error InvalidAmount();
    error InvalidTarget();
    error InvalidDeadline();
    error InvalidStatus();
    error EmptyDonationId();

    // =========================================================
    // Structs
    // =========================================================
    struct Campaign {
        uint256 id;
        string title;           // Nama kampanye (bukan data pribadi)
        uint256 targetAmount;   // Target dana dalam Rupiah
        uint256 collectedAmount;// Total dana tercatat di blockchain
        uint256 createdAt;      // Unix timestamp pembuatan
        uint256 deadline;       // Unix timestamp tenggat awal
        uint256 extendedDeadline; // Unix timestamp tenggat perpanjangan (0 jika belum diperpanjang)
        string status;          // "ACTIVE" | "EXTENDED" | "TARGET_REACHED" | "RELEASED" | "ENDED"
        bool exists;
    }

    struct Donation {
        bytes32 id;             // keccak256(order_id) — referensi unik dari backend
        uint256 campaignId;
        bytes32 paymentRefHash; // keccak256(order_id Midtrans) — bukti pembayaran tanpa data pribadi
        uint256 amount;         // Nominal donasi dalam Rupiah
        uint256 timestamp;      // Unix timestamp pencatatan
        bool exists;
    }

    // =========================================================
    // State Variables
    // =========================================================
    address public owner;

    /// @notice Wallet backend yang diotorisasi mencatat transaksi
    mapping(address => bool) public authorizedBackends;

    mapping(uint256 => Campaign) private campaigns;
    mapping(bytes32 => Donation) private donations;

    /// @notice Daftar campaign ID yang pernah dibuat (untuk iterasi off-chain)
    uint256[] private campaignIds;

    // =========================================================
    // Events
    // =========================================================
    event CampaignCreated(
        uint256 indexed campaignId,
        string title,
        uint256 targetAmount,
        uint256 deadline,
        uint256 timestamp
    );

    event DonationRecorded(
        uint256 indexed campaignId,
        bytes32 indexed donationId,
        bytes32 paymentRefHash,
        uint256 amount,
        uint256 timestamp
    );

    event CampaignExtended(
        uint256 indexed campaignId,
        uint256 newDeadline,
        uint256 timestamp
    );

    event CampaignStatusUpdated(
        uint256 indexed campaignId,
        string oldStatus,
        string newStatus,
        uint256 timestamp
    );

    event BackendAuthorized(address indexed backend, uint256 timestamp);
    event BackendRevoked(address indexed backend, uint256 timestamp);

    // =========================================================
    // Modifiers
    // =========================================================
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (!authorizedBackends[msg.sender] && msg.sender != owner) {
            revert NotAuthorizedBackend();
        }
        _;
    }

    // =========================================================
    // Constructor
    // =========================================================
    constructor() {
        owner = msg.sender;
        // Deployer otomatis menjadi backend yang diotorisasi
        authorizedBackends[msg.sender] = true;
        emit BackendAuthorized(msg.sender, block.timestamp);
    }

    // =========================================================
    // Manajemen Hak Akses
    // =========================================================

    /**
     * @notice Tambahkan wallet backend yang diotorisasi.
     * @param backend Alamat wallet backend (BACKEND_WALLET_PRIVATE_KEY di .env backend).
     */
    function authorizeBackend(address backend) external onlyOwner {
        authorizedBackends[backend] = true;
        emit BackendAuthorized(backend, block.timestamp);
    }

    /**
     * @notice Cabut otorisasi wallet backend.
     */
    function revokeBackend(address backend) external onlyOwner {
        authorizedBackends[backend] = false;
        emit BackendRevoked(backend, block.timestamp);
    }

    // =========================================================
    // Manajemen Kampanye
    // =========================================================

    /**
     * @notice Catat kampanye baru ke blockchain.
     * @param campaignId  ID kampanye dari database backend.
     * @param title       Nama kampanye (bukan data pribadi donatur).
     * @param targetAmount Target dana dalam Rupiah.
     * @param deadline    Unix timestamp tenggat kampanye.
     */
    function createCampaign(
        uint256 campaignId,
        string calldata title,
        uint256 targetAmount,
        uint256 deadline
    ) external onlyAuthorized {
        if (campaigns[campaignId].exists) revert CampaignAlreadyExists(campaignId);
        if (targetAmount == 0) revert InvalidTarget();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        campaigns[campaignId] = Campaign({
            id: campaignId,
            title: title,
            targetAmount: targetAmount,
            collectedAmount: 0,
            createdAt: block.timestamp,
            deadline: deadline,
            extendedDeadline: 0,
            status: "ACTIVE",
            exists: true
        });

        campaignIds.push(campaignId);

        emit CampaignCreated(campaignId, title, targetAmount, deadline, block.timestamp);
    }

    /**
     * @notice Perpanjang tenggat kampanye.
     * @param campaignId     ID kampanye.
     * @param newDeadline    Unix timestamp tenggat baru.
     */
    function extendCampaign(uint256 campaignId, uint256 newDeadline) external onlyAuthorized {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound(campaignId);
        if (newDeadline <= block.timestamp) revert InvalidDeadline();

        c.extendedDeadline = newDeadline;
        string memory oldStatus = c.status;
        c.status = "EXTENDED";

        emit CampaignExtended(campaignId, newDeadline, block.timestamp);
        emit CampaignStatusUpdated(campaignId, oldStatus, "EXTENDED", block.timestamp);
    }

    /**
     * @notice Perbarui status kampanye.
     *         Dipanggil backend/scheduler saat status berubah.
     *         Status valid: "ACTIVE" | "EXTENDED" | "TARGET_REACHED" | "RELEASED" | "ENDED"
     * @param campaignId ID kampanye.
     * @param newStatus  Status baru dalam huruf kapital.
     */
    function updateCampaignStatus(uint256 campaignId, string calldata newStatus) external onlyAuthorized {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound(campaignId);
        if (!_isValidStatus(newStatus)) revert InvalidStatus();

        string memory oldStatus = c.status;
        c.status = newStatus;

        emit CampaignStatusUpdated(campaignId, oldStatus, newStatus, block.timestamp);
    }

    // =========================================================
    // Pencatatan Donasi
    // =========================================================

    /**
     * @notice Catat donasi yang sudah diverifikasi backend ke blockchain.
     *         Hanya dapat dipanggil oleh wallet backend yang diotorisasi.
     *         Satu donationId hanya dapat dicatat satu kali (idempotent).
     *
     * @param campaignId      ID kampanye dari database.
     * @param paymentRefHash  keccak256(order_id Midtrans) — bukti pembayaran tanpa data pribadi.
     * @param amount          Nominal donasi dalam Rupiah (integer).
     *
     * Catatan: donationId dihitung dari paymentRefHash agar konsisten dengan backend.
     */
    function recordDonation(
        uint256 campaignId,
        bytes32 paymentRefHash,
        uint256 amount
    ) external onlyAuthorized {
        if (amount == 0) revert InvalidAmount();
        if (paymentRefHash == bytes32(0)) revert EmptyDonationId();

        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound(campaignId);

        // Cek status kampanye — hanya ACTIVE dan EXTENDED yang menerima donasi
        if (!_isAcceptingDonations(c.status)) {
            revert CampaignNotAcceptingDonations(campaignId, c.status);
        }

        // Gunakan paymentRefHash sebagai donation ID — sudah unik per order_id Midtrans
        bytes32 donationId = paymentRefHash;
        if (donations[donationId].exists) revert DonationAlreadyRecorded(donationId);

        // Catat donasi
        donations[donationId] = Donation({
            id: donationId,
            campaignId: campaignId,
            paymentRefHash: paymentRefHash,
            amount: amount,
            timestamp: block.timestamp,
            exists: true
        });

        // Update total terkumpul di kampanye
        c.collectedAmount += amount;

        // Cek apakah target tercapai
        if (c.collectedAmount >= c.targetAmount && _isAcceptingDonations(c.status)) {
            string memory oldStatus = c.status;
            c.status = "TARGET_REACHED";
            emit CampaignStatusUpdated(campaignId, oldStatus, "TARGET_REACHED", block.timestamp);
        }

        emit DonationRecorded(campaignId, donationId, paymentRefHash, amount, block.timestamp);
    }

    // =========================================================
    // Fungsi Baca (View)
    // =========================================================

    /**
     * @notice Ambil data kampanye berdasarkan ID.
     */
    function getCampaign(uint256 campaignId)
        external
        view
        returns (
            uint256 id,
            string memory title,
            uint256 targetAmount,
            uint256 collectedAmount,
            uint256 createdAt,
            uint256 deadline,
            uint256 extendedDeadline,
            string memory status
        )
    {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound(campaignId);
        return (
            c.id,
            c.title,
            c.targetAmount,
            c.collectedAmount,
            c.createdAt,
            c.deadline,
            c.extendedDeadline,
            c.status
        );
    }

    /**
     * @notice Ambil data donasi berdasarkan paymentRefHash (keccak256 order_id).
     */
    function getDonation(bytes32 donationId)
        external
        view
        returns (
            bytes32 id,
            uint256 campaignId,
            bytes32 paymentRefHash,
            uint256 amount,
            uint256 timestamp
        )
    {
        Donation storage d = donations[donationId];
        if (!d.exists) return (bytes32(0), 0, bytes32(0), 0, 0);
        return (d.id, d.campaignId, d.paymentRefHash, d.amount, d.timestamp);
    }

    /**
     * @notice Cek apakah sebuah donasi sudah tercatat.
     * @param paymentRefHash keccak256(order_id) dari backend.
     */
    function isDonationRecorded(bytes32 paymentRefHash) external view returns (bool) {
        return donations[paymentRefHash].exists;
    }

    /**
     * @notice Ambil semua campaign ID yang pernah dibuat.
     */
    function getAllCampaignIds() external view returns (uint256[] memory) {
        return campaignIds;
    }

    // =========================================================
    // Internal Helpers
    // =========================================================

    function _isValidStatus(string calldata status) internal pure returns (bool) {
        bytes32 h = keccak256(bytes(status));
        return (
            h == keccak256(bytes("ACTIVE")) ||
            h == keccak256(bytes("EXTENDED")) ||
            h == keccak256(bytes("TARGET_REACHED")) ||
            h == keccak256(bytes("RELEASED")) ||
            h == keccak256(bytes("ENDED"))
        );
    }

    function _isAcceptingDonations(string storage status) internal pure returns (bool) {
        bytes32 h = keccak256(bytes(status));
        return h == keccak256(bytes("ACTIVE")) || h == keccak256(bytes("EXTENDED"));
    }
}
