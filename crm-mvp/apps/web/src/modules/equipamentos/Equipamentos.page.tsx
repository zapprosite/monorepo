import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../utils/trpc';
import {
  PageShell, Sidebar, Header, DataTable, Button, Modal,
  Input, Select, Textarea, StatusBadge, useToast,
} from '@crm-mvp/ui';
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react';

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'em_manutencao', label: 'Em Manutenção' },
  { value: 'inativo', label: 'Inativo' },
];

const typeOptions = [
  { value: '', label: 'Todos' },
  { value: 'ar_condicionado', label: 'Ar Condicionado' },
  { value: 'refrigerador', label: 'Refrigerador' },
  { value: 'freezer', label: 'Freezer' },
  { value: ' split', label: 'Split' },
  { value: 'janela', label: 'Janela' },
  { value: 'de_chao', label: 'De Chão' },
  { value: 'portatil', label: 'Portátil' },
  { value: 'outro', label: 'Outro' },
];

const typeFormOptions = [
  { value: 'ar_condicionado', label: 'Ar Condicionado' },
  { value: 'refrigerador', label: 'Refrigerador' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'split', label: 'Split' },
  { value: 'janela', label: 'Janela' },
  { value: 'de_chao', label: 'De Chão' },
  { value: 'portatil', label: 'Portátil' },
  { value: 'outro', label: 'Outro' },
];

const statusFormOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'em_manutencao', label: 'Em Manutenção' },
  { value: 'inativo', label: 'Inativo' },
];

const typeLabels: Record<string, string> = {
  ar_condicionado: 'Ar Condicionado',
  refrigerador: 'Refrigerador',
  freezer: 'Freezer',
  split: 'Split',
  janela: 'Janela',
  de_chao: 'De Chão',
  portatil: 'Portátil',
  outro: 'Outro',
};

export default function EquipamentosPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: equipamentos, refetch } = trpc.equipamentos.list.useQuery({
    status: filterStatus || undefined,
    type: filterType || undefined,
    search: search || undefined,
  });
  const createMutation = trpc.equipamentos.create.useMutation({
    onSuccess: (data: any) => {
      refetch();
      setModalOpen(false);
      const subdomain = data?.subdomain ? ` (${data.subdomain})` : '';
      addToast(`Equipamento criado${subdomain}`, 'success');
    },
  });
  const updateMutation = trpc.equipamentos.update.useMutation({
    onSuccess: () => { refetch(); setModalOpen(false); addToast('Equipamento atualizado', 'success'); },
  });
  const deleteMutation = trpc.equipamentos.delete.useMutation({
    onSuccess: () => { refetch(); addToast('Equipamento removido', 'success'); },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get('name') as string,
      serialNumber: form.get('serialNumber') as string,
      type: form.get('type') as string,
      brand: form.get('brand') as string,
      model: form.get('model') as string,
      status: form.get('status') as string,
      installationDate: form.get('installationDate') as string,
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
    { key: 'subdomain', header: 'Subdomain', render: (row: any) => (
      <span className="font-mono text-sm text-accent">{row.subdomain}</span>
    )},
    { key: 'serialNumber', header: 'Nº Série', sortable: true },
    { key: 'type', header: 'Tipo', render: (row: any) => typeLabels[row.type] ?? row.type },
    { key: 'brand', header: 'Marca', sortable: true },
    { key: 'model', header: 'Modelo', sortable: true },
    { key: 'status', header: 'Status', render: (row: any) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: 'Ações',
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditing(row); setModalOpen(true); }}
            className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => deleteMutation.mutate({ id: row.id })}
            className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      sidebar={<Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onLogout={() => { sessionStorage.removeItem('dev_user'); navigate('/auth/login'); }} userName="Dev User" />}
      header={<Header title="Equipamentos" subtitle="Gestão de equipamentos" actions={<Button leftIcon={<Plus size={16} />} onClick={() => { setEditing(null); setModalOpen(true); }}>Novo Equipamento</Button>} />}
    >
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder="Buscar por nome, série..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-64"
        />
        <Select options={statusOptions} value={filterStatus} onChange={setFilterStatus} className="sm:w-48" />
        <Select options={typeOptions} value={filterType} onChange={setFilterType} className="sm:w-48" />
      </div>

      <DataTable columns={columns} data={equipamentos || []} keyExtractor={(row) => row.id} />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Equipamento' : 'Novo Equipamento'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" form="equipamento-form">{editing ? 'Salvar' : 'Criar'}</Button>
          </>
        }
      >
        <form id="equipamento-form" onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Nome do Equipamento" defaultValue={editing?.name} required />
          <div className="grid grid-cols-2 gap-4">
            <Input name="serialNumber" label="Número de Série" defaultValue={editing?.serialNumber} />
            <Select name="type" label="Tipo" options={typeFormOptions} defaultValue={editing?.type || 'ar_condicionado'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input name="brand" label="Marca" defaultValue={editing?.brand} />
            <Input name="model" label="Modelo" defaultValue={editing?.model} />
          </div>
          <Input name="installationDate" label="Data de Instalação" type="date" defaultValue={editing?.installationDate} />
          <Select name="status" label="Status" options={statusFormOptions} defaultValue={editing?.status || 'ativo'} />
          <Textarea name="notes" label="Observações" defaultValue={editing?.notes} rows={3} />
        </form>
      </Modal>
    </PageShell>
  );
}
