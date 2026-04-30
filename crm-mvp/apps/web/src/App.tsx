import { Routes, Route } from 'react-router-dom';
import { ToastProvider } from '@crm-mvp/ui';
import LoginPage from './modules/auth/Login.page';
import DashboardPage from './pages/Dashboard.page';
import LeadsPage from './modules/leads/Leads.page';
import ClientsPage from './modules/clients/Clients.page';
import SchedulePage from './modules/schedule/Schedule.page';
import ContractsPage from './modules/contracts/Contracts.page';
import RemindersPage from './modules/reminders/Reminders.page';

function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/" element={<DashboardPage />} />
      </Routes>
    </ToastProvider>
  );
}

export default App;
