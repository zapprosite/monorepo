import { Routes, Route } from 'react-router-dom';
import { ToastProvider } from '@crm-mvp/ui';
import { AuthGuard } from './modules/auth/useAuth';
import LoginPage from './modules/auth/Login.page';
import DashboardPage from './pages/Dashboard.page';
import LeadsPage from './modules/leads/Leads.page';
import ClientsPage from './modules/clients/Clients.page';
import SchedulePage from './modules/schedule/Schedule.page';
import ContractsPage from './modules/contracts/Contracts.page';
import RemindersPage from './modules/reminders/Reminders.page';
import TeamPage from './modules/team/Team.page';
import EquipamentosPage from './modules/equipamentos/Equipamentos.page';
import ServiceOrdersPage from './modules/service-orders/ServiceOrders.page';
import ExecuteServiceOrderPage from './modules/service-orders/ExecuteServiceOrder.page';
import VisualIdentityPage from './modules/settings/VisualIdentity.page';

function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <DashboardPage />
            </AuthGuard>
          }
        />
        <Route
          path="/leads"
          element={
            <AuthGuard>
              <LeadsPage />
            </AuthGuard>
          }
        />
        <Route
          path="/clients"
          element={
            <AuthGuard>
              <ClientsPage />
            </AuthGuard>
          }
        />
        <Route
          path="/schedule"
          element={
            <AuthGuard>
              <SchedulePage />
            </AuthGuard>
          }
        />
        <Route
          path="/contracts"
          element={
            <AuthGuard>
              <ContractsPage />
            </AuthGuard>
          }
        />
        <Route
          path="/reminders"
          element={
            <AuthGuard>
              <RemindersPage />
            </AuthGuard>
          }
        />
        <Route
          path="/equipamentos"
          element={
            <AuthGuard>
              <EquipamentosPage />
            </AuthGuard>
          }
        />
        <Route
          path="/service-orders/execute/:id"
          element={
            <AuthGuard>
              <ExecuteServiceOrderPage />
            </AuthGuard>
          }
        />
        <Route
          path="/service-orders"
          element={
            <AuthGuard>
              <ServiceOrdersPage />
            </AuthGuard>
          }
        />
        <Route
          path="/team"
          element={
            <AuthGuard>
              <TeamPage />
            </AuthGuard>
          }
        />
        <Route
          path="/settings/visual-identity"
          element={
            <AuthGuard>
              <VisualIdentityPage />
            </AuthGuard>
          }
        />
        <Route
          path="/"
          element={
            <AuthGuard>
              <DashboardPage />
            </AuthGuard>
          }
        />
      </Routes>
    </ToastProvider>
  );
}

export default App;
