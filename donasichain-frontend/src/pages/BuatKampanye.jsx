import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCampaign } from '../api/campaign';
import styles from './CampaignForm.module.css';

// Tanggal minimal: besok
function getMinDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function BuatKampanye() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    target_amount: '',
    deadline: '',
    image_url: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    setServerError('');
  };

  // Validasi sisi klien sesuai aturan backend
  const validate = () => {
    const errors = {};
    if (!form.title.trim())
      errors.title = 'Judul wajib diisi.';
    if (!form.description.trim())
      errors.description = 'Deskripsi wajib diisi.';
    const target = parseInt(form.target_amount);
    if (!form.target_amount || isNaN(target))
      errors.target_amount = 'Target donasi wajib diisi.';
    else if (target < 10000)
      errors.target_amount = 'Target minimal Rp 10.000.';
    if (!form.deadline)
      errors.deadline = 'Tenggat wajib diisi.';
    else if (form.deadline < getMinDeadline())
      errors.deadline = 'Tenggat harus minimal besok.';
    if (form.image_url && !/^https?:\/\/.+/.test(form.image_url))
      errors.image_url = 'URL gambar harus diawali http:// atau https://';
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

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        target_amount: parseInt(form.target_amount),
        deadline: form.deadline,
      };
      if (form.image_url.trim()) payload.image_url = form.image_url.trim();

      const res = await createCampaign(payload);
      navigate(`/kampanye/kelola`, {
        state: { successMsg: res.data.message },
      });
    } catch (err) {
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
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Buat Kampanye Baru</h1>
          <p className={styles.subtitle}>
            Kampanye akan ditinjau admin sebelum ditampilkan ke publik.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {serverError && <div className={styles.alertError}>{serverError}</div>}

          {/* Judul */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="title">Judul Kampanye</label>
            <input
              id="title"
              name="title"
              type="text"
              className={`${styles.input} ${fieldErrors.title ? styles.inputError : ''}`}
              placeholder="Contoh: Bantu Korban Banjir Cianjur"
              value={form.title}
              onChange={handleChange}
              maxLength={200}
            />
            {fieldErrors.title && <p className={styles.fieldError}>{fieldErrors.title}</p>}
            <p className={styles.hint}>{form.title.length}/200 karakter</p>
          </div>

          {/* Deskripsi */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="description">Deskripsi</label>
            <textarea
              id="description"
              name="description"
              className={`${styles.textarea} ${fieldErrors.description ? styles.inputError : ''}`}
              placeholder="Jelaskan tujuan kampanye, siapa yang dibantu, dan bagaimana dana akan digunakan..."
              value={form.description}
              onChange={handleChange}
              rows={6}
            />
            {fieldErrors.description && (
              <p className={styles.fieldError}>{fieldErrors.description}</p>
            )}
          </div>

          {/* Target donasi */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="target_amount">Target Donasi</label>
            <div className={styles.inputPrefix}>
              <span className={styles.prefix}>Rp</span>
              <input
                id="target_amount"
                name="target_amount"
                type="text"
                inputMode="numeric"
                className={`${styles.input} ${fieldErrors.target_amount ? styles.inputError : ''}`}
                placeholder="Contoh: 5000000"
                value={form.target_amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setForm((prev) => ({ ...prev, target_amount: val }));
                  setFieldErrors((prev) => ({ ...prev, target_amount: '' }));
                }}
              />
            </div>
            {form.target_amount && parseInt(form.target_amount) >= 10000 && (
              <p className={styles.preview}>
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
                }).format(parseInt(form.target_amount))}
              </p>
            )}
            {fieldErrors.target_amount && (
              <p className={styles.fieldError}>{fieldErrors.target_amount}</p>
            )}
            <p className={styles.hint}>Minimal Rp 10.000</p>
          </div>

          {/* Tenggat */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="deadline">Tenggat Kampanye</label>
            <input
              id="deadline"
              name="deadline"
              type="date"
              className={`${styles.input} ${fieldErrors.deadline ? styles.inputError : ''}`}
              value={form.deadline}
              onChange={handleChange}
              min={getMinDeadline()}
            />
            {fieldErrors.deadline && (
              <p className={styles.fieldError}>{fieldErrors.deadline}</p>
            )}
          </div>

          {/* URL Gambar */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="image_url">
              URL Gambar <span className={styles.opsional}>(opsional)</span>
            </label>
            <input
              id="image_url"
              name="image_url"
              type="url"
              className={`${styles.input} ${fieldErrors.image_url ? styles.inputError : ''}`}
              placeholder="https://example.com/gambar.jpg"
              value={form.image_url}
              onChange={handleChange}
            />
            {fieldErrors.image_url && (
              <p className={styles.fieldError}>{fieldErrors.image_url}</p>
            )}
            <p className={styles.hint}>
              Masukkan URL gambar dari internet. Upload file tidak didukung saat ini.
            </p>
          </div>

          {/* Info blockchain */}
          <div className={styles.infoBox}>
            <p className={styles.infoTitle}>📦 Informasi Blockchain</p>
            <p className={styles.infoText}>
              Setelah kampanye disetujui admin, data kampanye akan dicatat otomatis
              ke smart contract Ethereum Sepolia oleh sistem backend.
              Kamu tidak perlu melakukan tindakan apapun.
            </p>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnBatal}
              onClick={() => navigate('/kampanye/kelola')}
            >
              Batal
            </button>
            <button type="submit" className={styles.btnSubmit} disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Buat Kampanye'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
