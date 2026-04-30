import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PageShell,
  Sidebar,
  Header,
  KPICard,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@crm-mvp/ui';
import {
  Users,
  UserCircle,
  FileText,
  CalendarDays,
  Bell,
  Plus,
} from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    sessionStorage.removeItem('dev_user');
    navigate('/auth/login');
  };

  return (
    <PageShell
      sidebar={
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onLogout={handleLogout}
          userName="Dev User"
          userEmail="dev@crm.local"
        />
      }
      header={
        <Header
          title="Dashboard"
          subtitle="Visão geral do seu negócio"
          actions={
            <Button leftIcon={<Plus size={16} />}>
              Novo Lead
            </Button>
          }
        />
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Total Clientes"
          value="3"
          icon={<UserCircle size={20} />}
          trend={{ value: 12, label: 'vs mês passado', direction: 'up' }}
        />
        <KPICard
          title="Leads Ativos"
          value="3"
          icon={<Users size={20} />}
          trend={{ value: 5, label: 'vs mês passado', direction: 'up' }}
        />
        <KPICard
          title="Contratos Ativos"
          value="2"
          icon={<FileText size={20} />}
        />
        <KPICard
          title="Lembretes Pendentes"
          value="2"
          icon={<Bell size={20} />}
          trend={{ value: -8, label: 'vs mês passado', direction: 'down' }}
        />
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Próximos Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary/50">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <CalendarDays size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Manutenção Preventiva</p>
                  <p className="text-xs text-text-muted">Refrigeração Silva Ltda</p>
                </div>
                <span className="text-xs text-text-secondary">Amanhã, 09:00</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary/50">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <CalendarDays size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Instalação de Splits</p>
                  <p className="text-xs text-text-muted">Condomínio Central Park</p>
                </div>
                <span className="text-xs text-text-secondary">Em 7 dias, 14:00</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lembretes Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary/50">
                <div className="w-2 h-2 rounded-full bg-warning" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Ligar para confirmar agendamento</p>
                  <p className="text-xs text-text-muted">Refrigeração Silva Ltda</p>
                </div>
                <span className="text-xs text-warning">Amanhã</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary/50">
                <div className="w-2 h-2 rounded-full bg-info" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Enviar proposta de renovação</p>
                  <p className="text-xs text-text-muted">Condomínio Central Park</p>
                </div>
                <span className="text-xs text-text-secondary">Em 11 meses</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
