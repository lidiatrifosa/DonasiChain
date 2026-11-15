import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getMyCampaigns } from '../api/campaign';
import { getCampaignById } from '../api/campaign';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from './KelolaKampanye.module.css';

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatTanggal(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

const STATUS_INFO = {
  active:         { label: 'Aktif',           warna: '#16a34a', bg: '#dcfce7' },
  extended:       { label: 'Diperpanjang',     warna: '#d97706', bg: '#fef3c7' },
  target_reached: { label: 'Target Tercapai',  warna: '#2563eb', bg: '#dbeafe' },
  released:       { label: 'Dana Dicairkan',   warna: '#7c3aed', bg: '#ede9fe' },
  ended:          { label: 'Berakhir',         warna: '#6b7280', bg: '#f3f4f6' },
};

// Komponen detail kampanye yang diperluas — mengambil contract_address dari GET /api/campaigns/:id
function KampanyeDetail({ campaignId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCampaignById(campaignId)
      .then((res) => setDetail(res.data.data))
      .catch((err) => {
        if (err.response?.status === 404)
          setError('Detail tidak tersedia (kampanye belum disetujui admin).');
        else
          setError('Gagal memuat detail kampanye.');
      })
      .finally(() => setLoading(false));
  }, [campaignId]);

  return (
    <div className={styles.detailOverlay} onClick={onClose}>
      <div className={styles.detailCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.detailHeader}>
          <h3 className={styles.detailTitle}>Detail Kampanye</h3>
          <button className={styles.detailClose} onClick={onClose}>✕</button>
        </div>

        {loading && <LoadingSpinner text="Memuat detail..." />}
        {error && <p className={styles.detailError}>{error}</p>}

        {detail && (
          <div className={styles.detailBody}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>ID Kampanye</span>
              <span className={styles.detailValue}>#{detail.id}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Judul</span>
              <span className={styles.detailValue}>{detail.title}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Status</span>
              <span
                className={styles.detailBadge}
                style={{
                  color: STATUS_INFO[detail.status]?.warna || '#6b7280',
                  background: STATUS_INFO[detail.status]?.bg || '#f3f4f6',
                }}
              >
                {STATUS_INFO[detail.status]?.label || detail.status}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Target</span>
              <span className={styles.detailValue}>{formatRupiah(detail.target_amount)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Terkumpul</span>
              <span className={styles.detailValue} style={{ color: '#16a34a', fontWeight: 700 }}>
                {formatRupiah(detail.collected_amount)}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Tenggat</span>
              <span className={styles.detailValue}>{formatTanggal(detail.deadline)}</span>
            </div>
            {detail.extended_deadline && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Tenggat Diperpanjang</span>
                <span className={styles.detailValue}>{formatTanggal(detail.extended_deadline)}</span>
              </div>
            )}

            {/* Informasi blockchain */}
            <div className={styles.detailBlockchain}>
              <p className={styles.detailBlockchainTitle}>📦 Informasi Blockchain</p>
              {detail.contract_address ? (
                <>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Contract Address</span>
                    <a
                      href={`https://sepolia.etherscan.io/address/${detail.contract_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.detailLink}
                    >
                      {detail.contract_address.slice(0, 10)}...{detail.contract_address.slice(-8)} ↗
                    </a>
                  </div>
                  <p className={styles.detailBlockchainNote}>
                    ✅ Kampanye ini sudah tercatat di Ethereum Sepolia.
                  </p>
                </>
              ) : (
                <p className={styles.detailBlockchainNote} style={{ color: '#a16207' }}>
                  ⏳ Belum tercatat di blockchain. Pencatatan dilakukan otomatis setelah admin menyetujui kampanye.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KelolaKampanye() {
  const location = useLocation();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(location.state?.successMsg || '');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    getMyCampaigns()
      .then((res) => setCampaigns(res.data.data || []))
      .catch(() => setError('Gagal memuat kampanye.'))
      .finally(() => setLoading(false));
  }, []);

  // Hapus pesan sukses setelah 4 detik
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Kelola Kampanye</h1>
          <p className={styles.subtitle}>Daftar kampanye yang kamu buat</p>
        </div>
        <Link to="/kampanye/buat" className={styles.btnBuat}>+ Buat Kampanye</Link>
      </div>

      {successMsg && (
        <div className={styles.alertSuccess}>✅ {successMsg}</div>
      )}

      {loading && <LoadingSpinner text="Memuat kampanye..." />}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {!loading && !error && campaigns.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🌱</span>
          <p>Belum ada kampanye. Mulai buat kampanye pertamamu!</p>
          <Link to="/kampanye/buat" className={styles.btnBuatEmpty}>Buat Kampanye</Link>
        </div>
      )}

      {!loading && !error && campaigns.length > 0 && (
        <div className={styles.list}>
          {campaigns.map((c) => {
            const progress = Math.min(
              (c.collected_amount / c.target_amount) * 100, 100
            );
            const st = STATUS_INFO[c.status] || { label: c.status, warna: '#6b7280', bg: '#f3f4f6' };
            const deadline = c.extended_deadline || c.deadline;

            return (
              <div key={c.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardLeft}>
                    <h2 className={styles.cardTitle}>{c.title}</h2>
                    <div className={styles.cardMeta}>
                      <span
                        className={styles.statusBadge}
                        style={{ color: st.warna, background: st.bg }}
                      >
                        {st.label}
                      </span>
                      {!c.is_approved ? (
                        <span className={styles.pendingBadge}>⏳ Menunggu persetujuan admin</span>
                      ) : (
                        <span className={styles.approvedBadge}>✅ Disetujui</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.cardAmounts}>
                    <span className={styles.collected}>{formatRupiah(c.collected_amount)}</span>
                    <span className={styles.target}>dari {formatRupiah(c.target_amount)}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.deadline}>
                    ⏰ Tenggat: {formatTanggal(deadline)}
                    {c.extended_deadline && ' (diperpanjang)'}
                  </span>
                  <span className={styles.pct}>{Math.round(progress)}%</span>
                </div>

                {/* Aksi */}
                <div className={styles.cardActions}>
                  <button
                    className={styles.btnDetail}
                    onClick={() => setSelectedId(c.id)}
                    disabled={!c.is_approved}
                    title={!c.is_approved ? 'Detail tersedia setelah disetujui admin' : ''}
                  >
                    Lihat Detail
                  </button>
                  <Link
                    to={`/kampanye/${c.id}`}
                    className={styles.btnPublik}
                    style={{ pointerEvents: c.is_approved ? 'auto' : 'none', opacity: c.is_approved ? 1 : 0.4 }}
                  >
                    Halaman Publik
                  </Link>
                  {!c.is_approved && (
                    <Link to={`/kampanye/edit/${c.id}`} className={styles.btnEdit}>
                      Edit
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal detail kampanye */}
      {selectedId && (
        <KampanyeDetail
          campaignId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
