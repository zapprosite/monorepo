import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../utils/trpc';
import {
  PageShell, Sidebar, Header, DataTable, Button, Modal,
  Input, Select, StatusBadge, useToast,
} from '@crm-mvp/ui';
import { Plus, Pencil, Trash2, CheckCircle } from 'lucide-react';

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
];

const typeOptions = [
  { value: 'ligacao', label: 'Ligação' },
  { value: 'email', label: 'Email' },
  { value: 'visita', label: 'Visita' },
  { value: 'renovacao', label: 'Renovação' },
];

export default function RemindersPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: reminders, refetch } = trpc.reminders.list.useQuery({ status: filterStatus || undefined });
  const createMutation = trpc.reminders.create.useMutation({ onSuccess: () => { refetch(); setModalOpen(false); addToast('Lembrete criado', 'success'); } });
  const updateMutation = trpc.reminders.update.useMutation({ onSuccess: () => { refetch(); setModalOpen(false); addToast('Lembrete atualizado', 'success'); } });
  const deleteMutation = trpc.reminders.delete.useMutation({ onSuccess: () => { refetch(); addToast('Lembrete removido', 'success'); } });
  const completeMutation = trpc.reminders.complete.useMutation({ onSuccess: () => { refetch(); addToast('Lembrete concluído', 'success'); } });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      clientId: form.get('clientId') as string,
      title: form.get('title') as string,
      type: form.get('type') as any,
      dueDate: new Date(form.get('dueDate') as string).toISOString(),
      status: form.get('status') as any,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    { key: 'title', header: 'Título', sortable: true },
    { key: 'client', header: 'Cliente', render: (row: any) => row.client?.name || '-' },
    { key: 'type', header: 'Tipo', render: (row: any) => typeOptions.find(t => t.value === row.type)?.label || row.type },
    { key: 'dueDate', header: 'Data', render: (row: any) => new Date(row.dueDate).toLocaleDateString('pt-BR') },
    { key: 'status', header: 'Status', render: (row: any) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: 'Ações',
      render: (row: any) => (
        <div className="flex items-center gap-2">
          {row.status === 'pendente' && (
            <button onClick={() => completeMutation.mutate({ id: row.id })} className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors" title="Concluir"><CheckCircle size={16} /></button>
          )}
          <button onClick={() => { setEditing(row); setModalOpen(true); }} className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"><Pencil size={16} /></button>
          <button onClick={() => deleteMutation.mutate({ id: row.id })} className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"><Trash2 size={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      sidebar={<Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onLogout={() => { sessionStorage.removeItem('dev_user'); navigate('/auth/login'); }} userName="Dev User" />}
      header={<Header title="Lembretes" subtitle="Follow-ups e tarefas" actions={<Button leftIcon={<Plus size={16} />} onClick={() => { setEditing(null); setModalOpen(true); }}>Novo Lembrete</Button>} />}
    >
      <div className="mb-6">
        <Select options={statusOptions} value={filterStatus} onChange={setFilterStatus} className="sm:w-48" />
      </div>
      <DataTable columns={columns} data={reminders || []} keyExtractor={(row) => row.id} />
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Lembrete' : 'Novo Lembrete'} footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" form="reminder-form">{editing ? 'Salvar' : 'Criar'}</Button></>}>
        <form id="reminder-form" onSubmit={handleSubmit} className="space-y-4">
          <Input name="clientId" label="ID do Cliente" defaultValue={editing?.clientId} required />
          <Input name="title" label="Título" defaultValue={editing?.title} required />
          <Select name="type" label="Tipo" options={typeOptions} defaultValue={editing?.type || 'ligacao'} />
          <Input name="dueDate" label="Data de Vencimento" type="datetime-local" defaultValue={editing?.dueDate ? new Date(editing.dueDate).toISOString().slice(0, 16) : ''} required />
          <Select name="status" label="Status" options={statusOptions.slice(1)} defaultValue={editing?.status || 'pendente'} />
        </form>
      </Modal>
    </PageShell>
  );
}
