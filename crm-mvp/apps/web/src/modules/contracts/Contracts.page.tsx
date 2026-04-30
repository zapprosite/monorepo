import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../utils/trpc';
import {
  PageShell, Sidebar, Header, DataTable, Button, Modal,
  Input, Select, StatusBadge, useToast,
} from '@crm-mvp/ui';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'suspenso', label: 'Suspenso' },
  { value: 'encerrado', label: 'Encerrado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const typeOptions = [
  { value: 'comercial', label: 'Comercial' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'residencial', label: 'Residencial' },
];

const freqOptions = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

export default function ContractsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: contracts, refetch } = trpc.contracts.list.useQuery({ status: filterStatus || undefined });
  const createMutation = trpc.contracts.create.useMutation({ onSuccess: () => { refetch(); setModalOpen(false); addToast('Contrato criado', 'success'); } });
  const updateMutation = trpc.contracts.update.useMutation({ onSuccess: () => { refetch(); setModalOpen(false); addToast('Contrato atualizado', 'success'); } });
  const deleteMutation = trpc.contracts.delete.useMutation({ onSuccess: () => { refetch(); addToast('Contrato removido', 'success'); } });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      clientId: form.get('clientId') as string,
      type: form.get('type') as any,
      value: Number(form.get('value')),
      frequency: form.get('frequency') as any,
      startDate: form.get('startDate') as string,
      endDate: form.get('endDate') as string,
      status: form.get('status') as any,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    { key: 'client', header: 'Cliente', render: (row: any) => row.client?.name || '-' },
    { key: 'type', header: 'Tipo', render: (row: any) => typeOptions.find(t => t.value === row.type)?.label || row.type },
    { key: 'value', header: 'Valor', render: (row: any) => `R$ ${Number(row.value).toLocaleString('pt-BR')}` },
    { key: 'frequency', header: 'Frequência', render: (row: any) => freqOptions.find(f => f.value === row.frequency)?.label || row.frequency },
    { key: 'endDate', header: 'Vencimento', render: (row: any) => new Date(row.endDate).toLocaleDateString('pt-BR') },
    { key: 'status', header: 'Status', render: (row: any) => <StatusBadge status={row.status} /> },
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
      header={<Header title="Contratos" subtitle="Gestão de contratos" actions={<Button leftIcon={<Plus size={16} />} onClick={() => { setEditing(null); setModalOpen(true); }}>Novo Contrato</Button>} />}
    >
      <div className="mb-6">
        <Select options={statusOptions} value={filterStatus} onChange={setFilterStatus} className="sm:w-48" />
      </div>
      <DataTable columns={columns} data={contracts || []} keyExtractor={(row) => row.id} />
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Contrato' : 'Novo Contrato'} footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" form="contract-form">{editing ? 'Salvar' : 'Criar'}</Button></>}>
        <form id="contract-form" onSubmit={handleSubmit} className="space-y-4">
          <Input name="clientId" label="ID do Cliente" defaultValue={editing?.clientId} required />
          <Select name="type" label="Tipo" options={typeOptions} defaultValue={editing?.type || 'comercial'} />
          <Input name="value" label="Valor" type="number" step="0.01" defaultValue={editing?.value} required />
          <Select name="frequency" label="Frequência" options={freqOptions} defaultValue={editing?.frequency || 'mensal'} />
          <Input name="startDate" label="Data Início" type="date" defaultValue={editing?.startDate} required />
          <Input name="endDate" label="Data Fim" type="date" defaultValue={editing?.endDate} required />
          <Select name="status" label="Status" options={statusOptions.slice(1)} defaultValue={editing?.status || 'rascunho'} />
        </form>
      </Modal>
    </PageShell>
  );
}
