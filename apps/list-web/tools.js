/**
 * Ferramentas do homelab - list.zappro.site
 * Categorias: ai, monitoring, infra, dev, security
 *
 * URLs internos vem de VITE_* env vars (Vite) ou window.__ENV__ (static deploy)
 * Em dev: crie .env com VITE_HERMES_GATEWAY_URL=http://10.0.2.4:4001 etc
 * Em prod: injete via --build-arg ou window.__ENV__
 */

const INTERNAL_URLS = {
  // AI — use public subdomains where available
  litellm:
    import.meta.env.VITE_LITELLM_URL || window.__ENV__?.LITELLM_URL || 'https://api.zappro.site',
  hermesGateway:
    import.meta.env.VITE_HERMES_GATEWAY_URL ||
    window.__ENV__?.HERMES_GATEWAY_URL ||
    'https://hermes.zappro.site',
  : import.meta.env.VITE_KOKORO_URL || window.__ENV__?.KOKORO_URL || 'https://hermes.zappro.site',
  ttsBridge:
    import.meta.env.VITE_TTS_BRIDGE_URL || window.__ENV__?.TTS_BRIDGE_URL || 'https://hermes.zappro.site',
  ollama: import.meta.env.VITE_OLLAMA_URL || window.__ENV__?.OLLAMA_URL || '', // No public URL
  // Monitoring — via Grafana dashboard
  prometheus:
    import.meta.env.VITE_PROMETHEUS_URL ||
    window.__ENV__?.PROMETHEUS_URL ||
    'https://monitor.zappro.site',
  loki: import.meta.env.VITE_LOKI_URL || window.__ENV__?.LOKI_URL || 'https://monitor.zappro.site',
  alertmanager:
    import.meta.env.VITE_ALERTMANAGER_URL ||
    window.__ENV__?.ALERTMANAGER_URL ||
    'https://monitor.zappro.site',
  nodeExporter:
    import.meta.env.VITE_NODE_EXPORTER_URL ||
    window.__ENV__?.NODE_EXPORTER_URL ||
    'https://monitor.zappro.site',
  cadvisor:
    import.meta.env.VITE_CADVISOR_URL || window.__ENV__?.CADVISOR_URL || 'https://monitor.zappro.site',
  // Infra
  : import.meta.env.VITE_N8N_URL || window.__ENV__?.N8N_URL || '', //  removed
  qdrant: import.meta.env.VITE_QDRANT_URL || window.__ENV__?.QDRANT_URL || 'https://qdrant.zappro.site',
};

export const tools = [
  // ========== AI ==========
  {
    id: 'chat',
    name: 'Hermes Gateway',
    description: 'Gateway de voz e LLM — STT + TTS + Chat via Telegram',
    url: 'https://hermes.zappro.site',
    category: 'ai',
    icon: '🤖',
    status: 'operational',
  },
  {
    id: 'litellm',
    name: 'LiteLLM Proxy',
    description: 'Proxy unificado para modelos Ollama locais (vision, embeddings)',
    url: INTERNAL_URLS.litellm,
    category: 'ai',
    icon: '🔗',
    status: 'operational',
  },
  {
    id: 'hermes',
    name: 'Hermes Gateway',
    description: 'Gateway unificado de voz e LLM — STT wav2vec2 + TTS Kokoro + MiniMax',
    url: INTERNAL_URLS.hermesGateway,
    category: 'ai',
    icon: '🎙️',
    status: 'operational',
  },
  {
    id: '',
    name: 'Kokoro TTS',
    description: 'Motor TTS para síntese de voz PT-BR (vozes pm_santa e pf_dora)',
    url: INTERNAL_URLS.,
    category: 'ai',
    icon: '🔊',
    status: 'operational',
  },
  {
    id: 'tts-bridge',
    name: 'TTS Bridge',
    description: 'Proxy滤 voz do Kokoro - única porta de acesso ao TTS',
    url: INTERNAL_URLS.ttsBridge,
    category: 'ai',
    icon: '🌉',
    status: 'operational',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Runtime para modelos LLM locais (Qwen3-VL-8B-Instruct, Gemma4-12b-it)',
    url: INTERNAL_URLS.ollama,
    category: 'ai',
    icon: '🦙',
    status: 'operational',
  },

  // ========== MONITORING ==========
  {
    id: 'monitor',
    name: 'Grafana',
    description: 'Dashboards de monitoramento e métricas',
    url: 'https://monitor.zappro.site',
    category: 'monitoring',
    icon: '📊',
    status: 'operational',
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    description: 'Coleta de métricas e time-series database',
    url: INTERNAL_URLS.prometheus,
    category: 'monitoring',
    icon: '📈',
    status: 'operational',
  },
  {
    id: 'loki',
    name: 'Loki',
    description: 'Agregador de logs otimizado para Kubernetes',
    url: INTERNAL_URLS.loki,
    category: 'monitoring',
    icon: '📋',
    status: 'operational',
  },
  {
    id: 'alertmanager',
    name: 'AlertManager',
    description: 'Gerenciamento de alertas e notificações',
    url: INTERNAL_URLS.alertmanager,
    category: 'monitoring',
    icon: '🚨',
    status: 'operational',
  },
  {
    id: 'node-exporter',
    name: 'Node Exporter',
    description: 'Métricas de hardware e sistema do host',
    url: INTERNAL_URLS.nodeExporter,
    category: 'monitoring',
    icon: '🖥️',
    status: 'operational',
  },
  {
    id: 'cadvisor',
    name: 'cAdvisor',
    description: 'Métricas de containers Docker',
    url: INTERNAL_URLS.cadvisor,
    category: 'monitoring',
    icon: '📦',
    status: 'operational',
  },

  // ========== INFRA ==========
  {
    id: 'coolify',
    name: 'Coolify',
    description: 'Plataforma PaaS para deploy e gerenciamento de aplicações',
    url: 'https://coolify.zappro.site',
    category: 'infra',
    icon: '☁️',
    status: 'operational',
  },
  {
    id: '',
    name: '',
    description: 'Automação low-code de workflows',
    url: INTERNAL_URLS.,
    category: 'infra',
    icon: '🔄',
    status: 'operational',
  },
  {
    id: 'qdrant',
    name: 'Qdrant',
    description: 'Vector database para RAG e embeddings',
    url: INTERNAL_URLS.qdrant,
    category: 'infra',
    icon: '🔢',
    status: 'operational',
  },

  // ========== DEV ==========
  {
    id: 'git',
    name: 'Gitea',
    description: 'Git self-hosted - repositórios e CI/CD',
    url: 'https://git.zappro.site',
    category: 'dev',
    icon: '🐙',
    status: 'operational',
  },
];

export const categories = {
  ai: { name: 'Inteligência Artificial', icon: '🤖' },
  monitoring: { name: 'Monitoramento', icon: '📊' },
  infra: { name: 'Infraestrutura', icon: '🖧' },
  dev: { name: 'Desenvolvimento', icon: '💻' },
  security: { name: 'Segurança', icon: '🔒' },
};

export default tools;
