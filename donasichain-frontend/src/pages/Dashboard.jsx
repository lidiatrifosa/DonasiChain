import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProfile } from '../api/auth';
import { getMyTransactions } from '../api/transaction';
import { getMyCampaigns } from '../api/campaign';
import TransactionStatusBadge from '../components/TransactionStatusBadge';
import BlockchainBadge from '../components/BlockchainBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from './Dashboard.module.css';

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatTanggal(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const CAMPAIGN_STATUS_LABEL = {
  active:         { label: 'Aktif',           warna: '#16a34a', bg: '#dcfce7' },
  extended:       { label: 'Diperpanjang',     warna: '#d97706', bg: '#fef3c7' },
  target_reached: { label: 'Target Tercapai',  warna: '#2563eb', bg: '#dbeafe' },
  released:       { label: 'Dana Dicairkan',   warna: '#7c3aed', bg: '#ede9fe' },
  ended:          { label: 'Berakhir',         warna: '#6b7280', bg: '#f3f4f6' },
};

const TABS_DONOR      = ['Riwayat Donasi'];
const TABS_FUNDRAISER = ['Riwayat Donasi', 'Kampanye Saya'];

export default function Dashboard() {
  const { user: authUser } = useAuth();

  // Profil dari GET /api/auth/profile — selalu fresh dari backend
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    getProfile()
      .then((res) => setProfile(res.data.data))
      .catch(() => setProfile(authUser)) // fallback ke data AuthContext jika gagal
      .finally(() => setProfileLoading(false));
  }, []);

  const user = profile || authUser;
  const isFundraiser = user?.role === 'fundraiser';
  const TABS = isFundraiser ? TABS_FUNDRAISER : TABS_DONOR;

  const [activeTab, setActiveTab] = useState(TABS[0]);

  // Riwayat donasi
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState(null);
  const [txPage, setTxPage] = useState(1);
  const [txPagination, setTxPagination] = useState({ total: 0 });

  // Kampanye milik fundraiser
  const [campaigns, setCampaigns] = useState([]);
  const [campLoading, setCampLoading] = useState(false);
  const [campError, setCampError] = useState(null);
  const [campFetched, setCampFetched] = useState(false);

  // Fetch riwayat donasi
  useEffect(() => {
    setTxLoading(true);
    getMyTransactions({ page: txPage, limit: 10 })
      .then((res) => {
        setTransactions(res.data.data || []);
        setTxPagination(res.data.pagination || { total: 0 });
      })
      .catch(() => setTxError('Gagal memuat riwayat donasi.'))
      .finally(() => setTxLoading(false));
  }, [txPage]);

  // Fetch kampanye fundraiser — hanya saat tab aktif dan belum pernah di-fetch
  useEffect(() => {
    if (activeTab === 'Kampanye Saya' && isFundraiser && !campFetched) {
      setCampLoading(true);
      getMyCampaigns()
        .then((res) => {
          setCampaigns(res.data.data || []);
          setCampFetched(true);
        })
        .catch(() => setCampError('Gagal memuat kampanye.'))
        .finally(() => setCampLoading(false));
    }
  }, [activeTab, isFundraiser, campFetched]);

  const txTotalPages = Math.ceil((txPagination.total || 0) / 10);

  if (profileLoading) return <LoadingSpinner text="Memuat profil..." />;

  return (
    <div className={styles.page}>
      {/* Header profil */}
      <div className={styles.profileHeader}>
        <div className={styles.avatar}>
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div className={styles.profileInfo}>
          <h1 className={styles.profileName}>{user?.name}</h1>
          <p className={styles.profileEmail}>{user?.email}</p>
          <span className={styles.roleBadge}>
            {user?.role === 'donor' ? '💚 Donatur' : user?.role === 'fundraiser' ? '🌱 Penggalang Dana' : '🔧 Admin'}
          </span>
        </div>
        {isFundraiser && (
          <Link to="/kampanye/kelola" className={styles.btnBuatKampanye}>
            Kelola Kampanye
          </Link>
        )}
      </div>

      {/* Ringkasan statistik */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{txPagination.total ?? '—'}</span>
          <span className={styles.statLbl}>Total Donasi</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>
            {transactions.filter((t) => t.payment_status === 'success').length > 0
              ? formatRupiah(
                  transactions
                    .filter((t) => t.payment_status === 'success')
                    .reduce((sum, t) => sum + t.amount, 0)
                )
              : 'Rp 0'}
          </span>
          <span className={styles.statLbl}>Total Berhasil (halaman ini)</span>
        </div>
        {isFundraiser && (
          <div className={styles.statCard}>
            <span className={styles.statNum}>{campFetched ? campaigns.length : '—'}</span>
            <span className={styles.statLbl}>Kampanye Dibuat</span>
          </div>
        )}
      </div>

      {/* Tab navigasi */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab: Riwayat Donasi ── */}
      {activeTab === 'Riwayat Donasi' && (
        <div className={styles.tabContent}>
          {txLoading && <LoadingSpinner text="Memuat riwayat donasi..." />}
          {txError && <p className={styles.errorMsg}>{txError}</p>}
          {!txLoading && !txError && transactions.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>💸</span>
              <p>Belum ada riwayat donasi.</p>
              <Link to="/kampanye" className={styles.btnExplore}>Jelajahi Kampanye</Link>
            </div>
          )}
          {!txLoading && !txError && transactions.length > 0 && (
            <>
              <div className={styles.txList}>
                {transactions.map((tx) => (
                  <div key={tx.id} className={styles.txCard}>
                    <div className={styles.txTop}>
                      <div className={styles.txLeft}>
                        <Link
                          to={`/kampanye/${tx.campaign_id}`}
                          className={styles.txCampaign}
                        >
                          {tx.campaign_title}
                        </Link>
                        <span className={styles.txDate}>{formatTanggal(tx.created_at)}</span>
                        {tx.message && (
                          <p className={styles.txPesan}>"{tx.message}"</p>
                        )}
                      </div>
                      <div className={styles.txRight}>
                        <span className={styles.txAmount}>{formatRupiah(tx.amount)}</span>
                        <TransactionStatusBadge status={tx.payment_status} />
                      </div>
                    </div>

                    {/* Blockchain info */}
                    {tx.blockchain_status && (
                      <div className={styles.txBlockchain}>
                        <BlockchainBadge
                          txHash={tx.blockchain_tx_hash}
                          blockchainStatus={tx.blockchain_status}
                        />
                      </div>
                    )}

                    <div className={styles.txFooter}>
                      <Link
                        to={`/status/${tx.order_id}`}
                        className={styles.txDetailLink}
                      >
                        Lihat Detail →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {txTotalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setTxPage((p) => p - 1)}
                    disabled={txPage === 1}
                  >
                    ← Sebelumnya
                  </button>
                  <span className={styles.pageInfo}>
                    {txPage} / {txTotalPages}
                  </span>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setTxPage((p) => p + 1)}
                    disabled={txPage === txTotalPages}
                  >
                    Berikutnya →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Kampanye Saya (fundraiser) ── */}
      {activeTab === 'Kampanye Saya' && isFundraiser && (
        <div className={styles.tabContent}>
          {campLoading && <LoadingSpinner text="Memuat kampanye..." />}
          {campError && <p className={styles.errorMsg}>{campError}</p>}
          {!campLoading && !campError && campaigns.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🌱</span>
              <p>Belum ada kampanye yang dibuat.</p>
              <Link to="/kampanye/buat" className={styles.btnExplore}>
                Buat Kampanye Pertama
              </Link>
            </div>
          )}
          {!campLoading && !campError && campaigns.length > 0 && (
            <div className={styles.campList}>
              {campaigns.map((c) => {
                const progress = Math.min(
                  (c.collected_amount / c.target_amount) * 100, 100
                );
                const st = CAMPAIGN_STATUS_LABEL[c.status] || {
                  label: c.status, warna: '#6b7280', bg: '#f3f4f6',
                };
                const deadline = c.extended_deadline || c.deadline;
                return (
                  <div key={c.id} className={styles.campCard}>
                    <div className={styles.campTop}>
                      <div>
                        <Link
                          to={`/kampanye/${c.id}`}
                          className={styles.campTitle}
                        >
                          {c.title}
                        </Link>
                        <div className={styles.campMeta}>
                          <span
                            className={styles.campStatus}
                            style={{ color: st.warna, background: st.bg }}
                          >
                            {st.label}
                          </span>
                          {!c.is_approved && (
                            <span className={styles.campPending}>
                              ⏳ Menunggu persetujuan admin
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.campAmounts}>
                        <span className={styles.campCollected}>
                          {formatRupiah(c.collected_amount)}
                        </span>
                        <span className={styles.campTarget}>
                          dari {formatRupiah(c.target_amount)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.campProgressBar}>
                      <div
                        className={styles.campProgressFill}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className={styles.campFooter}>
                      <span className={styles.campDeadline}>
                        ⏰ Tenggat: {formatTanggal(deadline)}
                      </span>
                      <span className={styles.campPct}>{Math.round(progress)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
