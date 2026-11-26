import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createVoluntaryDonation } from '../api/donation';
import styles from './VoluntaryDonation.module.css';

const NOMINAL_CEPAT = [10000, 25000, 50000, 100000];

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function VoluntaryDonation() {
  const navigate = useNavigate();

  const [nominal, setNominal] = useState('');
  const [pesan, setPesan] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // State setelah transaksi berhasil dibuat
  const [snapToken, setSnapToken] = useState(null);
  const [redirectUrl, setRedirectUrl] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [confirmedAmount, setConfirmedAmount] = useState(null);

  const handleNominalCepat = (nilai) => {
    setNominal(String(nilai));
    setFieldError('');
    setServerError('');
  };

  const handleNominalChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setNominal(val);
    setFieldError('');
    setServerError('');
  };

  const validate = () => {
    const num = parseInt(nominal);
    if (!nominal || isNaN(num)) return 'Nominal donasi wajib diisi.';
    if (num < 10000) return 'Nominal donasi minimal Rp 10.000.';
    if (pesan.length > 300) return 'Pesan maksimal 300 karakter.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const err = validate();
    if (err) { setFieldError(err); return; }

    // Cegah submit ganda
    if (snapToken) return;

    setSubmitting(true);
    try {
      const res = await createVoluntaryDonation({
        amount: parseInt(nominal),
        message: pesan.trim() || undefined,
      });

      const { snap_token, redirect_url, order_id, amount } = res.data.data;
      setSnapToken(snap_token);
      setRedirectUrl(redirect_url);
      setOrderId(order_id);
      setConfirmedAmount(amount);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Tampilan setelah donasi berhasil dibuat ──────────────────────────────
  if (snapToken) {
    return (
      <div className={styles.page}>
        <div className={styles.successCard}>
          <span className={styles.successIcon}>✓</span>
          <h2 className={styles.successTitle}>Donasi Berhasil Dibuat!</h2>
          <p className={styles.successDesc}>
            Terima kasih atas dukungan kamu sebesar{' '}
            <strong>{formatRupiah(confirmedAmount)}</strong> untuk pengembangan DonasiChain.
            Selesaikan pembayaran melalui Midtrans.
          </p>

          <div className={styles.midtransInfo}>
            <p className={styles.midtransLabel}>🔗 Lanjutkan Pembayaran</p>
            <p className={styles.midtransHint}>
              Klik tombol di bawah untuk membuka halaman pembayaran Midtrans.
            </p>
            {redirectUrl && (
              <a
                href={redirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnMidtrans}
              >
                Bayar via Midtrans →
              </a>
            )}
          </div>

          <div className={styles.orderInfo}>
            <p className={styles.orderLabel}>Order ID</p>
            <code className={styles.orderValue}>{orderId}</code>
          </div>

          <div className={styles.successActions}>
            <button
              onClick={() => navigate(`/status/voluntary/${orderId}`)}
              className={styles.btnCekStatus}
            >
              Cek Status Pembayaran
            </button>
            <Link to="/dashboard" className={styles.btnDashboard}>
              Ke Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Form donasi sukarela ─────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        {/* Panel kiri — info platform */}
        <div className={styles.infoPanel}>
          <div className={styles.infoBadge}>💚 Sukarela</div>
          <h2 className={styles.infoTitle}>Dukung Pengembangan DonasiChain</h2>
          <p className={styles.infoDesc}>
            DonasiChain adalah platform donasi berbasis blockchain yang memastikan transparansi
            setiap transaksi. Donasi sukarela kamu membantu kami menjaga server, mengembangkan
            fitur baru, dan meningkatkan keamanan platform.
          </p>

          <div className={styles.infoPoints}>
            <div className={styles.infoPoint}>
              <span className={styles.infoPointIcon}>🔗</span>
              <div>
                <p className={styles.infoPointTitle}>Tercatat Transparan</p>
                <p className={styles.infoPointDesc}>Setiap transaksi terverifikasi melalui Midtrans dengan keamanan penuh.</p>
              </div>
            </div>
            <div className={styles.infoPoint}>
              <span className={styles.infoPointIcon}>🛡️</span>
              <div>
                <p className={styles.infoPointTitle}>Aman & Terpercaya</p>
                <p className={styles.infoPointDesc}>Dana tidak tercampur dengan donasi kampanye manapun.</p>
              </div>
            </div>
            <div className={styles.infoPoint}>
              <span className={styles.infoPointIcon}>💡</span>
              <div>
                <p className={styles.infoPointTitle}>Tanpa Kewajiban</p>
                <p className={styles.infoPointDesc}>Nominal sepenuhnya bebas, mulai dari Rp 10.000.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Panel kanan — form */}
        <div className={styles.formCard}>
          <h1 className={styles.formTitle}>Pilih Nominal Donasi</h1>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {serverError && (
              <div className={styles.alertError}>{serverError}</div>
            )}

            {/* Nominal cepat */}
            <div className={styles.field}>
              <label className={styles.label}>Nominal Pilihan</label>
              <div className={styles.nominalGrid}>
                {NOMINAL_CEPAT.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`${styles.nominalBtn} ${parseInt(nominal) === n ? styles.nominalActive : ''}`}
                    onClick={() => handleNominalCepat(n)}
                  >
                    {formatRupiah(n)}
                  </button>
                ))}
              </div>
            </div>

            {/* Input nominal manual */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="nominal">
                Atau masukkan nominal lain
              </label>
              <div className={`${styles.inputPrefix} ${fieldError ? styles.inputPrefixError : ''}`}>
                <span className={styles.prefix}>Rp</span>
                <input
                  id="nominal"
                  type="text"
                  inputMode="numeric"
                  className={styles.input}
                  placeholder="Contoh: 75000"
                  value={nominal}
                  onChange={handleNominalChange}
                />
              </div>
              {nominal && !fieldError && parseInt(nominal) >= 10000 && (
                <p className={styles.nominalPreview}>{formatRupiah(parseInt(nominal))}</p>
              )}
              {fieldError && <p className={styles.fieldError}>{fieldError}</p>}
              <p className={styles.hint}>Minimal donasi Rp 10.000</p>
            </div>

            {/* Pesan opsional */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="pesan">
                Pesan <span className={styles.opsional}>(opsional)</span>
              </label>
              <textarea
                id="pesan"
                className={styles.textarea}
                placeholder="Tulis semangat atau pesan untuk tim DonasiChain..."
                value={pesan}
                onChange={(e) => setPesan(e.target.value)}
                rows={3}
                maxLength={300}
              />
              <p className={styles.charCount}>{pesan.length}/300</p>
            </div>

            <button
              type="submit"
              className={styles.btnSubmit}
              disabled={submitting}
            >
              {submitting
                ? 'Memproses...'
                : `Donasi ${nominal && parseInt(nominal) >= 10000 ? formatRupiah(parseInt(nominal)) : 'Sekarang'}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
