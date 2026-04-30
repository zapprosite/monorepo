import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@crm-mvp/ui';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('dev@crm.local');

  const handleDevLogin = () => {
    sessionStorage.setItem('dev_user', email);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="bg-bg-secondary rounded-card border border-white/5 p-8 w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">CRM MVP</h1>
          <p className="text-text-secondary mt-2">Login de desenvolvimento</p>
        </div>

        <div className="space-y-4">
          <Input
            label="Email dev"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Button onClick={handleDevLogin} className="w-full">
            Entrar como Dev
          </Button>
        </div>

        <p className="text-xs text-text-muted text-center">
          OAuth2 Google será implementado na Fase 4
        </p>
      </div>
    </div>
  );
}
