-- ============================================================
-- DonasiChain Database Migration
-- Jalankan file ini sekali untuk setup database
-- mysql -u root -p donasichain < migration.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS donasichain CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE donasichain;

-- ============================================================
-- Tabel users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role        ENUM('donor', 'fundraiser', 'admin') NOT NULL DEFAULT 'donor',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- Tabel campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           INT UNSIGNED NOT NULL,
  title             VARCHAR(200) NOT NULL,
  description       TEXT NOT NULL,
  target_amount     BIGINT UNSIGNED NOT NULL,
  collected_amount  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  deadline          DATE NOT NULL,
  extended_deadline DATE NULL,
  status            ENUM('active', 'extended', 'target_reached', 'released', 'ended') NOT NULL DEFAULT 'active',
  is_approved       BOOLEAN NOT NULL DEFAULT FALSE,
  contract_address  VARCHAR(42) NULL COMMENT 'Alamat smart contract dari tim blockchain',
  image_url         VARCHAR(500) NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- ============================================================
-- Tabel donations
-- ============================================================
CREATE TABLE IF NOT EXISTS donations (
  id                       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id              INT UNSIGNED NOT NULL,
  user_id                  INT UNSIGNED NOT NULL,
  order_id                 VARCHAR(100) NOT NULL UNIQUE COMMENT 'ID unik order Midtrans',
  amount                   BIGINT UNSIGNED NOT NULL,
  payment_status           ENUM('pending', 'success', 'failed', 'expired') NOT NULL DEFAULT 'pending',
  payment_method           VARCHAR(50) NULL,
  midtrans_transaction_id  VARCHAR(100) NULL,
  snap_token               VARCHAR(255) NULL,
  blockchain_tx_hash       VARCHAR(66) NULL COMMENT 'Hash transaksi Ethereum',
  blockchain_status        ENUM('not_recorded', 'pending', 'recorded', 'failed') NOT NULL DEFAULT 'not_recorded',
  message                  VARCHAR(300) NULL COMMENT 'Pesan opsional dari donatur',
  created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- ============================================================
-- Tabel campaign_status_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_status_logs (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id  INT UNSIGNED NOT NULL,
  old_status   VARCHAR(50) NOT NULL,
  new_status   VARCHAR(50) NOT NULL,
  changed_by   INT UNSIGNED NULL COMMENT 'NULL jika diubah oleh sistem otomatis',
  note         TEXT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- Index untuk performa query
-- ============================================================
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_is_approved ON campaigns(is_approved);
CREATE INDEX idx_donations_campaign_id ON donations(campaign_id);
CREATE INDEX idx_donations_user_id ON donations(user_id);
CREATE INDEX idx_donations_order_id ON donations(order_id);
CREATE INDEX idx_donations_payment_status ON donations(payment_status);
