import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, DataTable, Badge, PageShell, useToast } from '@crm-mvp/ui';
import type { Column } from '@crm-mvp/ui';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  team?: { name: string } | null;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  technician: 'Técnico',
  user: 'Usuário',
};

const roleVariants: Record<string, any> = {
  admin: 'danger',
  manager: 'warning',
  technician: 'info',
  user: 'default',
};

export default function TeamPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/trpc/users.list');
      const data = await res.json();
      setUsers(data.result?.data || []);
    } catch {
      addToast('Erro ao carregar equipe', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const procedure = editingUser ? 'users.update' : 'users.create';
      const payload = editingUser
        ? { id: editingUser.id, name: formData.name, email: formData.email, role: formData.role }
        : { name: formData.name, email: formData.email, password: formData.password, role: formData.role };

      const res = await fetch('/trpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: procedure, input: payload }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      addToast(editingUser ? 'Usuário atualizado!' : 'Usuário criado!', 'success');
      setModalOpen(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'user' });
      fetchUsers();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao salvar usuário', 'error');
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Remover ${user.name}?`)) return;
    try {
      const res = await fetch('/trpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'users.delete', input: { id: user.id } }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      addToast('Usuário removido', 'success');
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
    });
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: 'user' });
    setModalOpen(true);
  };

  const columns: Column<User>[] = [
    { key: 'name', header: 'Nome', render: (u) => u.name },
    { key: 'email', header: 'Email', render: (u) => u.email },
    {
      key: 'role',
      header: 'Função',
      render: (u) => <Badge variant={roleVariants[u.role] || 'default'}>{roleLabels[u.role] || u.role}</Badge>,
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
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Gerenciar Equipe</h1>
            <p className="text-text-secondary mt-1">Crie e gerencie acessos de colaboradores</p>
          </div>
          <Button onClick={openCreate} leftIcon="+">
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
      </div>

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
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Função</label>
            <select
              className="w-full bg-bg-tertiary rounded-input border border-white/10 px-4 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="user">Usuário</option>
              <option value="technician">Técnico</option>
              <option value="manager">Gerente</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

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
    </PageShell>
  );
}
