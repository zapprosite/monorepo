# SPEC HVAC/R CRM v2 — PMOC + RG + OS-PDF (Enxuto)
**Last reviewed:** 2026-05-02
**Owner:** SRE/homelab
**Código:** SPEC-HVACR-V2-001  
**Status:** Draft → Pronto para implementação  
**Data:** 2026-05-01  

---

## 1. Escopo (Mínimo Viável que Vence)

NÃO é para fazer tudo. É para fazer **5 coisas muito bem**:

1. **PMOC Simples** — checklist digital + relatório PDF automático
2. **RG do Aparelho** — cada equipamento ganha link único `https://[hash].zappro.site/equip/[id]`
3. **OS com PDF Profissional** — skill `make-pdf` + identidade visual + template responsivo
4. **Login Google OAuth** — admin loga com Google, não precisa de senha
5. **Cadastro de Colaboradores** — admin cria usuários normais (email/senha simples), sem OAuth por pessoa

---

## 2. PMOC Simples

### O que é
Manutenção Preventiva com checklist que gera PDF assinado.

### Checklist (campos fixos)
| Item | Tipo | Obrigatório |
|------|------|-------------|
| Temperatura ambiente | number (°C) | sim |
| Temperatura insuflada | number (°C) | sim |
| Pressão sucção | number (PSI) | sim |
| Pressão descarga | number (PSI) | sim |
| Amperagem compressor | number (A) | sim |
| Nível gás refrigerante | select (normal/baixo/vazio) | sim |
| Estado filtros | select (limpo/sujo/trocado) | sim |
| Limpeza serpentina | checkbox | sim |
| Funcionamento dreno | checkbox | sim |
| Vazamentos | select (nenhum/pequeno/grave) | sim |
| Fotos | upload (mín 3: antes/durante/depois) | sim |
| Observações | textarea | não |

### Fluxo
1. Técnico abre OS tipo "PMOC"
2. Preenche checklist no celular (offline funciona)
3. Tira fotos
4. Cliente assina digitalmente na tela
5. Sistema gera PDF com:
   - Logo e dados da empresa (identidade visual)
   - Dados do equipamento
   - Checklist preenchido
   - Fotos em grid responsivo
   - Assinaturas
   - QR Code com link do RG do aparelho
6. PDF salvo + enviado por email/WhatsApp

### Frequência
- Configurável por equipamento (padrão: 6 meses)
- Alerta 7 dias antes do vencimento

---

## 3. RG do Aparelho (Registro Digital)

### Conceito
Cada equipamento cadastrado ganha uma página pública acessível por subdomínio único.

### URL
```
https://a3k9m2p1.zappro.site/equip/abc-123
```
- `a3k9m2p1` = hash aleatório de 8 chars (gerado no cadastro)
- `abc-123` = ID interno do equipamento

### Como funciona o DNS
1. Wildcard no Cloudflare: `*.zappro.site → tunnel`
2. App recebe `Host: a3k9m2p1.zappro.site`
3. Busca equipamento pelo hash → renderiza página

### Conteúdo da página pública
- **Cabeçalho:** Logo da empresa, nome do cliente, endereço
- **Ficha técnica:** Modelo, BTU, gás, data instalação
- **Timeline:** Lista de manutenções (data, tipo, técnico)
- **Status PMOC:** Badge "Em dia" (verde) ou "Vencido" (vermelho)
- **Próxima manutenção:** Data + contagem regressiva
- **QR Code:** Para acesso rápido no celular
- **Botão:** "Solicitar orçamento" → redireciona WhatsApp

### Segurança
- Link é "secreto por obscuridade" (hash aleatório)
- Não precisa login para visualizar
- Apenas dados não-sensíveis (sem valores, sem CPF)

---

## 4. OS com PDF (Skill make-pdf)

### Identidade Visual
Cada empresa configura UMA vez:
- Logo (PNG/SVG, max 200KB)
- Nome fantasia
- CNPJ
- Telefone
- Endereço
- Cor primária (hex)
- Cor secundária (hex)
- Assinatura digitalizada do responsável (PNG base64)

