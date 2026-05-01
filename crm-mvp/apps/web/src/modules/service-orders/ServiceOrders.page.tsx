import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../utils/trpc';
import {
  PageShell, Sidebar, Header, DataTable, Button, Modal,
  Input, Select, Textarea, StatusBadge, useToast,
} from '@crm-mvp/ui';
import { Plus, Play, Pencil, Trash2 } from 'lucide-react';

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

const typeOptions = [
  { value: '', label: 'Todos' },
  { value: 'instalacao', label: 'Instalação' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'reparo', label: 'Reparo' },
  { value: 'visita_tecnica', label: 'Visita Técnica' },
  { value: 'emergencia', label: 'Emergência' },
];

const priorityOptions = [
  { value: '', label: 'Todas' },
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

const typeFormOptions = [
  { value: 'instalacao', label: 'Instalação' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'reparo', label: 'Reparo' },
  { value: 'visita_tecnica', label: 'Visita Técnica' },
  { value: 'emergencia', label: 'Emergência' },
];

const priorityFormOptions = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

const statusFormOptions = [
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

const typeLabels: Record<string, string> = {
  instalacao: 'Instalação',
  manutencao: 'Manutenção',
  reparo: 'Reparo',
  visita_tecnica: 'Visita Técnica',
  emergencia: 'Emergência',
};

const priorityLabels: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

const PriorityDot: React.FC<{ priority: string }> = ({ priority }) => {
  const colors: Record<string, string> = {
    baixa: 'bg-gray-400',
    media: 'bg-blue-500',
    alta: 'bg-orange-500',
    urgente: 'bg-red-500',
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[priority] ?? 'bg-gray-400'}`}
      title={priorityLabels[priority] ?? priority}
    />
  );
};

export default function ServiceOrdersPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: serviceOrders, refetch } = trpc.serviceOrders.list.useQuery({
    status: filterStatus || undefined,
    type: filterType || undefined,
    priority: filterPriority || undefined,
    search: search || undefined,
  });

  const { data: clients } = trpc.clients.list.useQuery({});
  const { data: equipamentos } = trpc.equipamentos.list.useQuery({});
  const { data: users } = trpc.users.list.useQuery();

  const clientOptions = [
    { value: '', label: 'Nenhum' },
    ...(clients ?? []).map((c: any) => ({ value: c.id, label: c.name })),
  ];

  const equipamentoOptions = [
    { value: '', label: 'Nenhum' },
    ...(equipamentos ?? []).map((e: any) => ({ value: e.id, label: e.name })),
  ];

  const technicianOptions = [
    { value: '', label: 'Não atribuído' },
    ...(users ?? []).map((u: any) => ({ value: u.id, label: u.name })),
  ];

  const createMutation = trpc.serviceOrders.create.useMutation({
    onSuccess: () => {
      refetch();
      setModalOpen(false);
      addToast('Ordem de serviço criada', 'success');
    },
  });

  const updateMutation = trpc.serviceOrders.update.useMutation({
    onSuccess: () => {
      refetch();
      setModalOpen(false);
      addToast('Ordem de serviço atualizada', 'success');
    },
  });

  const deleteMutation = trpc.serviceOrders.delete.useMutation({
    onSuccess: () => {
      refetch();
      addToast('Ordem de serviço removida', 'success');
    },
  });

  const startExecutionMutation = trpc.serviceOrders.startExecution.useMutation({
    onSuccess: (data: any) => {
      refetch();
      if (data?.id) navigate(`/service-orders/execute/${data.id}`);
      addToast('Execução iniciada', 'success');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      title: form.get('title') as string,
      description: form.get('description') as string || undefined,
      clientId: form.get('clientId') as string || undefined,
      equipamentoId: form.get('equipamentoId') as string || undefined,
      technicianId: form.get('technicianId') as string || undefined,
      type: form.get('type') as string,
      priority: form.get('priority') as string,
      status: form.get('status') as string,
      scheduledDate: form.get('scheduledDate') as string || undefined,
      cost: form.get('cost') ? Number(form.get('cost')) : undefined,
      notes: form.get('notes') as string || undefined,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    {
      key: 'priority',
      header: '',
      sortable: false,
      render: (row: any) => <PriorityDot priority={row.priority} />,
    },
    { key: 'title', header: 'Título', sortable: true },
    {
      key: 'type',
      header: 'Tipo',
      render: (row: any) => typeLabels[row.type] ?? row.type,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      key: 'client',
      header: 'Cliente',
      render: (row: any) => row.client?.name ?? '—',
    },
    {
      key: 'equipamento',
      header: 'Equipamento',
      render: (row: any) => row.equipamento?.name ?? '—',
    },
    {
      key: 'technician',
      header: 'Técnico',
      render: (row: any) => row.technician?.name ?? '—',
    },
    {
      key: 'scheduledDate',
      header: 'Agendado',
      sortable: true,
      render: (row: any) =>
        row.scheduledDate
          ? new Date(row.scheduledDate).toLocaleDateString('pt-BR')
          : '—',
    },
    {
      key: 'cost',
      header: 'Custo',
      sortable: true,
      render: (row: any) =>
        row.cost != null ? `R$ ${Number(row.cost).toFixed(2)}` : '—',
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (row: any) => (
        <div className="flex items-center gap-1">
          {row.status !== 'em_andamento' && row.status !== 'concluida' && (
            <button
              onClick={() => startExecutionMutation.mutate({ id: row.id })}
              className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
              title="Executar OS"
            >
              <Play size={16} />
            </button>
          )}
          <button
            onClick={() => {
              setEditing(row);
              setModalOpen(true);
            }}
            className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            title="Editar"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => {
              if (confirm('Remover esta OS?')) {
                deleteMutation.mutate({ id: row.id });
              }
            }}
            className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            title="Remover"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      sidebar={
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onLogout={() => {
            sessionStorage.removeItem('dev_user');
            navigate('/auth/login');
          }}
          userName="Dev User"
        />
      }
      header={
        <Header
          title="Ordens de Serviço"
          subtitle="Gestão de OS"
          actions={
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              Nova OS
            </Button>
          }
        />
      }
    >
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-64"
        />
        <Select
          options={statusOptions}
          value={filterStatus}
          onChange={setFilterStatus}
          className="sm:w-44"
        />
        <Select
          options={typeOptions}
          value={filterType}
          onChange={setFilterType}
          className="sm:w-44"
        />
        <Select
          options={priorityOptions}
          value={filterPriority}
          onChange={setFilterPriority}
          className="sm:w-36"
        />
      </div>

      <DataTable
        columns={columns}
        data={serviceOrders || []}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => navigate(`/service-orders/execute/${row.id}`)}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar OS' : 'Nova OS'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="so-form">
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </>
        }
      >
        <form id="so-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            name="title"
            label="Título"
            defaultValue={editing?.title}
            required
          />
          <Textarea
            name="description"
            label="Descrição"
            defaultValue={editing?.description}
            rows={2}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              name="clientId"
              label="Cliente"
              options={clientOptions}
              defaultValue={editing?.clientId ?? ''}
            />
            <Select
              name="equipamentoId"
              label="Equipamento"
              options={equipamentoOptions}
              defaultValue={editing?.equipamentoId ?? ''}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select
              name="type"
              label="Tipo"
              options={typeFormOptions}
              defaultValue={editing?.type || 'manutencao'}
            />
            <Select
              name="priority"
              label="Prioridade"
              options={priorityFormOptions}
              defaultValue={editing?.priority || 'media'}
            />
            <Select
              name="status"
              label="Status"
              options={statusFormOptions}
              defaultValue={editing?.status || 'orcamento'}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              name="technicianId"
              label="Técnico"
              options={technicianOptions}
              defaultValue={editing?.technicianId ?? ''}
            />
            <Input
              name="scheduledDate"
              label="Data Agendada"
              type="datetime-local"
              defaultValue={
                editing?.scheduledDate
                  ? new Date(editing.scheduledDate)
                      .toISOString()
                      .slice(0, 16)
                  : ''
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="cost"
              label="Custo (R$)"
              type="number"
              step="0.01"
              min="0"
              defaultValue={editing?.cost ?? ''}
            />
          </div>
          <Textarea
            name="notes"
            label="Observações"
            defaultValue={editing?.notes}
            rows={3}
          />
        </form>
      </Modal>
    </PageShell>
  );
}
