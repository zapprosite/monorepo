import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@crm-mvp/ui';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Email ou senha incorretos');
        return;
      }

      navigate('/dashboard');
    } catch {
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary relative overflow-hidden px-4 py-6 sm:py-0">
      {/* Background ambient effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] rounded-full bg-accent/5 blur-[80px] sm:blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[250px] h-[250px] sm:w-[400px] sm:h-[400px] rounded-full bg-info/5 blur-[60px] sm:blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm sm:max-w-md">
        {/* Branding */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-3 sm:mb-4">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
            JS Climatização
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            REFRIMIX TECNOLOGIA
          </p>
          <p className="text-[10px] sm:text-xs text-text-muted mt-1 sm:mt-2">
            Sistemas VRV / VRF · Climatização Profissional · Guarujá/SP
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-bg-secondary/80 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/5 p-6 sm:p-8 shadow-xl">
          <h2 className="text-base sm:text-lg font-semibold text-text-primary text-center mb-5 sm:mb-6">
            Acesso ao Sistema
          </h2>

          {/* Local Login Form */}
          <form onSubmit={handleLocalLogin} className="space-y-3 sm:space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <p className="text-xs sm:text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={loading}
            >
              Entrar
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-5 sm:mt-6 text-center space-y-1">
          <p className="text-[10px] sm:text-xs text-text-muted">
            JS Climatização: 41.792.723/0001-58 · REFRIMIX: 37.308.021/0001-89
          </p>
          <p className="text-[10px] sm:text-xs text-text-muted">
            Tel: (13) 97413-9382 · joaoslv1998@gmail.com
          </p>
          <p className="text-[10px] sm:text-xs text-text-muted/60 mt-1 sm:mt-2">
            Sistema interno — acesso restrito à equipe autorizada
          </p>
        </div>
      </div>
    </div>
  );
}
