import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCampaignById } from '../api/campaign';
import { getCampaignTransactions } from '../api/transaction';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from './CampaignDetail.module.css';

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

  return (
    <div className={styles.page}>
      {/* Gambar header */}
      <div className={styles.imageWrap}>
        {campaign.image_url ? (
          <img src={campaign.image_url} alt={campaign.title} className={styles.image} />
        ) : (
          <div className={styles.imagePlaceholder}>📷</div>
        )}
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
                    <div>
                      <p className={styles.donaturNama}>{d.donor_name}</p>
                      {d.message && <p className={styles.donaturPesan}>"{d.message}"</p>}
                    </div>
                    <span className={styles.donaturNominal}>{formatRupiah(d.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            {/* Progress */}
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

            {/* Tombol donasi */}
            {bisaDonasi ? (
              user ? (
                <Link to={`/donasi/${campaign.id}`} className={styles.btnDonasi}>
                  💚 Donasi Sekarang
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

            {/* Info blockchain */}
            {campaign.contract_address && (
              <div className={styles.blockchainInfo}>
                <p className={styles.blockchainLabel}>📦 Smart Contract</p>
                <a
                  href={`https://sepolia.etherscan.io/address/${campaign.contract_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.blockchainLink}
                >
                  {campaign.contract_address.slice(0, 10)}...
                  {campaign.contract_address.slice(-8)}
                </a>
              </div>
            )}
          </div>

          <Link to="/kampanye" className={styles.linkKembali}>← Kembali ke Daftar</Link>
        </aside>
      </div>
    </div>
  );
}
