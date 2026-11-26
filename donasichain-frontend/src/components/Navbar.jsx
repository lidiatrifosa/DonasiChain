import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Navbar.module.css';
import BrandMark from './BrandMark';

export default function Navbar() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutUser();
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.brand} onClick={() => setMenuOpen(false)}>
        <BrandMark />
      </Link>

      {/* Hamburger button — mobile only */}
      <button
        className={styles.hamburger}
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        <span className={`${styles.bar} ${menuOpen ? styles.barOpen1 : ''}`} />
        <span className={`${styles.bar} ${menuOpen ? styles.barOpen2 : ''}`} />
        <span className={`${styles.bar} ${menuOpen ? styles.barOpen3 : ''}`} />
      </button>

      <div className={`${styles.links} ${menuOpen ? styles.linksOpen : ''}`}>
        <Link to="/kampanye" onClick={() => setMenuOpen(false)}>Kampanye</Link>
        {user ? (
          <>
            <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
            <button onClick={handleLogout} className={styles.btnLogout}>
              Keluar
            </button>
          </>
        ) : (
          <>
            <Link to="/masuk" className={styles.btnMasuk} onClick={() => setMenuOpen(false)}>Masuk</Link>
            <Link to="/daftar" className={styles.btnDaftar} onClick={() => setMenuOpen(false)}>Daftar</Link>
          </>
        )}
      </div>
    </nav>
  );
}
