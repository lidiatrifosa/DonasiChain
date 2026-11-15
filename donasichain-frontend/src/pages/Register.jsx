import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/auth';
import styles from './AuthForm.module.css';

const ROLE_OPTIONS = [
  { value: 'donor', label: 'Donatur — saya ingin berdonasi' },
  { value: 'fundraiser', label: 'Penggalang Dana — saya ingin membuat kampanye' },
];

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'donor' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [sukses, setSukses] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    setServerError('');
  };

  // Validasi sisi klien sesuai aturan backend
  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Nama wajib diisi.';
    if (!form.email) {
      errors.email = 'Email wajib diisi.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Format email tidak valid.';
    }
    if (!form.password) {
      errors.password = 'Password wajib diisi.';
    } else if (form.password.length < 8) {
      errors.password = 'Password minimal 8 karakter.';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await register(form);
      setSukses(true);
      setTimeout(() => navigate('/masuk'), 2000);
    } catch (err) {
      // Tangani error validasi dari backend (HTTP 422)
      if (err.response?.data?.errors) {
        const mapped = {};
        err.response.data.errors.forEach(({ field, message }) => {
          mapped[field] = message;
        });
        setFieldErrors(mapped);
      } else {
        setServerError(err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.logo}>💚</span>
          <h1 className={styles.title}>Daftar ke DonasiChain</h1>
          <p className={styles.subtitle}>Bergabung dan mulai berdonasi</p>
        </div>

        {sukses ? (
          <div className={styles.alertSuccess}>
            ✅ Registrasi berhasil! Mengarahkan ke halaman masuk...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {serverError && <div className={styles.alertError}>{serverError}</div>}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="name">Nama Lengkap</label>
              <input
                id="name"
                name="name"
                type="text"
                className={`${styles.input} ${fieldErrors.name ? styles.inputError : ''}`}
                placeholder="Nama lengkap kamu"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
              />
              {fieldErrors.name && <p className={styles.fieldError}>{fieldErrors.name}</p>}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                placeholder="contoh@email.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
              {fieldErrors.email && <p className={styles.fieldError}>{fieldErrors.email}</p>}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
                placeholder="Minimal 8 karakter"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
              />
              {fieldErrors.password && <p className={styles.fieldError}>{fieldErrors.password}</p>}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Daftar sebagai</label>
              <div className={styles.roleGroup}>
                {ROLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`${styles.roleOption} ${form.role === opt.value ? styles.roleActive : ''}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={opt.value}
                      checked={form.role === opt.value}
                      onChange={handleChange}
                      className={styles.roleRadio}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className={styles.btnSubmit} disabled={loading}>
              {loading ? 'Memproses...' : 'Daftar Sekarang'}
            </button>
          </form>
        )}

        <p className={styles.switchLink}>
          Sudah punya akun?{' '}
          <Link to="/masuk">Masuk di sini</Link>
        </p>
      </div>
    </div>
  );
}
