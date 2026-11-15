import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
});

// Sisipkan token JWT ke setiap request jika tersedia
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Tangani 401 — token tidak valid atau kedaluwarsa di tengah sesi
// Guard: tidak redirect jika sudah di halaman /masuk agar tidak loop
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.startsWith('/masuk')
    ) {
      localStorage.removeItem('token');
      window.location.href = '/masuk';
    }
    return Promise.reject(error);
  }
);

export default api;
