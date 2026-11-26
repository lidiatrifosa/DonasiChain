import styles from './BrandMark.module.css';

export default function BrandMark({ compact = false, inverse = false }) {
  return (
    <span
      className={`${styles.brand} ${compact ? styles.compact : ''} ${inverse ? styles.inverse : ''}`}
      aria-label="DonasiChain"
    >
      <span className={styles.mark} aria-hidden="true">
        <span>D</span>
      </span>
      {!compact && (
        <span className={styles.wordmark}>
          Donasi<span>Chain</span>
        </span>
      )}
    </span>
  );
}
