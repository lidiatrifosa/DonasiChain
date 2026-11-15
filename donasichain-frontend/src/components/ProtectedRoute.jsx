import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner text="Memeriksa sesi..." />;
  if (!user) return <Navigate to="/masuk" replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/" replace />;

  return children;
}
