export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-text-secondary mt-4">Bem-vindo ao CRM MVP!</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="card">
          <p className="text-text-muted text-sm">Clientes</p>
          <p className="text-kpi text-accent mt-2">0</p>
        </div>
        <div className="card">
          <p className="text-text-muted text-sm">Leads Ativos</p>
          <p className="text-kpi text-accent mt-2">0</p>
        </div>
        <div className="card">
          <p className="text-text-muted text-sm">Contratos</p>
          <p className="text-kpi text-accent mt-2">0</p>
        </div>
      </div>
    </div>
  );
}
