import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PageShell, Sidebar, Header, Card, CardHeader, CardTitle, CardContent,
  Input, Button, useToast,
} from '@crm-mvp/ui';
import { Save, Upload, Eye, Palette, Building2, Type, Mail } from 'lucide-react';

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

const defaultColors: BrandColors = {
  primary: '#0ea5e9',
  secondary: '#1e293b',
  accent: '#10b981',
  background: '#0f172a',
  text: '#f8fafc',
};

export default function VisualIdentityPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [colors, setColors] = useState<BrandColors>(defaultColors);
  const [brandName, setBrandName] = useState('CRM MVP');
  const [tagline, setTagline] = useState('Serviços Técnicos');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target?.result as string);
      addToast('Logo atualizado', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleColorChange = (key: keyof BrandColors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const config = { brandName, tagline, colors, logoPreview };
    localStorage.setItem('brand_config', JSON.stringify(config));
    addToast('Identidade visual salva com sucesso!', 'success');
  };

  const colorFields: { key: keyof BrandColors; label: string }[] = [
    { key: 'primary', label: 'Cor Primária' },
    { key: 'secondary', label: 'Cor Secundária' },
    { key: 'accent', label: 'Cor de Destaque' },
    { key: 'background', label: 'Cor de Fundo' },
    { key: 'text', label: 'Cor do Texto' },
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
          userEmail="dev@crm.local"
        />
      }
      header={
        <Header
          title="Identidade Visual"
          subtitle="Configurações de marca e aparência"
          actions={
            <Button leftIcon={<Save size={16} />} onClick={handleSave}>
              Salvar
            </Button>
          }
        />
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: form fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Brand Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 size={18} />
                Informações da Marca
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nome da Empresa / Marca"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Ex: CRM MVP"
                />
                <Input
                  label="Tagline / Slogan"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Ex: Serviços Técnicos"
                />
              </div>
            </CardContent>
          </Card>

          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload size={18} />
                Logo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Logo preview */}
                <div
                  className="w-32 h-32 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden bg-bg-tertiary shrink-0"
                  style={{ backgroundColor: colors.background }}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-4xl font-bold" style={{ color: colors.primary }}>
                      {brandName.charAt(0) || 'L'}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <p className="text-sm text-text-muted">
                    Envie o logo da empresa (PNG, JPG ou SVG, máx. 2MB)
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary hover:bg-white/5 cursor-pointer transition-colors">
                    <Upload size={16} />
                    Escolher arquivo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {logoPreview && (
                    <button
                      onClick={() => setLogoPreview(null)}
                      className="block text-sm text-danger hover:text-danger/80 transition-colors"
                    >
                      Remover logo
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette size={18} />
                Paleta de Cores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {colorFields.map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <label className="block text-sm text-text-secondary">{label}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={colors[key]}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                        style={{ padding: 0 }}
                      />
                      <Input
                        value={colors[key]}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="flex-1 font-mono text-sm"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Color swatches */}
              <div className="mt-6">
                <p className="text-sm text-text-muted mb-3">Prévia da paleta</p>
                <div className="flex gap-2">
                  {colorFields.map(({ key, label }) => (
                    <div key={key} className="flex-1 text-center">
                      <div
                        className="h-12 rounded-lg mb-1 border border-white/10"
                        style={{ backgroundColor: colors[key] }}
                      />
                      <p className="text-xs text-text-muted truncate" title={label}>
                        {label.split(' ')[0]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Typography */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type size={18} />
                Tipografia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-muted mb-4">
                A tipografia é herdada do tema do sistema. Fontes disponíveis:
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Títulos</p>
                    <p className="text-xs text-text-muted">Inter Bold / 2xl</p>
                  </div>
                  <span className="text-xl font-bold text-text-primary">Aa</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Corpo</p>
                    <p className="text-xs text-text-muted">Inter Regular / base</p>
                  </div>
                  <span className="text-base text-text-primary">Aa Bb Cc</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                  <div>
                    <p className="text-sm text-text-secondary">Labels / UI</p>
                    <p className="text-xs text-text-muted">Inter Medium / sm</p>
                  </div>
                  <span className="text-sm text-text-secondary">Aa Bb</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: previews */}
        <div className="space-y-6">
          {/* Brand Preview Card */}
          <Card padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Eye size={16} />
                Prévia da Marca
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-xl p-5 border border-white/10 space-y-3"
                style={{ backgroundColor: colors.background }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden"
                    style={{ backgroundColor: colors.primary }}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      brandName.charAt(0) || 'L'
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: colors.text }}>
                      {brandName}
                    </p>
                    <p className="text-xs" style={{ color: colors.text, opacity: 0.6 }}>
                      {tagline}
                    </p>
                  </div>
                </div>
                <div
                  className="h-px w-full"
                  style={{ backgroundColor: colors.text, opacity: 0.1 }}
                />
                <div className="space-y-2">
                  <div className="h-2 rounded-full w-full" style={{ backgroundColor: colors.primary, opacity: 0.2 }} />
                  <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: colors.secondary, opacity: 0.3 }} />
                  <div className="h-2 rounded-full w-1/2" style={{ backgroundColor: colors.accent, opacity: 0.2 }} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: colors.primary }}
                  >
                    Primária
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                    style={{ borderColor: colors.accent, color: colors.accent }}
                  >
                    Secundário
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Signature Preview */}
          <Card padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Mail size={16} />
                Assinatura de E-mail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-lg p-4 border border-white/10"
                style={{ backgroundColor: colors.background }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden"
                    style={{ backgroundColor: colors.primary }}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain rounded-full" />
                    ) : (
                      brandName.charAt(0) || 'L'
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: colors.text }}>
                      {brandName}
                    </p>
                    <p className="text-xs" style={{ color: colors.text, opacity: 0.6 }}>
                      Equipe {brandName}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs" style={{ color: colors.text, opacity: 0.5 }}>
                        ✉️ contato@{brandName.toLowerCase().replace(/\s+/g, '')}.com.br
                      </p>
                      <p className="text-xs" style={{ color: colors.text, opacity: 0.5 }}>
                        📞 (11) 99999-9999
                      </p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: colors.primary }} />
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: colors.secondary }} />
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: colors.accent }} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Color Accessibility Check */}
          <Card padding="md">
            <CardHeader>
              <CardTitle className="text-sm">Verificação de Contraste</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { bg: colors.primary, fg: colors.text, label: 'Primária × Texto' },
                  { bg: colors.secondary, fg: colors.text, label: 'Secundária × Texto' },
                  { bg: colors.accent, fg: colors.background, label: 'Destaque × Fundo' },
                  { bg: colors.background, fg: colors.text, label: 'Fundo × Texto' },
                ].map(({ bg, fg, label }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">{label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded border border-white/10" style={{ backgroundColor: bg }} />
                      <div className="w-4 h-4 rounded border border-white/10" style={{ backgroundColor: fg }} />
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: bg, color: fg }}
                      >
                        Aa
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
