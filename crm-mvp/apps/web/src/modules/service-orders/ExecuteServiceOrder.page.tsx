import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../../utils/trpc';
import {
  PageShell,
  Sidebar,
  Header,
  Button,
  Input,
  Textarea,
  useToast,
} from '@crm-mvp/ui';
import {
  Camera,
  CheckSquare,
  Square,
  PenTool,
  Trash2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader,
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface PhotoItem {
  id: string;
  data: string;
  caption: string;
  takenAt: string;
}

export default function ExecuteServiceOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: serviceOrder, refetch } = trpc.serviceOrders.getById.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const updateExecutionMutation = trpc.serviceOrders.updateExecution.useMutation({
    onError: () => {
      addToast('Erro ao salvar execução', 'error');
    },
  });

  const submitExecutionMutation = trpc.serviceOrders.submitExecution.useMutation({
    onSuccess: (data: any) => {
      setPdfUrl(data?.pdfUrl ?? null);
      addToast('Ordem de serviço concluída — PDF sendo gerado', 'success');
    },
    onError: () => {
      addToast('Erro ao concluir OS', 'error');
    },
  });

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [captionModalOpen, setCaptionModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [finalCost, setFinalCost] = useState('');
  const [finalNotes, setFinalNotes] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (serviceOrder) {
      setChecklist(serviceOrder.checklist ?? []);
      setPhotos(serviceOrder.photos ?? []);
      setSignature(serviceOrder.signature ?? null);
      setFinalCost(serviceOrder.cost?.toString() ?? '');
      setFinalNotes(serviceOrder.notes ?? '');
    }
  }, [serviceOrder]);

  const saveExecution = useCallback(
    (data: { checklist?: ChecklistItem[]; photos?: PhotoItem[]; signature?: string }) => {
      if (!id) return;
      updateExecutionMutation.mutate({
        id,
        checklist: data.checklist,
        photos: data.photos,
        signature: data.signature,
      });
    },
    [id, updateExecutionMutation]
  );

  const handleChecklistToggle = (itemId: string) => {
    const updated = checklist.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    setChecklist(updated);
    saveExecution({ checklist: updated });
  };

  const handleAddPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target?.result as string;
        const newPhoto: PhotoItem = {
          id: `photo-${Date.now()}`,
          data,
          caption: '',
          takenAt: new Date().toISOString(),
        };
        const updated = [...photos, newPhoto];
        setPhotos(updated);
        setPendingPhotoId(newPhoto.id);
        setCaptionModalOpen(true);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSaveCaption = () => {
    const updated = photos.map((p) =>
      p.id === pendingPhotoId ? { ...p, caption } : p
    );
    setPhotos(updated);
    saveExecution({ photos: updated });
    setCaptionModalOpen(false);
    setPendingPhotoId(null);
    setCaption('');
  };

  const handleRemovePhoto = (photoId: string) => {
    const updated = photos.filter((p) => p.id !== photoId);
    setPhotos(updated);
    saveExecution({ photos: updated });
  };

  const openSignatureModal = () => {
    setSignatureModalOpen(true);
    setTimeout(initCanvas, 50);
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (signature) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = signature;
    }
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    lastPos.current = pos;
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSignature(canvas.toDataURL('image/png'));
    saveExecution({ signature: canvas.toDataURL('image/png') });
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
    saveExecution({ signature: undefined });
  };

  const handleSubmit = () => {
    if (!id) return;
    const checkedCount = checklist.filter((i) => i.checked).length;
    if (checkedCount < checklist.length) {
      if (!confirm(`Apenas ${checkedCount}/${checklist.length} itens verificados. Deseja continuar?`)) {
        return;
      }
    }
    submitExecutionMutation.mutate({
      id,
      cost: finalCost ? Number(finalCost) : undefined,
      notes: finalNotes || undefined,
    });
  };

  const checkedCount = checklist.filter((i) => i.checked).length;
  const progress = checklist.length > 0 ? (checkedCount / checklist.length) * 100 : 0;

  const typeLabels: Record<string, string> = {
    instalacao: 'Instalação',
    manutencao: 'Manutenção',
    reparo: 'Reparo',
    visita_tecnica: 'Visita Técnica',
    emergencia: 'Emergência',
  };

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
          title="Executar OS"
          subtitle={serviceOrder ? `OS #${serviceOrder.title}` : 'Carregando...'}
          actions={
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft size={16} />}
              onClick={() => navigate('/service-orders')}
            >
              Voltar
            </Button>
          }
        />
      }
    >
      {!serviceOrder ? (
        <div className="flex items-center justify-center h-64">
          <Loader size={32} className="animate-spin text-accent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: checklist + photos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Checklist */}
            <div className="bg-bg-secondary rounded-card border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckSquare size={20} className="text-accent" />
                  <h2 className="text-lg font-semibold text-text-primary">Checklist de Execução</h2>
                </div>
                <span className="text-sm text-text-secondary">
                  {checkedCount}/{checklist.length} itens
                </span>
              </div>
              <div className="w-full h-2 bg-bg-tertiary rounded-full mb-4 overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="space-y-2">
                {checklist.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleChecklistToggle(item.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      item.checked
                        ? 'bg-accent/10 border-accent/30 text-text-primary'
                        : 'bg-bg-tertiary border-white/5 text-text-secondary hover:border-accent/30 hover:text-text-primary'
                    }`}
                  >
                    {item.checked ? (
                      <CheckSquare size={20} className="text-accent flex-shrink-0" />
                    ) : (
                      <Square size={20} className="flex-shrink-0" />
                    )}
                    <span className={item.checked ? 'line-through opacity-60' : ''}>
                      {item.label}
                    </span>
                    {item.checked && (
                      <CheckCircle size={16} className="text-accent ml-auto flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Photos */}
            <div className="bg-bg-secondary rounded-card border border-white/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Camera size={20} className="text-accent" />
                <h2 className="text-lg font-semibold text-text-primary">Fotos do Serviço</h2>
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.data}
                        alt={photo.caption || 'Foto do serviço'}
                        className="w-full h-32 object-cover rounded-lg border border-white/10"
                      />
                      {photo.caption && (
                        <p className="text-xs text-text-secondary mt-1 truncate">
                          {photo.caption}
                        </p>
                      )}
                      <button
                        onClick={() => handleRemovePhoto(photo.id)}
                        className="absolute top-1 right-1 p-1 bg-danger/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                leftIcon={<Camera size={16} />}
                onClick={handleAddPhoto}
              >
                Adicionar Foto
              </Button>
            </div>

            {/* Notes */}
            <div className="bg-bg-secondary rounded-card border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">
                Observações Finais
              </h2>
              <Textarea
                value={finalNotes}
                onChange={(e) => setFinalNotes(e.target.value)}
                onBlur={() => {
                  submitExecutionMutation.mutate({
                    id: id!,
                    notes: finalNotes || undefined,
                  });
                }}
                placeholder="Registre observações sobre o serviço realizado..."
                rows={4}
              />
            </div>
          </div>

          {/* Right column: info + signature + submit */}
          <div className="space-y-6">
            {/* OS Info */}
            <div className="bg-bg-secondary rounded-card border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Dados da OS</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-text-muted uppercase tracking-wide">Cliente</span>
                  <p className="text-text-primary font-medium">
                    {serviceOrder.client?.name ?? '—'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-text-muted uppercase tracking-wide">Equipamento</span>
                  <p className="text-text-primary font-medium">
                    {serviceOrder.equipamento?.name ?? '—'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-text-muted uppercase tracking-wide">Tipo</span>
                  <p className="text-text-primary">
                    {typeLabels[serviceOrder.type] ?? serviceOrder.type}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-text-muted uppercase tracking-wide">Técnico</span>
                  <p className="text-text-primary">
                    {serviceOrder.technician?.name ?? '—'}
                  </p>
                </div>
                {serviceOrder.executionStartedAt && (
                  <div>
                    <span className="text-xs text-text-muted uppercase tracking-wide">
                      Início da Execução
                    </span>
                    <p className="text-text-primary text-sm">
                      {new Date(serviceOrder.executionStartedAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Signature */}
            <div className="bg-bg-secondary rounded-card border border-white/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <PenTool size={20} className="text-accent" />
                <h2 className="text-lg font-semibold text-text-primary">Assinatura do Cliente</h2>
              </div>
              {signature ? (
                <div className="relative group">
                  <img
                    src={signature}
                    alt="Assinatura"
                    className="w-full border border-white/10 rounded-lg bg-white"
                  />
                  <button
                    onClick={openSignatureModal}
                    className="mt-2 w-full text-sm text-accent hover:underline"
                  >
                    Reescrever assinatura
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  leftIcon={<PenTool size={16} />}
                  onClick={openSignatureModal}
                  className="w-full"
                >
                  Assinar
                </Button>
              )}
            </div>

            {/* Final cost */}
            <div className="bg-bg-secondary rounded-card border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">
                Valor Final
              </h2>
              <Input
                label="Custo (R$)"
                type="number"
                step="0.01"
                min="0"
                value={finalCost}
                onChange={(e) => setFinalCost(e.target.value)}
                onBlur={() => {
                  submitExecutionMutation.mutate({
                    id: id!,
                    cost: finalCost ? Number(finalCost) : undefined,
                  });
                }}
                placeholder="0.00"
              />
            </div>

            {/* Submit */}
            <Button
              variant="primary"
              size="lg"
              leftIcon={<CheckCircle size={18} />}
              onClick={handleSubmit}
              isLoading={submitExecutionMutation.isPending}
              className="w-full"
            >
              Concluir OS
            </Button>

            {/* PDF Success — make-pdf skill result */}
            {pdfUrl && (
              <div className="mt-4 p-4 rounded-lg bg-accent/10 border border-accent/30">
                <p className="text-sm font-semibold text-accent mb-2">PDF Profissional Gerado</p>
                <p className="text-xs text-text-secondary mb-3">
                  O PDF da OS foi gerado com sucesso e está disponível para download.
                </p>
                <div className="flex flex-col gap-2">
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                  >
                    📄 Baixar PDF da OS
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/service-orders')}
                    className="text-xs"
                  >
                    Voltar para lista de OS
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Caption Modal */}
      {captionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-bg-secondary rounded-card border border-white/10 p-6 mx-4">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Legenda da Foto</h3>
            <Input
              label="Legenda (opcional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Ex: Equipamento antes da limpeza"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveCaption();
              }}
            />
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ghost" onClick={() => {
                setCaptionModalOpen(false);
                setCaption('');
              }}>
                Pular
              </Button>
              <Button onClick={handleSaveCaption}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {signatureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-bg-secondary rounded-card border border-white/10 p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PenTool size={20} className="text-accent" />
                <h3 className="text-lg font-semibold text-text-primary">Assinatura do Cliente</h3>
              </div>
              <button
                onClick={() => setSignatureModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5"
              >
                <XCircle size={20} />
              </button>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Assine no canvas abaixo usando o mouse ou touch.
            </p>
            <div className="border border-white/20 rounded-lg overflow-hidden mb-4">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full touch-none bg-white"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                leftIcon={<Trash2 size={16} />}
                onClick={clearSignature}
              >
                Limpar
              </Button>
              <Button
                onClick={() => setSignatureModalOpen(false)}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
