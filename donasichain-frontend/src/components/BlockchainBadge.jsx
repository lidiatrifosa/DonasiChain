import styles from './BlockchainBadge.module.css';

const BLOCKCHAIN_STATUS = {
  recorded:     { label: '✅ Tercatat di Blockchain', cls: 'recorded'     },
  pending:      { label: '⏳ Menunggu Pencatatan',    cls: 'pending'      },
  failed:       { label: '❌ Gagal Dicatat',          cls: 'failed'       },
  not_recorded: { label: '➖ Belum Dicatat',          cls: 'not_recorded' },
};

export default function BlockchainBadge({ txHash, blockchainStatus }) {
  if (!blockchainStatus) return null;

  const s = BLOCKCHAIN_STATUS[blockchainStatus] || { label: blockchainStatus, cls: 'not_recorded' };

  return (
    <div className={styles.wrap}>
      <span className={`${styles.status} ${styles[s.cls]}`}>{s.label}</span>
      {txHash && blockchainStatus === 'recorded' && (
        <a
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {txHash.slice(0, 12)}...{txHash.slice(-8)} ↗
        </a>
      )}
    </div>
  );
}
