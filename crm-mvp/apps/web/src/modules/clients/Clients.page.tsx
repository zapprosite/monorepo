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
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
];

const typeOptions = [
  { value: 'pf', label: 'Pessoa Física' },
  { value: 'pj', label: 'Pessoa Jurídica' },
];

export default function ClientsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: clients, refetch } = trpc.clients.list.useQuery({ status: filterStatus || undefined, search: search || undefined });
  const createMutation = trpc.clients.create.useMutation({ onSuccess: () => { refetch(); setModalOpen(false); addToast('Cliente criado', 'success'); } });
  const updateMutation = trpc.clients.update.useMutation({ onSuccess: () => { refetch(); setModalOpen(false); addToast('Cliente atualizado', 'success'); } });
  const deleteMutation = trpc.clients.delete.useMutation({ onSuccess: () => { refetch(); addToast('Cliente removido', 'success'); } });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get('name') as string,
      type: form.get('type') as any,
      document: form.get('document') as string,
      email: form.get('email') as string,
      phone: form.get('phone') as string,
      address: form.get('address') as string,
      tags: (form.get('tags') as string)?.split(',').map(t => t.trim()).filter(Boolean),
      status: form.get('status') as any,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    { key: 'name', header: 'Nome', sortable: true },
    { key: 'type', header: 'Tipo', render: (row: any) => row.type === 'pf' ? 'PF' : 'PJ' },
    { key: 'document', header: 'Documento', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'phone', header: 'Telefone', sortable: true },
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
      header={<Header title="Clientes" subtitle="Base de clientes" actions={<Button leftIcon={<Plus size={16} />} onClick={() => { setEditing(null); setModalOpen(true); }}>Novo Cliente</Button>} />}
    >
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" />
        <Select options={statusOptions} value={filterStatus} onChange={setFilterStatus} className="sm:w-48" />
      </div>
      <DataTable columns={columns} data={clients || []} keyExtractor={(row) => row.id} />
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Cliente' : 'Novo Cliente'} footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" form="client-form">{editing ? 'Salvar' : 'Criar'}</Button></>}>
        <form id="client-form" onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Nome" defaultValue={editing?.name} required />
          <Select name="type" label="Tipo" options={typeOptions} defaultValue={editing?.type || 'pf'} />
          <Input name="document" label="CPF/CNPJ" defaultValue={editing?.document} />
          <Input name="email" label="Email" type="email" defaultValue={editing?.email} />
          <Input name="phone" label="Telefone" defaultValue={editing?.phone} />
          <Textarea name="address" label="Endereço" defaultValue={editing?.address} />
          <Input name="tags" label="Tags (separadas por vírgula)" defaultValue={editing?.tags?.join(', ')} />
          <Select name="status" label="Status" options={statusOptions.slice(1)} defaultValue={editing?.status || 'ativo'} />
        </form>
      </Modal>
    </PageShell>
  );
}
