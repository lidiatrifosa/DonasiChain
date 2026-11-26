import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCampaignById } from '../api/campaign';
import { createDonation } from '../api/donation';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from './DonasiPage.module.css';
import { getCampaignImage, useCampaignImageFallback } from '../utils/campaignImage';

const NOMINAL_CEPAT = [10000, 25000, 50000, 100000, 250000, 500000];

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DonasiPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [errorCampaign, setErrorCampaign] = useState(null);

  const [nominal, setNominal] = useState('');
  const [pesan, setPesan] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // State setelah donasi berhasil dibuat — menunggu pembayaran Midtrans
  const [snapToken, setSnapToken] = useState(null);
  const [redirectUrl, setRedirectUrl] = useState(null);
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    getCampaignById(id)
      .then((res) => setCampaign(res.data.data))
      .catch((err) => {
        if (err.response?.status === 404) setErrorCampaign('Kampanye tidak ditemukan.');
        else setErrorCampaign('Gagal memuat kampanye.');
      })
      .finally(() => setLoadingCampaign(false));
  }, [id]);

  const handleNominalCepat = (nilai) => {
    setNominal(String(nilai));
    setFieldError('');
  };

  const handleNominalChange = (e) => {
    // Hanya izinkan angka
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

    // Cegah submit ganda jika snapToken sudah ada
    if (snapToken) return;

    setSubmitting(true);
    try {
      const res = await createDonation({
        campaign_id: parseInt(id),
        amount: parseInt(nominal),
        message: pesan.trim() || undefined,
      });

      const { snap_token, redirect_url, order_id } = res.data.data;
      setSnapToken(snap_token);
      setRedirectUrl(redirect_url);
      setOrderId(order_id);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Tampilan loading / error kampanye ──────────────────────────────────────
  if (loadingCampaign) return <LoadingSpinner text="Memuat kampanye..." />;

  if (errorCampaign) {
    return (
      <div className={styles.errorWrap}>
        <p className={styles.errorMsg}>{errorCampaign}</p>
        <Link to="/kampanye" className={styles.btnKembali}>← Kembali ke Daftar</Link>
      </div>
    );
  }

  const campaignImage = getCampaignImage(campaign);

  // ── Tampilan setelah donasi berhasil dibuat ────────────────────────────────
  if (snapToken) {
    return (
      <div className={styles.page}>
        <div className={styles.successCard}>
          <span className={styles.successIcon}>✓</span>
          <h2 className={styles.successTitle}>Donasi Berhasil Dibuat!</h2>
          <p className={styles.successDesc}>
            Donasi kamu untuk <strong>{campaign.title}</strong> sebesar{' '}
            <strong>{formatRupiah(parseInt(nominal))}</strong> sudah tercatat.
            Selesaikan pembayaran melalui Midtrans.
          </p>

          {/* Integrasi Midtrans Snap — aktif setelah VITE_MIDTRANS_CLIENT_KEY diisi */}
          <div className={styles.midtransInfo}>
            <p className={styles.midtransLabel}>🔗 Lanjutkan Pembayaran</p>
            {import.meta.env.VITE_MIDTRANS_CLIENT_KEY &&
            import.meta.env.VITE_MIDTRANS_CLIENT_KEY !== 'your_midtrans_client_key_here' ? (
              <p className={styles.midtransHint}>
                Klik tombol di bawah untuk membuka halaman pembayaran Midtrans.
              </p>
            ) : (
              <p className={styles.midtransHint}>
                ⚠️ <em>Midtrans Client Key belum dikonfigurasi.</em> Gunakan tautan redirect di bawah
                untuk menyelesaikan pembayaran di Midtrans Sandbox.
              </p>
            )}

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
              onClick={() => navigate(`/status/${orderId}`)}
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

  // ── Form donasi ────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        {/* Info kampanye */}
        <div className={styles.campaignInfo}>
          <img
            src={campaignImage}
            alt={campaign.title}
            className={styles.campaignImg}
            onError={useCampaignImageFallback}
          />
          <h2 className={styles.campaignTitle}>{campaign.title}</h2>
          <p className={styles.campaignFundraiser}>oleh {campaign.fundraiser_name}</p>
          <div className={styles.campaignProgress}>
            <div
              className={styles.campaignProgressFill}
              style={{
                width: `${Math.min((campaign.collected_amount / campaign.target_amount) * 100, 100)}%`,
              }}
            />
          </div>
          <p className={styles.campaignStats}>
            <strong>{formatRupiah(campaign.collected_amount)}</strong> terkumpul dari{' '}
            {formatRupiah(campaign.target_amount)}
          </p>
        </div>

        {/* Form */}
        <div className={styles.formCard}>
          <h1 className={styles.formTitle}>Isi Nominal Donasi</h1>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {serverError && <div className={styles.alertError}>{serverError}</div>}

            {/* Nominal cepat */}
            <div className={styles.field}>
              <label className={styles.label}>Pilih Nominal</label>
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
              <div className={styles.inputPrefix}>
                <span className={styles.prefix}>Rp</span>
                <input
                  id="nominal"
                  type="text"
                  inputMode="numeric"
                  className={`${styles.input} ${fieldError ? styles.inputError : ''}`}
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

            {/* Pesan */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="pesan">
                Pesan <span className={styles.opsional}>(opsional)</span>
              </label>
              <textarea
                id="pesan"
                className={styles.textarea}
                placeholder="Tulis pesan semangat untuk kampanye ini..."
                value={pesan}
                onChange={(e) => setPesan(e.target.value)}
                rows={3}
                maxLength={300}
              />
              <p className={styles.charCount}>{pesan.length}/300</p>
            </div>

            <button type="submit" className={styles.btnSubmit} disabled={submitting}>
              {submitting ? 'Memproses...' : `Donasi ${nominal && parseInt(nominal) >= 10000 ? formatRupiah(parseInt(nominal)) : ''}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
