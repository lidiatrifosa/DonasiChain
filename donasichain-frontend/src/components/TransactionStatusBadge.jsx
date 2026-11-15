import styles from './TransactionStatusBadge.module.css';

const STATUS = {
  success:  { label: 'Berhasil',  cls: 'success' },
  pending:  { label: 'Menunggu',  cls: 'pending' },
  failed:   { label: 'Gagal',     cls: 'failed'  },
  expired:  { label: 'Kedaluwarsa', cls: 'expired' },
};

export default function TransactionStatusBadge({ status }) {
  const s = STATUS[status] || { label: status, cls: 'pending' };
  return (
    <span className={`${styles.badge} ${styles[s.cls]}`}>{s.label}</span>
  );
}
