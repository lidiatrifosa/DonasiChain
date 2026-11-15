"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const crypto         = require("crypto");
const midtransClient = require("midtrans-client");
const { body }       = require("express-validator");
const { validationResult } = require("express-validator");
const {
  verifyWebhookSignature,
  mapMidtransStatus,
  isFinalPaymentStatus,
  applySnapTokenVisibility,
  webhookAmountMatchesDb,
} = require("../utils/payment.helpers");

const results = [];
let nPass = 0;
let nFail = 0;
let nSkip = 0;

function pass(label)       { nPass++; results.push({ s: "✅", label }); }
function fail(label, note) { nFail++; results.push({ s: "❌", label, note }); }
function skip(label, note) { nSkip++; results.push({ s: "⏭ ", label, note }); }

function check(label, condition, failNote = "") {
  condition ? pass(label) : fail(label, failNote);
}

function header(title) { results.push({ header: true, label: title }); }

function buildSignature(order_id, status_code, gross_amount, serverKey) {
  return crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + serverKey)
    .digest("hex");
}

async function runUnitTests() {

  header("U1 · Konfigurasi Midtrans [UNIT]");

  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  const clientKey = process.env.MIDTRANS_CLIENT_KEY || "";

  check("MIDTRANS_SERVER_KEY tersedia di .env",
    serverKey.length > 0,
    "Set MIDTRANS_SERVER_KEY di .env");

  check("MIDTRANS_CLIENT_KEY tersedia di .env",
    clientKey.length > 0,
    "Set MIDTRANS_CLIENT_KEY di .env");

  check("Server Key dimulai 'SB-' — memastikan Sandbox bukan Production",
    serverKey.startsWith("SB-"),
    `Prefix ditemukan: "${serverKey.substring(0, 10)}..." — harus SB-`);

  if (serverKey && clientKey) {
    const snap = new midtransClient.Snap({
      isProduction: false,
      serverKey,
      clientKey,
    });
    check("Snap object berhasil dibuat",
      !!snap && typeof snap.createTransaction === "function");
    check("snap.apiConfig.isProduction === false (Sandbox endpoint aktif)",
      snap.apiConfig.isProduction === false);
  } else {
    skip("Snap object — dilewati, key tidak tersedia");
  }

  header("U2 · Format order_id [UNIT]");

  const worstCase = "DONASI-4294967295-4294967295-1700000000000";
  check("order_id worst-case ≤ 50 karakter (batas Midtrans)",
    worstCase.length <= 50,
    `Panjang: ${worstCase.length} karakter`);

  const example = `DONASI-1-5-${Date.now()}`;
  check("order_id hanya mengandung karakter yang diizinkan Midtrans (alfanumerik, dash)",
    /^[A-Za-z0-9\-_~.]+$/.test(example),
    example);

  header("U3 · Validator route donasi [UNIT — express-validator langsung]");

  async function runValidator(validatorChain, reqBody) {
    const req = {
      body: reqBody,
      query: {},
      params: {},
      headers: {},
      cookies: {},
    };
    const chain = Array.isArray(validatorChain) ? validatorChain : [validatorChain];
    for (const middleware of chain) {
      await middleware(req, {}, () => {});
    }
    return validationResult(req);
  }

  const amountValidator = body("amount").isInt({ min: 10000 })
    .withMessage("Nominal donasi minimal Rp 10.000.");

  const resUnder = await runValidator(amountValidator, { amount: 9999 });
  check("amount=9999 → validator mengembalikan error (di bawah minimum Rp 10.000)",
    !resUnder.isEmpty(),
    "Validator harus menolak nilai di bawah 10000");

  const resExact = await runValidator(amountValidator, { amount: 10000 });
  check("amount=10000 → validator valid (tepat di batas minimum)",
    resExact.isEmpty(),
    "Validator harus menerima nilai tepat 10000");

  const resOver = await runValidator(amountValidator, { amount: 50000 });
  check("amount=50000 → validator valid",
    resOver.isEmpty());

  const resString = await runValidator(amountValidator, { amount: "bukan_angka" });
  check("amount='bukan_angka' → validator mengembalikan error",
    !resString.isEmpty());

  const resZero = await runValidator(amountValidator, { amount: 0 });
  check("amount=0 → validator mengembalikan error",
    !resZero.isEmpty());

  header("U4 · Konsistensi nominal [UNIT]");

  const rawAmount    = "75000";
  const gross_amount = parseInt(rawAmount);
  const item_total   = parseInt(rawAmount) * 1;

  check("gross_amount == sum(item_details) — tidak ada mismatch Midtrans",
    gross_amount === item_total,
    `gross=${gross_amount}, items=${item_total}`);

  check("parseInt('75000') menghasilkan number bukan NaN",
    !isNaN(gross_amount) && typeof gross_amount === "number");

  check("parseInt(amount) tidak mengubah nilai untuk integer Rupiah normal",
    parseInt("50000") === 50000);

  header("U5 · Pemetaan status Midtrans → DB [UNIT — helper produksi: mapMidtransStatus]");

  const statusCases = [
    { ts: "settlement",     fs: undefined,   exp: "success",  desc: "settlement → success (bank transfer / e-wallet)" },
    { ts: "capture",        fs: "accept",    exp: "success",  desc: "capture + accept → success (kartu kredit tanpa fraud)" },
    { ts: "capture",        fs: "challenge", exp: "pending",  desc: "capture + challenge → pending (menunggu review manual)" },
    { ts: "capture",        fs: "deny",      exp: "failed",   desc: "capture + deny → failed" },
    { ts: "cancel",         fs: undefined,   exp: "failed",   desc: "cancel → failed" },
    { ts: "deny",           fs: undefined,   exp: "failed",   desc: "deny → failed" },
    { ts: "failure",        fs: undefined,   exp: "failed",   desc: "failure → failed" },
    { ts: "expire",         fs: undefined,   exp: "expired",  desc: "expire → expired" },
    { ts: "pending",        fs: undefined,   exp: "pending",  desc: "pending → pending (VA/QRIS belum bayar)" },
    { ts: "refund",         fs: undefined,   exp: "pending",  desc: "refund → pending (tidak ada cabang di helper)" },
    { ts: "partial_refund", fs: undefined,   exp: "pending",  desc: "partial_refund → pending" },
    { ts: "chargeback",     fs: undefined,   exp: "pending",  desc: "chargeback → pending" },
    { ts: "",               fs: undefined,   exp: "pending",  desc: "empty string → pending (aman sebagai default)" },
  ];

  for (const { ts, fs, exp, desc } of statusCases) {
    const got = mapMidtransStatus(ts, fs);
    check(`Pemetaan: ${desc}`, got === exp, `Got: "${got}", Expected: "${exp}"`);
  }

  header("U6 · Idempotency — isFinalPaymentStatus [UNIT — helper produksi]");

  check("'success' adalah final status",
    isFinalPaymentStatus("success"));
  check("'failed' adalah final status",
    isFinalPaymentStatus("failed"));
  check("'expired' adalah final status",
    isFinalPaymentStatus("expired"));
  check("'pending' bukan final status",
    !isFinalPaymentStatus("pending"));
  check("string kosong bukan final status",
    !isFinalPaymentStatus(""));

  const dbStatusAfterSettlement = "success";
  const webhookIsBlocked        = isFinalPaymentStatus(dbStatusAfterSettlement);
  const refundMappedResult      = mapMidtransStatus("refund", undefined);

  check("Webhook refund setelah settlement: isFinalPaymentStatus memblokir sebelum mapMidtransStatus dipakai",
    webhookIsBlocked,
    "isFinalPaymentStatus('success') harus true");

  check("mapMidtransStatus('refund') menghasilkan 'pending' — tidak dipakai karena diblokir idempotency",
    refundMappedResult === "pending",
    `Got: "${refundMappedResult}"`);

  check("'pending' ≠ 'success' — jika idempotency dilewati, refund akan mengubah status (regresi test)",
    refundMappedResult !== dbStatusAfterSettlement);

  header("U7 · Verifikasi signature webhook [UNIT — helper produksi: verifyWebhookSignature]");

  const SK = process.env.MIDTRANS_SERVER_KEY;
  if (!SK) {
    skip("Semua test signature — MIDTRANS_SERVER_KEY tidak tersedia");
  } else {
    const base = {
      order_id:     "DONASI-1-1-1700000000000",
      status_code:  "200",
      gross_amount: "50000.00",
    };
    const validSig = buildSignature(base.order_id, base.status_code, base.gross_amount, SK);

    check("Signature valid → diterima",
      verifyWebhookSignature({ ...base, signature_key: validSig }, SK));

    const lastChar = validSig.slice(-1);
    const flipped  = lastChar === "a" ? "b" : "a";
    check("Signature satu karakter berbeda → ditolak",
      !verifyWebhookSignature({ ...base, signature_key: validSig.slice(0, -1) + flipped }, SK));

    check("Signature string kosong → ditolak",
      !verifyWebhookSignature({ ...base, signature_key: "" }, SK));

    check("Signature null → ditolak",
      !verifyWebhookSignature({ ...base, signature_key: null }, SK));

    check("Signature undefined → ditolak",
      !verifyWebhookSignature({ ...base, signature_key: undefined }, SK));

    const tamperedAmtSig = buildSignature(base.order_id, base.status_code, "9999999.00", SK);
    check("Signature dengan gross_amount dimanipulasi → ditolak",
      !verifyWebhookSignature({ ...base, signature_key: tamperedAmtSig }, SK));

    const tamperedOrderSig = buildSignature("DONASI-99-99-9999999", base.status_code, base.gross_amount, SK);
    check("Signature dengan order_id dimanipulasi → ditolak",
      !verifyWebhookSignature({ ...base, signature_key: tamperedOrderSig }, SK));

    const tamperedStatusSig = buildSignature(base.order_id, "400", base.gross_amount, SK);
    check("Signature dengan status_code dimanipulasi → ditolak",
      !verifyWebhookSignature({ ...base, signature_key: tamperedStatusSig }, SK));

    const wrongKeySig = buildSignature(base.order_id, base.status_code, base.gross_amount, "WRONG-KEY");
    check("Signature dibuat dengan server key salah → ditolak",
      !verifyWebhookSignature({ ...base, signature_key: wrongKeySig }, SK));
  }

  header("U8 · snap_token visibility [UNIT — helper produksi: applySnapTokenVisibility]");

  const tokenCases = [
    { payment_status: "pending",  hasToken: true,  desc: "pending → snap_token tetap ada" },
    { payment_status: "success",  hasToken: false, desc: "success → snap_token dihapus" },
    { payment_status: "failed",   hasToken: false, desc: "failed → snap_token dihapus" },
    { payment_status: "expired",  hasToken: false, desc: "expired → snap_token dihapus" },
  ];

  for (const { payment_status, hasToken, desc } of tokenCases) {
    const result = applySnapTokenVisibility({ payment_status, snap_token: "tok-test-123" });
    const got    = "snap_token" in result;
    check(desc, got === hasToken,
      `snap_token hadir: ${got}, diharapkan: ${hasToken}`);
  }

  header("U9 · Isolasi kegagalan blockchain dari payment_status [UNIT — simulasi logika setImmediate]");

  async function simulateBlockchainCallback(mockFn) {
    const state = { payment_status: "success", blockchain_status: "not_recorded" };
    try {
      const txHash = await mockFn();
      if (txHash) {
        state.blockchain_status  = "recorded";
        state.blockchain_tx_hash = txHash;
      } else {
        state.blockchain_status = "failed";
      }
    } catch {
      state.blockchain_status = "failed";
    }
    return state;
  }

  const sNull = await simulateBlockchainCallback(async () => null);
  check("blockchain return null → payment_status tetap 'success'",
    sNull.payment_status === "success");
  check("blockchain return null → blockchain_status = 'failed'",
    sNull.blockchain_status === "failed");
  check("blockchain return null → blockchain_tx_hash tidak diisi",
    !sNull.blockchain_tx_hash);

  const sThrow = await simulateBlockchainCallback(async () => {
    throw new Error("eth_sendRawTransaction: insufficient funds");
  });
  check("blockchain throw error → payment_status tetap 'success'",
    sThrow.payment_status === "success");
  check("blockchain throw error → blockchain_status = 'failed'",
    sThrow.blockchain_status === "failed");

  const fakeTx = "0x" + "a".repeat(64);
  const sOk    = await simulateBlockchainCallback(async () => fakeTx);
  check("blockchain return txHash → blockchain_status = 'recorded'",
    sOk.blockchain_status === "recorded");
  check("blockchain return txHash → blockchain_tx_hash terisi benar",
    sOk.blockchain_tx_hash === fakeTx);
  check("blockchain return txHash → payment_status tetap 'success'",
    sOk.payment_status === "success");

  header("U10 · Validasi nominal webhook [UNIT — helper produksi: webhookAmountMatchesDb]");

  const amountCases = [
    { raw: "50000.00",           db: 50000,             exp: true,  desc: "'50000.00' cocok dengan 50000 (format desimal 2 angka)" },
    { raw: "50000",              db: 50000,             exp: true,  desc: "'50000' cocok dengan 50000 (integer string)" },
    { raw: "50000.0",            db: 50000,             exp: true,  desc: "'50000.0' cocok dengan 50000 (desimal 1 angka)" },
    { raw: "50001.00",           db: 50000,             exp: false, desc: "'50001.00' tidak cocok dengan 50000 (nominal berbeda)" },
    { raw: "50000abc",           db: 50000,             exp: false, desc: "'50000abc' ditolak (format tidak valid)" },
    { raw: "",                   db: 50000,             exp: false, desc: "string kosong ditolak" },
    { raw: null,                 db: 50000,             exp: false, desc: "null ditolak (bukan string)" },
    { raw: "50000.001",          db: 50000,             exp: false, desc: "lebih dari 2 desimal ditolak" },
    { raw: "50000.00",           db: 50001,             exp: false, desc: "'50000.00' tidak cocok dengan 50001" },
    { raw: "9999999999999999",   db: 9999999999999999,  exp: false, desc: "angka melebihi safe integer ditolak" },
  ];

  for (const { raw, db, exp, desc } of amountCases) {
    const got = webhookAmountMatchesDb(raw, db);
    check(`webhookAmountMatchesDb: ${desc}`, got === exp, `Got: ${got}, Expected: ${exp}`);
  }
}

