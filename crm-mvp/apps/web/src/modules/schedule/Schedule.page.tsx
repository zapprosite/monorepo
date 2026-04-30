import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../utils/trpc';
import {
  PageShell, Sidebar, Header, DataTable, Button, Modal,
  Input, Select, Textarea, StatusBadge, useToast,
} from '@crm-mvp/ui';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'agendado', label: 'Agendado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
];

const typeOptions = [
  { value: 'instalacao', label: 'Instalação' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'visita_tecnica', label: 'Visita Técnica' },
  { value: 'emergencia', label: 'Emergência' },
];

export default function SchedulePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: schedules, refetch } = trpc.schedules.list.useQuery({ status: filterStatus || undefined });
  const createMutation = trpc.schedules.create.useMutation({ onSuccess: () => { refetch(); setModalOpen(false); addToast('Agendamento criado', 'success'); } });
  const updateMutation = trpc.schedules.update.useMutation({ onSuccess: () => { refetch(); setModalOpen(false); addToast('Agendamento atualizado', 'success'); } });
  const deleteMutation = trpc.schedules.delete.useMutation({ onSuccess: () => { refetch(); addToast('Agendamento removido', 'success'); } });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      clientId: form.get('clientId') as string,
      dateTime: new Date(form.get('dateTime') as string).toISOString(),
      type: form.get('type') as any,
      status: form.get('status') as any,
      notes: form.get('notes') as string,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    { key: 'client', header: 'Cliente', render: (row: any) => row.client?.name || '-' },
    { key: 'dateTime', header: 'Data/Hora', render: (row: any) => new Date(row.dateTime).toLocaleString('pt-BR') },
    { key: 'type', header: 'Tipo', render: (row: any) => typeOptions.find(t => t.value === row.type)?.label || row.type },
    { key: 'status', header: 'Status', render: (row: any) => <StatusBadge status={row.status} /> },
    { key: 'notes', header: 'Observações', render: (row: any) => row.notes || '-' },
    {
      key: 'actions', header: 'Ações',
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditing(row); setModalOpen(true); }} className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"><Pencil size={16} /></button>
          <button onClick={() => deleteMutation.mutate({ id: row.id })} className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"><Trash2 size={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      sidebar={<Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onLogout={() => { sessionStorage.removeItem('dev_user'); navigate('/auth/login'); }} userName="Dev User" />}
      header={<Header title="Agenda" subtitle="Agendamentos de serviços" actions={<Button leftIcon={<Plus size={16} />} onClick={() => { setEditing(null); setModalOpen(true); }}>Novo Agendamento</Button>} />}
    >
      <div className="mb-6">
        <Select options={statusOptions} value={filterStatus} onChange={setFilterStatus} className="sm:w-48" />
      </div>
      <DataTable columns={columns} data={schedules || []} keyExtractor={(row) => row.id} />
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Agendamento' : 'Novo Agendamento'} footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" form="schedule-form">{editing ? 'Salvar' : 'Criar'}</Button></>}>
        <form id="schedule-form" onSubmit={handleSubmit} className="space-y-4">
          <Input name="clientId" label="ID do Cliente" defaultValue={editing?.clientId} required />
          <Input name="dateTime" label="Data e Hora" type="datetime-local" defaultValue={editing?.dateTime ? new Date(editing.dateTime).toISOString().slice(0, 16) : ''} required />
          <Select name="type" label="Tipo" options={typeOptions} defaultValue={editing?.type || 'manutencao'} />
          <Select name="status" label="Status" options={statusOptions.slice(1)} defaultValue={editing?.status || 'agendado'} />
          <Textarea name="notes" label="Observações" defaultValue={editing?.notes} />
        </form>
      </Modal>
    </PageShell>
  );
}
