import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDonationStatus } from '../api/donation';
import TransactionStatusBadge from '../components/TransactionStatusBadge';
import BlockchainBadge from '../components/BlockchainBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from './TransactionStatus.module.css';

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatWaktu(dateStr) {
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const FINAL_STATUSES = ['success', 'failed', 'expired'];
const POLL_INTERVAL_MS = 5000;
const MAX_POLL = 24; // maks 2 menit polling

export default function TransactionStatus() {
  const { order_id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollCount = useRef(0);
  const timerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await getDonationStatus(order_id);
      const d = res.data.data;
      setData(d);
      setLoading(false);

      // Hentikan polling jika status sudah final
      const isFinal = FINAL_STATUSES.includes(d.payment_status);
      const maxReached = pollCount.current >= MAX_POLL;
      if (isFinal || maxReached) {
        clearInterval(timerRef.current);
      }
      pollCount.current += 1;
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat status transaksi.');
      setLoading(false);
      clearInterval(timerRef.current);
    }
  }, [order_id]);

  useEffect(() => {
    pollCount.current = 0;
    fetchStatus();
    timerRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchStatus]);

  if (loading) return <LoadingSpinner text="Memuat status transaksi..." />;

  if (error) {
    return (
      <div className={styles.errorWrap}>
        <p className={styles.errorMsg}>{error}</p>
        <Link to="/dashboard" className={styles.btnBack}>← Ke Dashboard</Link>
      </div>
    );
  }

  const isPending = data.payment_status === 'pending';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconRow}>
          {data.payment_status === 'success' && <span className={styles.iconSuccess}>✅</span>}
          {data.payment_status === 'pending'  && <span className={styles.iconPending}>⏳</span>}
          {data.payment_status === 'failed'   && <span className={styles.iconFailed}>❌</span>}
          {data.payment_status === 'expired'  && <span className={styles.iconExpired}>⌛</span>}
        </div>

        <h1 className={styles.title}>Status Transaksi</h1>

        <div className={styles.statusRow}>
          <TransactionStatusBadge status={data.payment_status} />
          {isPending && (
            <span className={styles.pollingNote}>Memperbarui otomatis setiap 5 detik...</span>
          )}
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Kampanye</span>
            <Link to={`/kampanye/${data.campaign_id}`} className={styles.infoLink}>
              {data.campaign_title}
            </Link>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Nominal</span>
            <span className={styles.infoValue}>{formatRupiah(data.amount)}</span>
          </div>
          {data.payment_method && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Metode Pembayaran</span>
              <span className={styles.infoValue}>{data.payment_method}</span>
            </div>
          )}
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Referensi Donasi</span>
            <code className={styles.infoCode}>{data.order_id}</code>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Waktu Donasi</span>
            <span className={styles.infoValue}>{formatWaktu(data.created_at)}</span>
          </div>
        </div>

        {/* Blockchain info — hanya tampil jika ada */}
        {data.blockchain_status && (
          <div className={styles.blockchainSection}>
            <div>
              <p className={styles.blockchainTitle}>Bukti di Blockchain</p>
              <p className={styles.blockchainIntro}>
                Blockchain menyimpan bukti pencatatan donasi. Pembayaran tetap dikonfirmasi
                melalui status pembayaran di atas.
              </p>
            </div>
            <BlockchainBadge
              txHash={data.blockchain_tx_hash}
              blockchainStatus={data.blockchain_status}
            />
            {data.blockchain_tx_hash && data.blockchain_status === 'recorded' && (
              <p className={styles.blockchainVerify}>
                Hash adalah ID unik untuk membuka transaksi—tidak perlu dibaca satu per satu.
                Di Etherscan, periksa status <strong>Success</strong> dan bahwa transaksi menuju
                kontrak DonasiChain.
              </p>
            )}
            {data.blockchain_tx_hash && data.blockchain_status === 'recorded' && (
              <a
                className={styles.contractLink}
                href="https://sepolia.etherscan.io/address/0x43817db78BB1Ce89ba25837A4af9279F1B4a4517"
                target="_blank"
                rel="noopener noreferrer"
              >
                Lihat kontrak resmi DonasiChain ↗
              </a>
            )}
            {data.blockchain_status === 'pending' && (
              <p className={styles.blockchainPendingNote}>
                Pencatatan blockchain sedang diproses. Biasanya selesai dalam 1-2 menit setelah pembayaran dikonfirmasi.
              </p>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <Link to="/dashboard" className={styles.btnDashboard}>← Ke Dashboard</Link>
          <Link to="/kampanye" className={styles.btnKampanye}>Lihat Kampanye Lain</Link>
        </div>
      </div>
    </div>
  );
}