async function runIntegrationTests() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  const clientKey = process.env.MIDTRANS_CLIENT_KEY || "";

  const sandboxReady = serverKey.length > 0 && clientKey.length > 0 && serverKey.startsWith("SB-");

  if (!sandboxReady) {
    header("INTEGRATION — semua dilewati (konfigurasi Sandbox tidak tersedia)");
    skip("I1: Snap token creation", "MIDTRANS_SERVER_KEY prefix SB- tidak ditemukan");
    skip("I2: Server Key invalid → 401", "Konfigurasi tidak tersedia");
    return;
  }

  const snap = new midtransClient.Snap({ isProduction: false, serverKey, clientKey });

  header("I1 · Pembuatan Snap token [INTEGRATION — memanggil Midtrans Sandbox API]");

  try {
    const orderId = `DONASI-TEST-${Date.now()}`;
    const result  = await snap.createTransaction({
      transaction_details: { order_id: orderId, gross_amount: 10000 },
      customer_details:    { first_name: "Test Donatur", email: "test@donasichain.test" },
      item_details:        [{ id: "CAMPAIGN-TEST", price: 10000, quantity: 1, name: "Donasi: Test Sandbox" }],
    });

    check("API Sandbox mengembalikan response objek", !!result);
    check("snap_token hadir dan berupa string non-kosong",
      typeof result.token === "string" && result.token.length > 0,
      `token prefix: ${result.token ? result.token.substring(0, 10) + "..." : "kosong"}`);
    check("redirect_url hadir dan berupa string",
      typeof result.redirect_url === "string" && result.redirect_url.length > 0);
    check("redirect_url mengarah ke sandbox.midtrans.com (bukan produksi)",
      result.redirect_url.includes("sandbox.midtrans.com"),
      `URL: ${result.redirect_url}`);

  } catch (err) {
    const isNetwork = err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND";
    if (isNetwork) {
      skip("I1: Snap token creation", `Gagal koneksi ke Sandbox (${err.code}) — bukan error konfigurasi`);
      skip("I2: Server Key invalid → 401", "Dilewati karena koneksi ke Sandbox tidak tersedia");
      return;
    }
    fail("snap.createTransaction sukses ke Sandbox",
      `Error: ${err.message}${err.ApiResponse ? " | " + JSON.stringify(err.ApiResponse) : ""}`);
    fail("snap_token hadir", "Dilewati — createTransaction gagal");
    fail("redirect_url hadir", "Dilewati");
    fail("redirect_url mengarah ke sandbox.midtrans.com", "Dilewati");
  }

  header("I2 · Server Key tidak valid [INTEGRATION — memanggil Midtrans Sandbox API]");

  const badSnap = new midtransClient.Snap({
    isProduction: false,
    serverKey:   "SB-Mid-server-INVALID_KEY_FOR_TESTING_ONLY",
    clientKey:   "Mid-client-INVALID",
  });

  try {
    await badSnap.createTransaction({
      transaction_details: { order_id: `FAIL-${Date.now()}`, gross_amount: 10000 },
      customer_details:    { first_name: "Test", email: "test@test.com" },
      item_details:        [{ id: "X", price: 10000, quantity: 1, name: "Test" }],
    });
    fail("Server Key invalid → Midtrans seharusnya menolak",
      "Midtrans menerima key yang jelas tidak valid — tidak diharapkan");
  } catch (err) {
    const isNetwork = err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND";
    if (isNetwork) {
      skip("I2: Server Key invalid → 401",
        `Koneksi ke Sandbox gagal (${err.code}) — tidak bisa membedakan 401 dari network error`);
      return;
    }
    const is401 =
      (typeof err.message === "string" && err.message.includes("401")) ||
      (err.ApiResponse && String(err.ApiResponse.status_code) === "401");
    check("Server Key invalid → Midtrans mengembalikan 401 Unauthorized (bukan network error)",
      is401,
      `Error diterima: ${err.message} | ApiResponse: ${JSON.stringify(err.ApiResponse || {})}`);
  }
}

async function main() {
  console.log("");
  console.log("DonasiChain — Midtrans Payment Gateway Tests");
  console.log("=".repeat(60));

  await runUnitTests();
  await runIntegrationTests();

  console.log("");
  for (const r of results) {
    if (r.header) {
      console.log(`\n── ${r.label}`);
    } else {
      console.log(`  ${r.s} ${r.label}`);
      if (r.note) console.log(`      ↳ ${r.note}`);
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(` ✅ ${nPass} lulus   ❌ ${nFail} gagal   ⏭  ${nSkip} dilewati   total: ${nPass + nFail + nSkip}`);
  console.log("=".repeat(60));
  console.log("");

  process.exit(nFail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner error:", err.message);
  process.exit(1);
});
