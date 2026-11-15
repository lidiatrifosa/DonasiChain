import { useState, useEffect, useCallback } from 'react';
import { getCampaigns } from '../api/campaign';
import CampaignCard from '../components/CampaignCard';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from './CampaignList.module.css';

const STATUS_OPTIONS = [
  { value: '', label: 'Semua Status' },
  { value: 'active', label: 'Aktif' },
  { value: 'extended', label: 'Diperpanjang' },
  { value: 'target_reached', label: 'Target Tercapai' },
  { value: 'released', label: 'Dana Dicairkan' },
  { value: 'ended', label: 'Berakhir' },
];

const LIMIT = 9;

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0 });

  const fetchCampaigns = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, limit: LIMIT };
    if (filterStatus) params.status = filterStatus;

    getCampaigns(params)
      .then((res) => {
        setCampaigns(res.data.data || []);
        setPagination(res.data.pagination || { total: 0 });
      })
      .catch(() => setError('Gagal memuat kampanye. Pastikan backend berjalan.'))
      .finally(() => setLoading(false));
  }, [page, filterStatus]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleFilterChange = (status) => {
    setFilterStatus(status);
    setPage(1);
  };

  const totalPages = Math.ceil((pagination.total || 0) / LIMIT);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Daftar Kampanye</h1>
        <p className={styles.subtitle}>Temukan kampanye yang ingin kamu dukung</p>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`${styles.filterBtn} ${filterStatus === opt.value ? styles.filterActive : ''}`}
            onClick={() => handleFilterChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Konten */}
      {loading && <LoadingSpinner text="Memuat kampanye..." />}

      {error && (
        <div className={styles.errorBox}>
          <p>{error}</p>
          <button onClick={fetchCampaigns} className={styles.retryBtn}>Coba Lagi</button>
        </div>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🔍</span>
          <p>Tidak ada kampanye ditemukan.</p>
        </div>
      )}

      {!loading && !error && campaigns.length > 0 && (
        <>
          <p className={styles.totalInfo}>Menampilkan {campaigns.length} dari {pagination.total} kampanye</p>
          <div className={styles.grid}>
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >
                ← Sebelumnya
              </button>
              <span className={styles.pageInfo}>Halaman {page} dari {totalPages}</span>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
              >
                Berikutnya →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
