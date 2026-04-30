import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('dev@crm.local');

  const handleDevLogin = () => {
    sessionStorage.setItem('dev_user', email);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="card w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">CRM MVP</h1>
          <p className="text-text-secondary mt-2">Login de desenvolvimento</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Email dev</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
            />
          </div>

          <button onClick={handleDevLogin} className="btn-primary w-full">
            Entrar como Dev
          </button>
        </div>

        <p className="text-xs text-text-muted text-center">
          OAuth2 Google será implementado na Fase 2
        </p>
      </div>
    </div>
  );
}
