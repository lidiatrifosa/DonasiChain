import { useState } from 'react';
import styles from './BlockchainBadge.module.css';

const BLOCKCHAIN_STATUS = {
  recorded:     { label: 'Bukti donasi tercatat',          cls: 'recorded'     },
  pending:      { label: 'Menunggu konfirmasi blockchain', cls: 'pending'      },
  failed:       { label: 'Pencatatan blockchain gagal',    cls: 'failed'       },
  not_recorded: { label: 'Belum dicatat di blockchain',   cls: 'not_recorded' },
};

export default function BlockchainBadge({ txHash, blockchainStatus }) {
  const [copyState, setCopyState] = useState('idle');

  if (!blockchainStatus) return null;

  const s = BLOCKCHAIN_STATUS[blockchainStatus] || { label: blockchainStatus, cls: 'not_recorded' };

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(txHash);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <div className={styles.wrap}>
      <span className={`${styles.status} ${styles[s.cls]}`}>{s.label}</span>
      {txHash && blockchainStatus === 'recorded' && (
        <div className={styles.proof}>
          <span className={styles.network}>Ethereum Sepolia</span>
          <code className={styles.hash}>{txHash.slice(0, 12)}…{txHash.slice(-8)}</code>
          <div className={styles.actions}>
            <button type="button" className={styles.copyButton} onClick={copyHash}>
              {copyState === 'copied' ? 'Tersalin' : copyState === 'failed' ? 'Gagal menyalin' : 'Salin hash'}
            </button>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              Verifikasi di Etherscan ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
