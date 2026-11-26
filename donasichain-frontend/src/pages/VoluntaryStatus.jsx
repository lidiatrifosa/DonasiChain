import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getVoluntaryStatus } from '../api/donation';
import TransactionStatusBadge from '../components/TransactionStatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
// Gunakan CSS yang sama dengan TransactionStatus agar konsisten
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
const MAX_POLL = 24;

export default function VoluntaryStatus() {
  const { order_id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollCount = useRef(0);
  const timerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await getVoluntaryStatus(order_id);
      const d = res.data.data;
      setData(d);
      setLoading(false);

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

        <h1 className={styles.title}>Status Donasi Sukarela</h1>

        <div className={styles.statusRow}>
          <TransactionStatusBadge status={data.payment_status} />
          {isPending && (
            <span className={styles.pollingNote}>Memperbarui otomatis setiap 5 detik...</span>
          )}
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Jenis Donasi</span>
            <span className={styles.infoValue}>💚 Donasi Sukarela Platform</span>
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
            <span className={styles.infoLabel}>Referensi Order</span>
            <code className={styles.infoCode}>{data.order_id}</code>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Waktu Transaksi</span>
            <span className={styles.infoValue}>{formatWaktu(data.created_at)}</span>
          </div>
          {data.message && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Pesan</span>
              <span className={styles.infoValue}>"{data.message}"</span>
            </div>
          )}
        </div>

        {/* Notifikasi status */}
        {data.payment_status === 'success' && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
          }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#15803d', fontWeight: 600 }}>
              🎉 Terima kasih atas dukunganmu untuk DonasiChain!
            </p>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#4b5563' }}>
              Donasi sukarela kamu telah berhasil diterima dan akan digunakan untuk pengembangan platform.
            </p>
          </div>
        )}

        {data.payment_status === 'pending' && isPending && data.snap_token && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e', fontWeight: 600 }}>
              ⏳ Pembayaran masih pending
            </p>
            <p style={{ margin: '0.4rem 0 0.75rem', fontSize: '0.85rem', color: '#4b5563' }}>
              Belum menyelesaikan pembayaran? Hubungi kembali halaman Midtrans.
            </p>
          </div>
        )}

        {(data.payment_status === 'failed' || data.payment_status === 'expired') && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#dc2626', fontWeight: 600 }}>
              {data.payment_status === 'expired' ? '⌛ Transaksi kedaluwarsa' : '❌ Pembayaran gagal'}
            </p>
            <p style={{ margin: '0.4rem 0 0.75rem', fontSize: '0.85rem', color: '#4b5563' }}>
              Kamu bisa mencoba donasi sukarela kembali kapan saja.
            </p>
            <Link
              to="/donasi-sukarela"
              style={{
                display: 'inline-block',
                background: '#16a34a',
                color: '#fff',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Coba Lagi
            </Link>
          </div>
        )}

        <div className={styles.actions}>
          <Link to="/dashboard" className={styles.btnDashboard}>← Ke Dashboard</Link>
          <Link to="/kampanye" className={styles.btnKampanye}>Lihat Kampanye</Link>
        </div>
      </div>
    </div>
  );
}
