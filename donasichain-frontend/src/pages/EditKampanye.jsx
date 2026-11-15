import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCampaignById, updateCampaign } from '../api/campaign';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from './CampaignForm.module.css';

function getMinDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function EditKampanye() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    target_amount: '',
    deadline: '',
    image_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Ambil data kampanye yang akan diedit dari GET /api/campaigns/:id
  // Catatan: endpoint ini hanya mengembalikan kampanye yang is_approved = TRUE.
  // Kampanye yang belum disetujui tidak bisa diakses via endpoint publik ini.
  // Backend PUT /api/campaigns/:id tetap bisa diakses jika user adalah pemilik.
  useEffect(() => {
    getCampaignById(id)
      .then((res) => {
        const c = res.data.data;
        setIsApproved(c.is_approved);
        setForm({
          title: c.title || '',
          description: c.description || '',
          target_amount: String(c.target_amount || ''),
          deadline: c.deadline ? c.deadline.split('T')[0] : '',
          image_url: c.image_url || '',
        });
      })
      .catch((err) => {
        if (err.response?.status === 404)
          setServerError('Kampanye tidak ditemukan.');
        else
          setServerError('Gagal memuat data kampanye.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    setServerError('');
  };

  const validate = () => {
    const errors = {};
    if (!form.title.trim()) errors.title = 'Judul wajib diisi.';
    if (!form.description.trim()) errors.description = 'Deskripsi wajib diisi.';
    const target = parseInt(form.target_amount);
    if (!form.target_amount || isNaN(target))
      errors.target_amount = 'Target donasi wajib diisi.';
    else if (target < 10000)
      errors.target_amount = 'Target minimal Rp 10.000.';
    if (!form.deadline) errors.deadline = 'Tenggat wajib diisi.';
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
        image_url: form.image_url.trim() || null,
      };

      await updateCampaign(id, payload);
      navigate('/kampanye/kelola', {
        state: { successMsg: 'Kampanye berhasil diperbarui.' },
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

  if (loading) return <LoadingSpinner text="Memuat kampanye..." />;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Edit Kampanye</h1>
          {isApproved ? (
            <div className={styles.alertWarning}>
              ⚠️ Kampanye ini sudah disetujui admin dan <strong>tidak dapat diedit</strong>.
              Hubungi admin jika perlu perubahan.
            </div>
          ) : (
            <p className={styles.subtitle}>
              Kampanye hanya bisa diedit sebelum disetujui admin.
            </p>
          )}
        </div>

        {serverError && <div className={styles.alertError}>{serverError}</div>}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <fieldset disabled={isApproved} className={styles.fieldset}>
            {/* Judul */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="title">Judul Kampanye</label>
              <input
                id="title"
                name="title"
                type="text"
                className={`${styles.input} ${fieldErrors.title ? styles.inputError : ''}`}
                value={form.title}
                onChange={handleChange}
                maxLength={200}
              />
              {fieldErrors.title && <p className={styles.fieldError}>{fieldErrors.title}</p>}
            </div>

            {/* Deskripsi */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="description">Deskripsi</label>
              <textarea
                id="description"
                name="description"
                className={`${styles.textarea} ${fieldErrors.description ? styles.inputError : ''}`}
                value={form.description}
                onChange={handleChange}
                rows={6}
              />
              {fieldErrors.description && (
                <p className={styles.fieldError}>{fieldErrors.description}</p>
              )}
            </div>

            {/* Target */}
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
            </div>
          </fieldset>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnBatal}
              onClick={() => navigate('/kampanye/kelola')}
            >
              Batal
            </button>
            {!isApproved && (
              <button type="submit" className={styles.btnSubmit} disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
