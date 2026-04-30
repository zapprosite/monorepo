import { Routes, Route } from 'react-router-dom';
import LoginPage from './modules/auth/Login.page';
import DashboardPage from './pages/Dashboard.page';

function App() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/" element={<DashboardPage />} />
    </Routes>
  );
}

export default App;
