import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getCampaigns } from '../api/campaign';
import CampaignCard from '../components/CampaignCard';
import styles from './LandingPage.module.css';

const FITUR = [
  { nomor: '01', judul: 'Transparan & Aman', deskripsi: 'Setiap donasi dicatat di blockchain Ethereum Sepolia sehingga dapat ditelusuri siapa saja.' },
  { nomor: '02', judul: 'Pembayaran Mudah', deskripsi: 'Didukung Midtrans Sandbox dengan berbagai metode pembayaran yang familiar.' },
  { nomor: '03', judul: 'Progres Real-time', deskripsi: 'Pantau perkembangan kampanye secara langsung dengan data yang selalu diperbarui.' },
];

export default function LandingPage() {
  const [kampanyeFeatured, setKampanyeFeatured] = useState([]);
  const [loadingKampanye, setLoadingKampanye] = useState(true);
  const [errorKampanye, setErrorKampanye] = useState(null);

  useEffect(() => {
    getCampaigns({ status: 'active', limit: 3 })
      .then((res) => setKampanyeFeatured(res.data.data || []))
      .catch(() => setErrorKampanye('Gagal memuat kampanye.'))
      .finally(() => setLoadingKampanye(false));
  }, []);

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroBadge}>Berbasis Blockchain Ethereum</span>
          <h1 className={styles.heroTitle}>
            Donasi Lebih Transparan,<br />Dampak Lebih Nyata
          </h1>
          <p className={styles.heroSubtitle}>
            DonasiChain adalah platform penggalangan dana yang mencatat setiap transaksi
            di blockchain Ethereum Sepolia untuk memastikan transparansi dan kepercayaan.
          </p>
          <div className={styles.heroCta}>
            <Link to="/kampanye" className={styles.btnPrimary}>Lihat Kampanye</Link>
            <Link to="/daftar" className={styles.btnSecondary}>Mulai Galang Dana</Link>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroCard}>
            <div className={styles.heroCardPhoto} />
            <div className={styles.heroCardCopy}>
              <p className={styles.heroCardText}>Setiap donasi tercatat permanen di blockchain</p>
              <code className={styles.heroCardHash}>0x43817...4517</code>
            </div>
          </div>
        </div>
      </section>

      {/* Statistik */}
      <section className={styles.statsSection}>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>100%</span>
            <span className={styles.statDesc}>Transparan di Blockchain</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>Sepolia</span>
            <span className={styles.statDesc}>Ethereum Testnet</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>Sandbox</span>
            <span className={styles.statDesc}>Midtrans Payment</span>
          </div>
        </div>
      </section>

      {/* Kampanye Aktif */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Kampanye Aktif</h2>
          <Link to="/kampanye" className={styles.linkLihatSemua}>Lihat semua →</Link>
        </div>
        {loadingKampanye && (
          <p className={styles.infoText}>Memuat kampanye...</p>
        )}
        {errorKampanye && (
          <div className={styles.errorBox}>
            <p>{errorKampanye}</p>
            <p className={styles.errorHint}>Pastikan backend berjalan di <code>http://localhost:3000</code></p>
          </div>
        )}
        {!loadingKampanye && !errorKampanye && kampanyeFeatured.length === 0 && (
          <p className={styles.infoText}>Belum ada kampanye aktif saat ini.</p>
        )}
        <div className={styles.campaignGrid}>
          {kampanyeFeatured.map((k) => (
            <CampaignCard key={k.id} campaign={k} />
          ))}
        </div>
      </section>

      {/* Fitur */}
      <section className={styles.fiturSection}>
        <h2 className={styles.sectionTitle}>Mengapa DonasiChain?</h2>
        <div className={styles.fiturGrid}>
          {FITUR.map((f) => (
            <div key={f.judul} className={styles.fiturCard}>
              <span className={styles.fiturIcon}>{f.nomor}</span>
              <h3 className={styles.fiturJudul}>{f.judul}</h3>
              <p className={styles.fiturDeskripsi}>{f.deskripsi}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Siap Membuat Perbedaan?</h2>
        <p className={styles.ctaSubtitle}>Bergabunglah dan mulai donasi atau galang dana sekarang.</p>
        <div className={styles.heroCta}>
          <Link to="/daftar" className={styles.btnPrimary}>Daftar Sekarang</Link>
          <Link to="/kampanye" className={styles.btnSecondary}>Jelajahi Kampanye</Link>
        </div>
      </section>

      {/* Donasi Sukarela */}
      <section className={styles.fiturSection} style={{ background: '#f0fdf4' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <span style={{
            display: 'inline-block', background: '#dcfce7', color: '#15803d',
            fontSize: '0.8rem', fontWeight: 700, padding: '0.3rem 0.8rem',
            borderRadius: '99px', border: '1px solid #bbf7d0', marginBottom: '1rem',
          }}>
            💚 Sukarela
          </span>
          <h2 className={styles.sectionTitle}>Dukung Pengembangan DonasiChain</h2>
          <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.65, margin: '0 0 1.5rem' }}>
            Selain donasi untuk kampanye, kamu juga bisa mendukung keberlangsungan platform ini
            secara langsung. Dana sukarela digunakan untuk operasional server, pengembangan fitur,
            dan pemeliharaan sistem blockchain.
          </p>
          <Link to="/donasi-sukarela" className={styles.btnPrimary}>
            Donasi Sukarela Sekarang →
          </Link>
        </div>
      </section>
    </div>
  );
}
