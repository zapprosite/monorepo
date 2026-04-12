/**
 * Ferramentas do homelab - list.zappro.site
 * Categorias: ai, monitoring, infra, dev, security
 */

export const tools = [
  // ========== AI ==========
  {
    id: 'chat',
    name: 'OpenWebUI',
    description: 'Interface web para chat com LLMs locais e remotos',
    url: 'https://chat.zappro.site',
    category: 'ai',
    icon: '🤖',
    status: 'operational'
  },
  {
    id: 'litellm',
    name: 'LiteLLM Proxy',
    description: 'Proxy unificado para modelos Ollama locais (vision, embeddings)',
    url: 'http://10.0.19.7:4000',
    category: 'ai',
    icon: '🔗',
    status: 'operational'
  },
  {
    id: 'openclaw',
    name: 'OpenClaw Bot',
    description: 'Bot de voz PT-BR com STT wav2vec2 + TTS Kokoro + LLM MiniMax',
    url: 'http://10.0.2.4:4001',
    category: 'ai',
    icon: '🎙️',
    status: 'operational'
  },
  {
    id: 'kokoro',
    name: 'Kokoro TTS',
    description: 'Motor TTS para síntese de voz PT-BR (vozes pm_santa e pf_dora)',
    url: 'http://10.0.19.7:8880',
    category: 'ai',
    icon: '🔊',
    status: 'operational'
  },
  {
    id: 'tts-bridge',
    name: 'TTS Bridge',
    description: 'Proxy滤 voz do Kokoro - única porta de acesso ao TTS',
    url: 'http://10.0.2.4:8013',
    category: 'ai',
    icon: '🌉',
    status: 'operational'
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Runtime para modelos LLM locais (qwen2.5-vl, llama3.3)',
    url: 'http://10.0.5.1:11434',
    category: 'ai',
    icon: '🦙',
    status: 'operational'
  },

  // ========== MONITORING ==========
  {
    id: 'monitor',
    name: 'Grafana',
    description: 'Dashboards de monitoramento e métricas',
    url: 'https://monitor.zappro.site',
    category: 'monitoring',
    icon: '📊',
    status: 'operational'
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    description: 'Coleta de métricas e time-series database',
    url: 'http://10.0.19.7:9090',
    category: 'monitoring',
    icon: '📈',
    status: 'operational'
  },
  {
    id: 'loki',
    name: 'Loki',
    description: 'Agregador de logs otimizado para Kubernetes',
    url: 'http://10.0.19.7:3100',
    category: 'monitoring',
    icon: '📋',
    status: 'operational'
  },
  {
    id: 'alertmanager',
    name: 'AlertManager',
    description: 'Gerenciamento de alertas e notificações',
    url: 'http://10.0.19.7:9093',
    category: 'monitoring',
    icon: '🚨',
    status: 'operational'
  },
  {
    id: 'node-exporter',
    name: 'Node Exporter',
    description: 'Métricas de hardware e sistema do host',
    url: 'http://10.0.19.7:9100',
    category: 'monitoring',
    icon: '🖥️',
    status: 'operational'
  },
  {
    id: 'cadvisor',
    name: 'cAdvisor',
    description: 'Métricas de containers Docker',
    url: 'http://10.0.19.7:8080',
    category: 'monitoring',
    icon: '📦',
    status: 'operational'
  },

  // ========== INFRA ==========
  {
    id: 'coolify',
    name: 'Coolify',
    description: 'Plataforma PaaS para deploy e gerenciamento de aplicações',
    url: 'https://coolify.zappro.site',
    category: 'infra',
    icon: '☁️',
    status: 'operational'
  },
  {
    id: 'n8n',
    name: 'n8n',
    description: 'Automação low-code de workflows',
    url: 'http://10.0.19.7:5678',
    category: 'infra',
    icon: '🔄',
    status: 'operational'
  },
  {
    id: 'qdrant',
    name: 'Qdrant',
    description: 'Vector database para RAG e embeddings',
    url: 'http://10.0.19.7:6333',
    category: 'infra',
    icon: '🔢',
    status: 'operational'
  },

  // ========== DEV ==========
  {
    id: 'git',
    name: 'Gitea',
    description: 'Git self-hosted - repositórios e CI/CD',
    url: 'https://git.zappro.site',
    category: 'dev',
    icon: '🐙',
    status: 'operational'
  },

  // ========== SECURITY ==========
  {
    id: 'infisical',
    name: 'Infisical',
    description: 'Gestão de secrets e variáveis de ambiente',
    url: 'https://infisical.zappro.site',
    category: 'security',
    icon: '🔐',
    status: 'down'
  }
];

export const categories = {
  ai: { name: 'Inteligência Artificial', icon: '🤖' },
  monitoring: { name: 'Monitoramento', icon: '📊' },
  infra: { name: 'Infraestrutura', icon: '🖧' },
  dev: { name: 'Desenvolvimento', icon: '💻' },
  security: { name: 'Segurança', icon: '🔒' }
};

export default tools;
