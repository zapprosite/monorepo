import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { user, loading, isAuthenticated: !!user };
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user && location.pathname !== '/auth/login') {
      navigate('/auth/login');
    }
  }, [loading, user, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-text-secondary">Carregando...</div>
      </div>
    );
  }

  if (!user && location.pathname !== '/auth/login') return null;

  return <>{children}</>;
}
