import styles from './Footer.module.css';
import BrandMark from './BrandMark';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.brand}>
          <BrandMark inverse />
        </span>
        <p className={styles.tagline}>
          Platform penggalangan dana transparan berbasis blockchain Ethereum Sepolia.
        </p>
      </div>
    </footer>
  );
}
