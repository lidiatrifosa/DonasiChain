import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.brand}>💚 DonasiChain</span>
        <p className={styles.tagline}>
          Platform penggalangan dana transparan berbasis blockchain Ethereum Sepolia.
        </p>
        <p className={styles.copy}>© 2025 DonasiChain. Dibuat untuk keperluan akademik.</p>
      </div>
    </footer>
  );
}
