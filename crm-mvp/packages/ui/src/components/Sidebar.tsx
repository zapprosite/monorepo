import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  CalendarDays,
  FileText,
  Bell,
  LogOut,
  Menu,
  X,
  Shield,
  Wrench,
  ClipboardList,
  Settings,
  Palette,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onLogout?: () => void;
  userName?: string;
  userEmail?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Leads', path: '/leads', icon: <Users size={20} /> },
  { label: 'Clientes', path: '/clients', icon: <UserCircle size={20} /> },
  { label: 'Equipamentos', path: '/equipamentos', icon: <Wrench size={20} /> },
  { label: 'Ordens de Serviço', path: '/service-orders', icon: <ClipboardList size={20} /> },
  { label: 'Agenda', path: '/schedule', icon: <CalendarDays size={20} /> },
  { label: 'Contratos', path: '/contracts', icon: <FileText size={20} /> },
  { label: 'Lembretes', path: '/reminders', icon: <Bell size={20} /> },
  { label: 'Equipe', path: '/team', icon: <Shield size={20} /> },
  { label: 'Identidade Visual', path: '/settings/visual-identity', icon: <Palette size={20} /> },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  onLogout,
  userName = 'Usuário',
  userEmail = 'user@crm.local',
}) => {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Toggle button (mobile) */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 p-2 rounded-button bg-bg-secondary border border-white/10 text-text-primary lg:hidden"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-bg-secondary border-r border-white/5 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/5">
          <h1 className="text-xl font-bold text-accent tracking-tight">CRM MVP</h1>
          <p className="text-xs text-text-muted mt-0.5">Serviços Técnicos</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onToggle();
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-accent text-black rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent font-semibold text-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{userName}</p>
              <p className="text-xs text-text-muted truncate">{userEmail}</p>
            </div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-muted hover:text-danger hover:bg-danger/5 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              Sair
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
