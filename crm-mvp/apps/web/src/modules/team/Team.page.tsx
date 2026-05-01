import { useState, useEffect } from 'react';
import { Button, Input, Modal, DataTable, Badge, PageShell, useToast, Select } from '@crm-mvp/ui';
import type { Column, BadgeVariant } from '@crm-mvp/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  users: User[];
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId: string | null;
  team?: { id: string; name: string } | null;
  createdAt: string;
}

// ─── Trpc fetch helper ─────────────────────────────────────────────────────────

async function trpcCall(path: string, input: unknown) {
  const res = await fetch('/trpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, input }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result?.data;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  technician: 'Técnico',
  user: 'Usuário',
};

const roleVariants: Record<string, BadgeVariant> = {
  admin: 'danger',
  manager: 'warning',
  technician: 'info',
  user: 'default',
};

// ─── Equipes Tab ──────────────────────────────────────────────────────────────

function TeamsTab({ onRefresh }: { onRefresh: () => void }) {
  const { addToast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const data = await trpcCall('teams.list', {});
      setTeams(data || []);
    } catch {
      addToast('Erro ao carregar equipes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTeams(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const procedure = editingTeam ? 'teams.update' : 'teams.create';
      const payload = editingTeam
        ? { id: editingTeam.id, name: formData.name, description: formData.description }
        : { name: formData.name, description: formData.description };
      await trpcCall(procedure, payload);
      addToast(editingTeam ? 'Equipe atualizada!' : 'Equipe criada!', 'success');
      setModalOpen(false);
      setEditingTeam(null);
      setFormData({ name: '', description: '' });
      fetchTeams();
      onRefresh();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao salvar equipe', 'error');
    }
  };

  const handleDelete = async (team: Team) => {
    if (!confirm(`Remover equipe "${team.name}"? Usuários serão desvinculados.`)) return;
    try {
      await trpcCall('teams.delete', { id: team.id });
      addToast('Equipe removida', 'success');
      fetchTeams();
      onRefresh();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao remover', 'error');
    }
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({ name: team.name, description: team.description || '' });
    setModalOpen(true);
  };

  const columns: Column<Team>[] = [
    { key: 'name', header: 'Nome', render: (t) => t.name },
    {
      key: 'description',
      header: 'Descrição',
      render: (t) => (
        <span className="text-text-secondary text-sm">{t.description || '—'}</span>
      ),
    },
    {
      key: 'users',
      header: 'Membros',
      render: (t) => <Badge variant="accent">{t.users?.length ?? 0}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      render: (t) => new Date(t.createdAt).toLocaleDateString('pt-BR'),
    },
    {
      key: 'actions',
      header: '',
      render: (t) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
            Editar
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(t)}>
            Remover
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Equipes</h2>
          <p className="text-text-secondary text-sm mt-0.5">Grupos de trabalho para organizar colaboradores</p>
        </div>
        <Button
          onClick={() => {
            setEditingTeam(null);
            setFormData({ name: '', description: '' });
            setModalOpen(true);
          }}
          leftIcon="+"
        >
          Nova Equipe
        </Button>
      </div>

      <DataTable
        data={teams}
        columns={columns}
        keyExtractor={(t) => t.id}
        pagination={{ pageSize: 10 }}
        emptyMessage="Nenhuma equipe cadastrada"
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTeam ? 'Editar Equipe' : 'Nova Equipe'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome da equipe"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Ex.: Equipe Norte, Equipe Refrigeração"
          />
          <Input
            label="Descrição"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Área de atuação, região, etc."
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              {editingTeam ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Colaboradores Tab ─────────────────────────────────────────────────────────

function UsersTab() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    teamId: '',
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await trpcCall('users.list', {});
      setUsers(data || []);
    } catch {
      addToast('Erro ao carregar colaboradores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const data = await trpcCall('teams.list', {});
      setTeams(data || []);
    } catch { /* silently fail */ }
  };

  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const procedure = editingUser ? 'users.update' : 'users.create';
      const payload = editingUser
        ? { id: editingUser.id, name: formData.name, email: formData.email, role: formData.role, teamId: formData.teamId || null }
        : { name: formData.name, email: formData.email, password: formData.password, role: formData.role, teamId: formData.teamId || null };
      await trpcCall(procedure, payload);
      addToast(editingUser ? 'Colaborador atualizado!' : 'Colaborador criado!', 'success');
      setModalOpen(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'user', teamId: '' });
      fetchUsers();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao salvar colaborador', 'error');
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Remover ${user.name}?`)) return;
    try {
      await trpcCall('users.delete', { id: user.id });
      addToast('Colaborador removido', 'success');
      fetchUsers();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao remover', 'error');
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      teamId: user.teamId || '',
    });
    setModalOpen(true);
  };

  const teamOptions = [
    { value: '', label: 'Sem equipe' },
    ...teams.map((t) => ({ value: t.id, label: t.name })),
  ];

  const roleOptions = [
    { value: 'user', label: 'Usuário' },
    { value: 'technician', label: 'Técnico' },
    { value: 'manager', label: 'Gerente' },
    { value: 'admin', label: 'Administrador' },
  ];

  const columns: Column<User>[] = [
    { key: 'name', header: 'Nome', render: (u) => u.name },
    { key: 'email', header: 'Email', render: (u) => u.email },
    {
      key: 'role',
      header: 'Função',
      render: (u) => (
        <Badge variant={(roleVariants[u.role] ?? 'default') as BadgeVariant}>
          {roleLabels[u.role] || u.role}
        </Badge>
      ),
    },
    {
      key: 'team',
      header: 'Equipe',
      render: (u) =>
        u.team ? (
          <Badge variant="info">{u.team.name}</Badge>
        ) : (
          <span className="text-text-muted text-sm">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      render: (u) => new Date(u.createdAt).toLocaleDateString('pt-BR'),
    },
    {
      key: 'actions',
      header: '',
      render: (u) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
            Editar
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(u)}>
            Remover
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Colaboradores</h2>
          <p className="text-text-secondary text-sm mt-0.5">Cadastro local — sem OAuth</p>
        </div>
        <Button
          onClick={() => {
            setEditingUser(null);
            setFormData({ name: '', email: '', password: '', role: 'user', teamId: '' });
            setModalOpen(true);
          }}
          leftIcon="+"
        >
          Novo Colaborador
        </Button>
      </div>

      <DataTable
        data={users}
        columns={columns}
        keyExtractor={(u) => u.id}
        pagination={{ pageSize: 10 }}
        emptyMessage="Nenhum colaborador cadastrado"
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? 'Editar Colaborador' : 'Novo Colaborador'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome completo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          {!editingUser && (
            <Input
              label="Senha"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!editingUser}
              helperText="Mínimo 4 caracteres"
            />
          )}
          <Select
            label="Função"
            options={roleOptions}
            value={formData.role}
            onChange={(val) => setFormData({ ...formData, role: val })}
          />
          <Select
            label="Equipe"
            options={teamOptions}
            value={formData.teamId}
            onChange={(val) => setFormData({ ...formData, teamId: val })}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              {editingUser ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<'teams' | 'users'>('teams');
  const [, setRefresh] = useState(0);

  const triggerRefresh = () => setRefresh((n) => n + 1);

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Gerenciar Equipe</h1>
          <p className="text-text-secondary mt-1">Equipes e colaboradores com cadastro local</p>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'teams'
                ? 'bg-bg-secondary text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Equipes
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'users'
                ? 'bg-bg-secondary text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Colaboradores
          </button>
        </div>

        {activeTab === 'teams' ? (
          <TeamsTab onRefresh={triggerRefresh} />
        ) : (
          <UsersTab />
        )}
      </div>
    </PageShell>
  );
}