### Template PDF (HTML → Puppeteer)
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Inter', sans-serif; color: #333; }
    .header { background: {{cor_primaria}}; color: white; padding: 20px; }
    .logo { max-height: 60px; }
    .section { margin: 15px 0; }
    .grid-fotos { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .grid-fotos img { width: 100%; border-radius: 4px; }
    .assinaturas { display: flex; justify-content: space-between; margin-top: 40px; }
    .assinatura-box { width: 45%; border-top: 1px solid #333; padding-top: 5px; text-align: center; }
    .qrcode { position: absolute; bottom: 15mm; right: 15mm; width: 80px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <img src="{{logo}}" class="logo">
    <h1>ORDEM DE SERVIÇO #{{os_numero}}</h1>
    <p>{{empresa_nome}} — CNPJ: {{empresa_cnpj}}</p>
  </div>
  
  <div class="section">
    <h3>Cliente</h3>
    <p>{{cliente_nome}} — {{cliente_endereco}}</p>
  </div>
  
  <div class="section">
    <h3>Equipamento</h3>
    <p>{{equipamento_modelo}} — {{equipamento_btu}} BTU — Série: {{equipamento_serie}}</p>
  </div>
  
  <div class="section">
    <h3>Serviço Realizado</h3>
    <p>{{descricao_servico}}</p>
  </div>
  
  <div class="section">
    <h3>Checklist PMOC</h3>
    <table>{{checklist_itens}}</table>
  </div>
  
  <div class="section">
    <h3>Fotos</h3>
    <div class="grid-fotos">{{fotos}}</div>
  </div>
  
  <div class="assinaturas">
    <div class="assinatura-box">
      <img src="{{assinatura_tecnico}}" style="max-height: 60px;">
      <p>{{tecnico_nome}}<br>Técnico</p>
    </div>
    <div class="assinatura-box">
      <img src="{{assinatura_cliente}}" style="max-height: 60px;">
      <p>{{cliente_nome_assinatura}}<br>Cliente</p>
    </div>
  </div>
  
  <img src="{{qrcode_url}}" class="qrcode">
  <p style="font-size: 10px; color: #666;">Acesse o histórico do equipamento: {{rg_url}}</p>
</body>
</html>
```

### Geração do PDF
1. Técnico conclui OS
2. Backend monta objeto com todos os dados
3. Chama skill `make-pdf` passando HTML template + dados
4. Skill usa Puppeteer para renderizar e salvar PDF em `/data/os/2026/05/os-001.pdf`
5. Retorna URL pública do PDF
6. Sistema envia link por email/WhatsApp

### Responsivo
- Template se adapta a A4 (impressão) e visualização mobile
- Fotos redimensionadas proporcionalmente
- Fontes escaláveis (usa `rem` e `@media print`)

---

## 5. Login (Google OAuth para Admin + Local para Colaboradores)

### Admin (dono da empresa)
- Loga com Google OAuth (`zappro.ia@gmail.com`)
- Não precisa de senha
- Acesso total: dashboard, configurações, relatórios

### Colaboradores (técnicos, recepcionistas)
- Admin cadastra manualmente na tela "Equipe"
- Campos: nome, email (qualquer um), senha (mínimo 1 caractere), função
- Login com email/senha local
- NÃO precisa de OAuth, NÃO precisa de Client ID do Google
- NÃO precisa pedir para cada colaborador configurar nada no Google Cloud

### Fluxo de cadastro de colaborador
1. Admin logado → vai em "Equipe"
2. Clica "Novo Colaborador"
3. Preenche: Nome, Email (qualquer), Senha (livre), Função
4. Sistema cria usuário no banco
5. Colaborador recebe email com link de acesso (opcional)
6. Colaborador loga em `/auth/login` com email/senha

### Permissões por função
| Função | Acessos |
|--------|---------|
| admin | Tudo |
| manager | OS, clientes, equipamentos, relatórios (não configurações) |
| technician | Criar/editar OS, ver equipamentos atribuídos |
| user | Ver apenas (read-only) |

---

## 6. Entidades (Simplificado)

### Company (Identidade Visual)
```typescript
interface Company {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  address: string;
  logoUrl?: string;
  primaryColor: string; // #39FF14
  secondaryColor: string; // #0A0A0F
  ownerId: string; // admin Google user
}
```

### Equipment
```typescript
interface Equipment {
  id: string;
  clientId: string;
  teamId: string;
  brand: string;
  model: string;
  btuHour: number;
  refrigerantGas: string;
  serialNumber: string;
  installationDate: Date;
  location: string;
  subdomain: string; // hash aleatório
  pmocFrequencyMonths: number; // padrão 6
  pmocDueDate: Date;
  status: 'ativo' | 'inativo';
  photos: string[];
}
```

### ServiceOrder
```typescript
interface ServiceOrder {
  id: string;
  number: string; // OS-2026-0001
  type: 'pmoc' | 'corretiva' | 'instalacao';
  status: 'aberta' | 'em-andamento' | 'concluida';
  clientId: string;
  equipmentId: string;
  technicianId: string;
  checklist: { item: string; value: string; unit?: string }[];
  photos: string[];
  description: string;
  clientSignature?: string; // base64 PNG
  technicianSignature?: string;
  pdfUrl?: string;
  completedAt?: Date;
}
```

### User
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'technician' | 'user';
  authType: 'google' | 'local'; // admin = google, resto = local
  password?: string; // apenas para local
  teamId: string;
}
```

---

## 7. Telas (Mínimas)

### 1. Login
- Botão "Entrar com Google" (apenas para admin)
- Formulário email/senha (para colaboradores)
- Link "Esqueci senha"

### 2. Dashboard
- Cards: OS hoje, PMOCs vencendo, Equipamentos ativos
- Gráfico simples: OS por mês
- Lista de próximos PMOCs (7 dias)

### 3. Equipamentos
- Tabela com: cliente, modelo, local, status PMOC, ações
- Botão "Novo Equipamento"
- Ação "Ver RG" → abre subdomínio em nova aba
- Ação "Nova OS" → abre modal

### 4. OS (Ordens de Serviço)
- Tabela com: número, cliente, tipo, status, técnico, data
- Botão "Nova OS"
- Filtros: tipo, status, técnico, data

### 5. Nova OS / Executar OS
- Passo 1: Seleciona equipamento (autocomplete)
- Passo 2: Preenche checklist (form dinâmico)
- Passo 3: Tira fotos (upload)
- Passo 4: Descrição do serviço (textarea)
- Passo 5: Assinatura do cliente (canvas touch)
- Passo 6: Concluir → gera PDF → mostra link

### 6. Configurações > Identidade Visual
- Upload logo
- Campos: nome, CNPJ, telefone, endereço
- Color pickers: cor primária, cor secundária
- Preview ao vivo do PDF
- Botão "Salvar"

### 7. Equipe
- Tabela: nome, email, função, ações
- Botão "Novo Colaborador"
- Modal: nome, email, senha, função
- Ação "Editar" / "Remover"

---

## 8. API Endpoints (tRPC)

```typescript
// Auth
auth.me                    → { user }
auth.logout                → void
auth.google                → redirect
auth.googleCallback        → { token }
auth.loginLocal            → { token, user }  // POST email/password

// Equipment
equipment.list             → Equipment[]
equipment.create           → Equipment
equipment.getById          → Equipment
equipment.update           → Equipment
equipment.delete           → void
equipment.getBySubdomain   → Equipment  // para página pública RG

// Service Order
os.list                    → ServiceOrder[]
os.create                  → ServiceOrder
os.getById                 → ServiceOrder
os.update                  → ServiceOrder
os.complete                → { pdfUrl }  // gera PDF
os.delete                  → void

// Company (Identidade Visual)
company.get                → Company
company.update             → Company

// Users
currentUser.get            → User
users.list                 → User[]
users.create               → User  // admin cria colaborador local
users.update               → User
users.delete               → void
```

---

## 9. Tecnologia (Mínima)

### Backend
- NestJS + tRPC (já temos)
- PostgreSQL (já temos)
- JWT (já temos)
- Puppeteer para PDF (skill make-pdf)
- Upload de fotos: salvar em disco `/data/uploads/`

### Frontend
- React 19 + Vite (já temos)
- Tailwind CSS (já temos)
- Componentes UI: DataTable, Modal, Input, Button, Badge, Toast
- react-signature-canvas (para assinatura touch)
- qrcode.react (para QR no PDF)

### Infra
- Docker (já temos)
- Cloudflare Tunnel (já temos)
- Wildcard DNS: `*.zappro.site` (configurar uma vez)

---

## 10. Implementação (Ordem)

1. [ ] **Configurar wildcard DNS** no Cloudflare: `*.zappro.site → tunnel`
2. [ ] **Criar entidade Equipment** + migration + tRPC router
3. [ ] **Criar tela Equipamentos** + cadastro + listagem
4. [ ] **Gerar subdomain aleatório** no cadastro do equipamento
5. [ ] **Criar endpoint público** `GET /equip/:id` que renderiza HTML do RG
6. [ ] **Criar entidade ServiceOrder** + migration + tRPC router
7. [ ] **Criar tela OS** + cadastro + listagem
8. [ ] **Criar tela Executar OS** com checklist + fotos + assinatura
9. [ ] **Integrar make-pdf skill** na conclusão da OS
10. [ ] **Criar tela Identidade Visual** (Configurações)
11. [ ] **Criar tela Equipe** com cadastro local (sem OAuth)
12. [ ] **Testar fluxo completo**: Equipamento → OS → PDF → RG

---

## 11. Critério de Pronto

- [ ] Admin loga com Google OAuth
- [ ] Admin cadastra colaborador com email/senha simples
- [ ] Colaborador loga com email/senha
- [ ] Cadastro de equipamento gera subdomain aleatório
- [ ] Página pública do RG mostra dados do equipamento
- [ ] Criação de OS com checklist PMOC
- [ ] Upload de fotos na OS
- [ ] Assinatura digital do cliente
- [ ] Geração de PDF com identidade visual
- [ ] PDF responsivo (visualiza bem no celular)
- [ ] QR Code no PDF apontando para RG

---

> **Regra de ouro:** Se não está nesta lista, NÃO FAÇA. Não precisa de IA diagnóstico, não precisa de rota inteligente, não precisa de WhatsApp bot, não precisa de IoT. Faça PMOC + RG + OS-PDF funcionar perfeitamente primeiro.
