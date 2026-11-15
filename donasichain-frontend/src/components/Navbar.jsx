import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    navigate('/');
  };

  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.brand}>
        <span className={styles.brandIcon}>💚</span>
        DonasiChain
      </Link>
      <div className={styles.links}>
        <Link to="/kampanye">Kampanye</Link>
        {user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <button onClick={handleLogout} className={styles.btnLogout}>
              Keluar
            </button>
          </>
        ) : (
          <>
            <Link to="/masuk" className={styles.btnMasuk}>Masuk</Link>
            <Link to="/daftar" className={styles.btnDaftar}>Daftar</Link>
          </>
        )}
      </div>
    </nav>
  );
}
