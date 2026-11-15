import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import CampaignList from './pages/CampaignList';
import CampaignDetail from './pages/CampaignDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import DonasiPage from './pages/DonasiPage';
import TransactionStatus from './pages/TransactionStatus';
import Dashboard from './pages/Dashboard';
import BuatKampanye from './pages/BuatKampanye';
import EditKampanye from './pages/EditKampanye';
import KelolaKampanye from './pages/KelolaKampanye';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar />
          <main style={{ flex: 1 }}>
            <Routes>
              {/* Publik */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/kampanye" element={<CampaignList />} />
              {/* Route statis /kampanye/* harus di atas route dinamis /kampanye/:id */}
              <Route path="/kampanye/kelola" element={
                <ProtectedRoute requiredRole="fundraiser"><KelolaKampanye /></ProtectedRoute>
              } />
              <Route path="/kampanye/buat" element={
                <ProtectedRoute requiredRole="fundraiser"><BuatKampanye /></ProtectedRoute>
              } />
              <Route path="/kampanye/edit/:id" element={
                <ProtectedRoute requiredRole="fundraiser"><EditKampanye /></ProtectedRoute>
              } />
              <Route path="/kampanye/:id" element={<CampaignDetail />} />
              <Route path="/masuk" element={<Login />} />
              <Route path="/daftar" element={<Register />} />
              {/* Butuh login */}
              <Route path="/donasi/:id" element={
                <ProtectedRoute><DonasiPage /></ProtectedRoute>
              } />
              <Route path="/status/:order_id" element={
                <ProtectedRoute><TransactionStatus /></ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute><Dashboard /></ProtectedRoute>
              } />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
