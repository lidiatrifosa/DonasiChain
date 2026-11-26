import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCampaignById } from '../api/campaign';
import { getCampaignTransactions } from '../api/transaction';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from './CampaignDetail.module.css';
import { getCampaignImage, useCampaignImageFallback } from '../utils/campaignImage';

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTanggal(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function hitungSisaHari(dateStr) {
  const selisih = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(selisih / (1000 * 60 * 60 * 24)));
}

const STATUS_INFO = {
  active:         { label: 'Aktif',            warna: '#16a34a', bg: '#dcfce7' },
  extended:       { label: 'Diperpanjang',      warna: '#d97706', bg: '#fef3c7' },
  target_reached: { label: 'Target Tercapai',   warna: '#2563eb', bg: '#dbeafe' },
  released:       { label: 'Dana Dicairkan',    warna: '#7c3aed', bg: '#ede9fe' },
  ended:          { label: 'Berakhir',          warna: '#6b7280', bg: '#f3f4f6' },
};

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState(null);
  const [donatur, setDonatur] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      getCampaignById(id),
      getCampaignTransactions(id, { limit: 5 }),
    ])
      .then(([resCampaign, resTx]) => {
        setCampaign(resCampaign.data.data);
        setDonatur(resTx.data.data || []);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Kampanye tidak ditemukan.');
        } else {
          setError('Gagal memuat data kampanye. Pastikan backend berjalan.');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner text="Memuat kampanye..." />;

  if (error) {
    return (
      <div className={styles.errorWrap}>
        <p className={styles.errorMsg}>{error}</p>
        <button onClick={() => navigate('/kampanye')} className={styles.btnKembali}>
          ← Kembali ke Daftar Kampanye
        </button>
      </div>
    );
  }

  const progress = Math.min((campaign.collected_amount / campaign.target_amount) * 100, 100);
  const deadline = campaign.extended_deadline || campaign.deadline;
  const sisaHari = hitungSisaHari(deadline);
  const status = STATUS_INFO[campaign.status] || { label: campaign.status, warna: '#6b7280', bg: '#f3f4f6' };
  const bisaDonasi = ['active', 'extended'].includes(campaign.status);
  const campaignImage = getCampaignImage(campaign);
  const donaturTercatat = donatur.filter((d) => d.blockchain_tx_hash);

  return (
    <div className={styles.page}>
      {/* Gambar header */}
      <div className={styles.imageWrap}>
        <img
          src={campaignImage}
          alt={campaign.title}
          className={styles.image}
          onError={useCampaignImageFallback}
        />
      </div>

      <div className={styles.layout}>
        {/* Konten utama */}
        <div className={styles.main}>
          <div className={styles.badgeRow}>
            <span
              className={styles.statusBadge}
              style={{ color: status.warna, background: status.bg }}
            >
              {status.label}
            </span>
            {campaign.extended_deadline && (
              <span className={styles.extendedNote}>⏳ Tenggat diperpanjang</span>
            )}
          </div>

          <h1 className={styles.title}>{campaign.title}</h1>

          <p className={styles.fundraiserInfo}>
            Oleh <strong>{campaign.fundraiser_name}</strong>
          </p>

          <p className={styles.description}>{campaign.description}</p>

          {/* Donatur terbaru */}
          {donatur.length > 0 && (
            <div className={styles.donaturSection}>
              <h3 className={styles.donaturTitle}>Donatur Terbaru</h3>
              <ul className={styles.donaturList}>
                {donatur.map((d) => (
                  <li key={d.id} className={styles.donaturItem}>
                    <span className={styles.donaturAvatar}>👤</span>
                    <div className={styles.donaturInfo}>
                      <p className={styles.donaturNama}>{d.donor_name}</p>
                      {d.message && <p className={styles.donaturPesan}>"{d.message}"</p>}
                      {d.created_at && (
                        <p className={styles.donaturTanggal}>
                          Donasi {formatTanggal(d.created_at)}
                        </p>
                      )}
                      {d.blockchain_tx_hash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${d.blockchain_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.donaturTxLink}
                        >
                          Lihat bukti transaksi ↗
                        </a>
                      )}
                    </div>
                    <span className={styles.donaturNominal}>{formatRupiah(d.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Section Verifikasi Blockchain */}
          <div className={styles.blockchainVerifySection}>
            <div className={styles.blockchainVerifyHeader}>
              <span className={styles.blockchainVerifyIcon}>⛓️</span>
              <div>
                <h3 className={styles.blockchainVerifyTitle}>Transparansi Blockchain</h3>
                <p className={styles.blockchainVerifySubtitle}>
                  Donasi yang sudah dikonfirmasi dicatat sebagai bukti permanen di Ethereum Sepolia.
                  Blockchain menyimpan catatan transaksi, sedangkan pembayaran diproses oleh Midtrans.
                </p>
              </div>
            </div>

            <div className={styles.blockchainVerifySteps}>
              <div className={styles.verifyStep}>
                <span className={styles.verifyStepNum}>1</span>
                <div>
                  <p className={styles.verifyStepTitle}>Catatan DonasiChain</p>
                  <p className={styles.verifyStepDesc}>Alamat kontrak tempat catatan kampanye dan donasi disimpan</p>
                  <a
                    href="https://sepolia.etherscan.io/address/0x43817db78BB1Ce89ba25837A4af9279F1B4a4517"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.verifyLink}
                  >
                    0x43817...4517 ↗
                  </a>
                </div>
              </div>

              <div className={styles.verifyStep}>
                <span className={styles.verifyStepNum}>2</span>
                <div>
                  <p className={styles.verifyStepTitle}>Bukti yang dapat diperiksa</p>
                  <p className={styles.verifyStepDesc}>
                    {donaturTercatat.length > 0
                      ? `${donaturTercatat.length} dari ${donatur.length} donasi terbaru memiliki bukti transaksi di blockchain`
                      : 'Bukti transaksi akan muncul di daftar donatur setelah pencatatan dikonfirmasi'}
                  </p>
                </div>
              </div>

              <div className={styles.verifyStep}>
                <span className={styles.verifyStepNum}>3</span>
                <div>
                  <p className={styles.verifyStepTitle}>Cara membaca bukti</p>
                  <p className={styles.verifyStepDesc}>Cukup cocokkan status Success dan alamat kontrak DonasiChain di Etherscan. Hash hanya ID unik untuk membuka transaksi.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <p className={styles.terkumpul}>{formatRupiah(campaign.collected_amount)}</p>
            <p className={styles.dariTarget}>
              terkumpul dari target <strong>{formatRupiah(campaign.target_amount)}</strong>
            </p>

            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <p className={styles.progressPct}>{Math.round(progress)}% tercapai</p>

            <div className={styles.statsRow}>
              <div className={styles.statBox}>
                <span className={styles.statVal}>{sisaHari}</span>
                <span className={styles.statLbl}>hari lagi</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statVal}>{formatTanggal(deadline)}</span>
                <span className={styles.statLbl}>tenggat</span>
              </div>
            </div>

            {bisaDonasi ? (
              user ? (
                <Link to={`/donasi/${campaign.id}`} className={styles.btnDonasi}>
                  Donasi Sekarang
                </Link>
              ) : (
                <Link to="/masuk" className={styles.btnDonasi}>
                  Masuk untuk Donasi
                </Link>
              )
            ) : (
              <button className={styles.btnDonasiDisabled} disabled>
                Kampanye Tidak Aktif
              </button>
            )}

            <div className={styles.blockchainInfo}>
              <p className={styles.blockchainLabel}>⛓️ Dicatat di Blockchain</p>
              <a
                href="https://sepolia.etherscan.io/address/0x43817db78BB1Ce89ba25837A4af9279F1B4a4517"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.blockchainLink}
              >
                Lihat di Sepolia Etherscan ↗
              </a>
            </div>
          </div>

          <Link to="/kampanye" className={styles.linkKembali}>← Kembali ke Daftar</Link>
        </aside>
      </div>
    </div>
  );
}
