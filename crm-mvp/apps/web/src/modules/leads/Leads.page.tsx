import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../utils/trpc';
import {
  PageShell, Sidebar, Header, DataTable, Button, Modal,
  Input, Select, Textarea, StatusBadge, useToast,
} from '@crm-mvp/ui';
import { Plus, Pencil, Trash2, UserCircle } from 'lucide-react';

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'novo', label: 'Novo' },
  { value: 'contato', label: 'Contato' },
  { value: 'qualificado', label: 'Qualificado' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'ganho', label: 'Ganho' },
  { value: 'perdido', label: 'Perdido' },
];

export default function LeadsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: leads, refetch } = trpc.leads.list.useQuery({ status: filterStatus || undefined, search: search || undefined });
  const createMutation = trpc.leads.create.useMutation({ onSuccess: () => { refetch(); setModalOpen(false); addToast('Lead criado com sucesso', 'success'); } });
  const updateMutation = trpc.leads.update.useMutation({ onSuccess: () => { refetch(); setModalOpen(false); addToast('Lead atualizado', 'success'); } });
  const deleteMutation = trpc.leads.delete.useMutation({ onSuccess: () => { refetch(); addToast('Lead removido', 'success'); } });
  const convertMutation = trpc.leads.convertToClient.useMutation({ onSuccess: () => { refetch(); addToast('Lead convertido em cliente!', 'success'); } });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get('name') as string,
      email: form.get('email') as string,
      phone: form.get('phone') as string,
      source: form.get('source') as string,
      status: form.get('status') as any,
      estimatedValue: Number(form.get('estimatedValue')) || undefined,
      notes: form.get('notes') as string,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    { key: 'name', header: 'Nome', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'phone', header: 'Telefone', sortable: true },
    { key: 'source', header: 'Origem', sortable: true },
    { key: 'status', header: 'Status', render: (row: any) => <StatusBadge status={row.status} /> },
    { key: 'estimatedValue', header: 'Valor', render: (row: any) => row.estimatedValue ? `R$ ${Number(row.estimatedValue).toLocaleString('pt-BR')}` : '-' },
    {
      key: 'actions',
      header: 'Ações',
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditing(row); setModalOpen(true); }} className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors">
            <Pencil size={16} />
          </button>
          {row.status !== 'ganho' && (
            <button onClick={() => convertMutation.mutate({ id: row.id })} className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors" title="Converter em cliente">
              <UserCircle size={16} />
            </button>
          )}
          <button onClick={() => deleteMutation.mutate({ id: row.id })} className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      sidebar={<Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onLogout={() => { sessionStorage.removeItem('dev_user'); navigate('/auth/login'); }} userName="Dev User" />}
      header={
        <Header
          title="Leads"
          subtitle="Pipeline comercial"
          actions={<Button leftIcon={<Plus size={16} />} onClick={() => { setEditing(null); setModalOpen(true); }}>Novo Lead</Button>}
        />
      }
    >
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" />
        <Select options={statusOptions} value={filterStatus} onChange={setFilterStatus} className="sm:w-48" />
      </div>

      <DataTable columns={columns} data={leads || []} keyExtractor={(row) => row.id} />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Lead' : 'Novo Lead'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" form="lead-form">{editing ? 'Salvar' : 'Criar'}</Button>
          </>
        }
      >
        <form id="lead-form" onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Nome" defaultValue={editing?.name} required />
          <Input name="email" label="Email" type="email" defaultValue={editing?.email} />
          <Input name="phone" label="Telefone" defaultValue={editing?.phone} />
          <Input name="source" label="Origem" defaultValue={editing?.source} />
          <Select name="status" label="Status" options={statusOptions.slice(1)} defaultValue={editing?.status || 'novo'} />
          <Input name="estimatedValue" label="Valor Estimado" type="number" defaultValue={editing?.estimatedValue} />
          <Textarea name="notes" label="Observações" defaultValue={editing?.notes} />
        </form>
      </Modal>
    </PageShell>
  );
}


