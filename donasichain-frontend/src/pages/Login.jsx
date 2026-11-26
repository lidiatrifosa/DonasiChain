import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import styles from './AuthForm.module.css';
import BrandMark from '../components/BrandMark';

export default function Login() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(form);
      const { token, user } = res.data.data;
      loginUser(token, user);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.logo}><BrandMark /></span>
          <h1 className={styles.title}>Masuk ke DonasiChain</h1>
          <p className={styles.subtitle}>Selamat datang kembali</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {error && <div className={styles.alertError}>{error}</div>}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              className={styles.input}
              placeholder="contoh@email.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className={styles.input}
              placeholder="Masukkan password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className={styles.btnSubmit} disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className={styles.switchLink}>
          Belum punya akun?{' '}
          <Link to="/daftar">Daftar sekarang</Link>
        </p>
      </div>
    </div>
  );
}
