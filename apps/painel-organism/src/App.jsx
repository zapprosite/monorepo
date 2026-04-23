import { useState, useEffect } from 'react'

// ─── SVG Components ───────────────────────────────────────────────────────────

function BrainIcon({ className = "w-32 h-32", animate = true }) {
  return (
    <svg viewBox="0 0 100 100" className={`${className} ${animate ? 'animate-pulse-glow' : ''}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="30" r="6" fill="#00f5d4" opacity="0.9"/>
      <circle cx="30" cy="45" r="5" fill="#00f5d4" opacity="0.7"/>
      <circle cx="70" cy="45" r="5" fill="#00f5d4" opacity="0.7"/>
      <circle cx="25" cy="65" r="4" fill="#39ff14" opacity="0.8"/>
      <circle cx="50" cy="55" r="7" fill="#00f5d4" opacity="0.9"/>
      <circle cx="75" cy="65" r="4" fill="#39ff14" opacity="0.8"/>
      <circle cx="40" cy="75" r="5" fill="#00f5d4" opacity="0.7"/>
      <circle cx="60" cy="75" r="5" fill="#00f5d4" opacity="0.7"/>
      <circle cx="50" cy="85" r="4" fill="#00a8e8" opacity="0.6"/>
      <line x1="50" y1="30" x2="30" y2="45" stroke="#00f5d4" strokeWidth="1" opacity="0.5"/>
      <line x1="50" y1="30" x2="70" y2="45" stroke="#00f5d4" strokeWidth="1" opacity="0.5"/>
      <line x1="30" y1="45" x2="25" y2="65" stroke="#39ff14" strokeWidth="1" opacity="0.4"/>
      <line x1="30" y1="45" x2="50" y2="55" stroke="#00f5d4" strokeWidth="1" opacity="0.5"/>
      <line x1="70" y1="45" x2="75" y2="65" stroke="#39ff14" strokeWidth="1" opacity="0.4"/>
      <line x1="70" y1="45" x2="50" y2="55" stroke="#00f5d4" strokeWidth="1" opacity="0.5"/>
      <line x1="25" y1="65" x2="40" y2="75" stroke="#00f5d4" strokeWidth="1" opacity="0.4"/>
      <line x1="50" y1="55" x2="40" y2="75" stroke="#00f5d4" strokeWidth="1" opacity="0.5"/>
      <line x1="50" y1="55" x2="60" y2="75" stroke="#00f5d4" strokeWidth="1" opacity="0.5"/>
      <line x1="75" y1="65" x2="60" y2="75" stroke="#00f5d4" strokeWidth="1" opacity="0.4"/>
      <line x1="40" y1="75" x2="50" y2="85" stroke="#00a8e8" strokeWidth="1" opacity="0.4"/>
      <line x1="60" y1="75" x2="50" y2="85" stroke="#00a8e8" strokeWidth="1" opacity="0.4"/>
      <circle cx="50" cy="55" r="35" stroke="#00f5d4" strokeWidth="0.5" opacity="0.2" strokeDasharray="4 2"/>
    </svg>
  )
}

// ─── Status Dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  const cls = status === 'working' ? 'status-working' : status === 'partial' ? 'status-partial' : 'status-offline'
  return <span className={`status-dot ${cls}`} />
}

// ─── Live Status Checker ──────────────────────────────────────────────────────

function useServiceHealth(services) {
  const [health, setHealth] = useState({})

  useEffect(() => {
    const check = async () => {
      const results = {}
      for (const svc of services) {
        try {
          const res = await fetch(svc.healthUrl, { signal: AbortSignal.timeout(3000) })
          results[svc.key] = res.ok ? 'working' : 'partial'
        } catch {
          results[svc.key] = 'offline'
        }
      }
      setHealth(results)
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  return health
}

// ─── Layer Config ────────────────────────────────────────────────────────────

const LAYERS = [
  {
    id: 'memory',
    name: 'MEMORY',
    icon: '💾',
    color: 'neon-blue',
    colorClass: 'border-neon-blue',
    services: [
      {
        key: 'mem0',
        name: 'Mem0',
        description: 'Session memory layer. Stores conversation history with TTL (7/30/90 days) by importance. Persists via Qdrant.',
        port: ':6333',
        docs: 'docs/HERMES-OPS.md',
        healthUrl: 'http://localhost:6333/health',
        url: null,
      },
      {
        key: 'qdrant',
        name: 'Qdrant',
        description: 'Vector database for embeddings. Stores all Mem0 collections + RAG vectors. 768d nomic-embed-text vectors.',
        port: ':6333',
        docs: 'docs/QDRANT_COLLECTION_SCHEMA.md',
        healthUrl: 'http://localhost:6333/readyz',
        url: null,
      },
      {
        key: 'second-brain',
        name: 'Second Brain',
        description: 'Long-term knowledge base combining Mem0 + Trieve. Layers memory by recency, importance, and domain.',
        port: ':6435',
        docs: 'docs/SECOND-BRAIN.md',
        healthUrl: 'http://localhost:6435/api/v1/health',
        url: null,
      },
      {
        key: 'redis',
        name: 'Redis',
        description: 'Cache layer for rate limiting, session tokens, and ephemeral state. Zappro Redis on port 6379.',
        port: ':6379',
        docs: 'docs/REDIS_ARCHITECTURE.md',
        healthUrl: 'http://localhost:6379',
        url: null,
      },
    ],
  },
  {
    id: 'rag',
    name: 'RAG / KNOWLEDGE',
    icon: '🔍',
    color: 'neon-purple',
    colorClass: 'border-neon-purple',
    services: [
      {
        key: 'trieve',
        name: 'Trieve',
        description: 'RAG dataset organizer. Manages knowledge chunks by dimension (app, lead, knowledge). Handles hybrid search.',
        port: ':6435',
        docs: 'docs/RAG_ARCHITECTURE.md',
        healthUrl: 'http://localhost:6435/api/v1/health',
        url: null,
      },
      {
        key: 'rag-pipeline',
        name: 'RAG Pipeline',
        description: 'ragRetrieve + ragSearch tools in Hermes Agency. Uses Trieve for semantic search + Qdrant for vector matching.',
        port: ':3001',
        docs: 'docs/RAG_ARCHITECTURE.md',
        healthUrl: 'http://localhost:3001/health',
        url: 'https://hermes-agency.zappro.site',
      },
      {
        key: 'embeddings',
        name: 'Embeddings',
        description: 'Ollama nomic-embed-text generates 768d vectors. Used by Mem0 for session memory and Trieve for RAG.',
        port: ':11434',
        docs: 'docs/LLM_PROVIDER_ARCHITECTURE.md',
        healthUrl: 'http://localhost:11434/api/tags',
        url: null,
      },
    ],
  },
  {
    id: 'llm',
    name: 'LLM / BRAIN',
    icon: '🧠',
    color: 'neon-cyan',
    colorClass: 'border-neon-cyan',
    services: [
      {
        key: 'litellm',
        name: 'LiteLLM Proxy',
        description: 'Multi-provider LLM gateway. Routes to MiniMax → Groq → OpenAI → Ollama. Handles retries, fallbacks, cost tracking.',
        port: ':4000',
        docs: 'docs/LLM_PROVIDER_ARCHITECTURE.md',
        healthUrl: 'http://localhost:4000/health',
        url: 'https://llm.zappro.site',
      },
      {
        key: 'ollama',
        name: 'Ollama',
        description: 'Local LLM inference on RTX 4090. Models: gemma4, qwen2.5vl, nomic-embed-text. Zero external API cost.',
        port: ':11434',
        docs: null,
        healthUrl: 'http://localhost:11434/api/tags',
        url: null,
      },
      {
        key: 'ai-gateway',
        name: 'ai-gateway',
        description: 'OpenAI-compatible facade. Routes to LiteLLM. Bearer token auth. Serves llm.zappro.site.',
        port: ':4002',
        docs: 'docs/API_GATEWAY_ARCHITECTURE.md',
        healthUrl: 'http://localhost:4002/health',
        url: 'https://llm.zappro.site',
      },
      {
        key: 'minimax',
        name: 'MiniMax',
        description: 'Primary external LLM provider. Used for CEO routing, creative tasks, and high-quality generation.',
        port: 'API',
        docs: null,
        healthUrl: null,
        url: null,
      },
    ],
  },
  {
    id: 'agents',
    name: 'AGENTS',
    icon: '🤖',
    color: 'neon-amber',
    colorClass: 'border-neon-amber',
    services: [
      {
        key: 'hermes-agency',
        name: 'Hermes Agency',
        description: 'CEO_REFRIMIX_bot — multi-skill marketing agent. Routes user messages via CEO LLM to 12 skills (creative, social, analytics, onboarding...).',
        port: ':3001',
        docs: 'docs/HERMES-OPS.md',
        healthUrl: 'http://localhost:3001/health',
        url: 'https://hermes-agency.zappro.site',
      },
      {
        key: 'claude-code',
        name: 'Claude Code',
        description: 'Main coding agent. Reads/writes code, runs tests, commits. Part of the organism CLI tooling.',
        port: 'CLI',
        docs: null,
        healthUrl: null,
        url: null,
      },
      {
        key: 'mclaude',
        name: 'mclaude',
        description: 'Multi-provider LLM switcher CLI. Switch between MiniMax, Ollama, Groq, OpenAI, LiteLLM at runtime.',
        port: 'CLI',
        docs: null,
        healthUrl: null,
        url: null,
      },
      {
        key: 'opencode',
        name: 'OpenCode',
        description: 'Web scraping + AI research agent. Uses SearXNG for search, processes results via LLM.',
        port: ':4013',
        docs: null,
        healthUrl: null,
        url: null,
      },
    ],
  },
  {
    id: 'messaging',
    name: 'INTERFACE',
    icon: '💬',
    color: 'neon-green',
    colorClass: 'border-neon-green',
    services: [
      {
        key: 'telegram',
        name: 'Telegram Bot',
        description: 'Hermes Telegram integration. Users chat with CEO_REFRIMIX_bot via Telegram. Voice messages processed via Kokoro-TTS.',
        port: ':8642',
        docs: 'docs/TELEGRAM_BOT_ECOSYSTEM.md',
        healthUrl: null,
        url: 'https://t.me/hermes_cli',
      },
      {
        key: 'openwebui',
        name: 'OpenWebUI',
        description: 'Chat UI for LLM interaction. Users chat with local models via OpenWebUI. Serves chat.zappro.site.',
        port: ':8080',
        docs: null,
        healthUrl: null,
        url: 'https://chat.zappro.site',
      },
      {
        key: 'grafana',
        name: 'Grafana',
        description: 'Monitoring dashboards. Shows metrics for Hermes, LiteLLM, Qdrant, Redis, Ollama. Alerting configured.',
        port: ':3000',
        docs: 'docs/OBSERVABILITY.md',
        healthUrl: null,
        url: 'https://grafana.zappro.site',
      },
      {
        key: 'coolify',
        name: 'Coolify',
        description: 'Container orchestration PaaS. Manages all Docker deployments, SSL, health checks, and rollback.',
        port: ':8000',
        docs: null,
        healthUrl: null,
        url: 'https://coolify.zappro.site',
      },
    ],
  },
  {
    id: 'storage',
    name: 'STORAGE',
    icon: '🗄️',
    color: 'neon-red',
    colorClass: 'border-neon-red',
    services: [
      {
        key: 'postgres',
        name: 'PostgreSQL MCP',
        description: 'Structured database via MCP server (port 4017). Schema: clients, campaigns, tasks, deliverables, metrics. Syncs to Qdrant.',
        port: ':4017',
        docs: 'docs/POSTGRES_MCP_ARCHITECTURE.md',
        healthUrl: 'http://localhost:4017/health',
        url: null,
      },
      {
        key: 'gitea',
        name: 'Gitea',
        description: 'Self-hosted Git server. Hosts all git repos including monorepo. Accessible via git.zappro.site.',
        port: ':3300',
        docs: null,
        healthUrl: null,
        url: 'https://git.zappro.site',
      },
      {
        key: 'zfs',
        name: 'ZFS Pool',
        description: 'tank pool (3.5TB, 99% free). Datasets: monorepo, qdrant, models, backups, docker-data. Snapshots for backup.',
        port: 'ZFS',
        docs: null,
        healthUrl: null,
        url: null,
      },
    ],
  },
  {
    id: 'infra',
    name: 'INFRASTRUCTURE',
    icon: '⚙️',
    color: 'neon-gray',
    colorClass: 'border-gray-600',
    services: [
      {
        key: 'docker',
        name: 'Docker',
        description: 'Container runtime. 31 containers running across multiple networks (bridge, coolify, litellm_default...).',
        port: 'Docker',
        docs: 'docs/DEPLOYMENT_ARCHITECTURE.md',
        healthUrl: null,
        url: null,
      },
      {
        key: 'cloudflare',
        name: 'Cloudflare Tunnel',
        description: 'Secure tunnel to expose services. No direct IP exposure. Tunnel ID aee7a93d-c2e2-4c77-a395-71edc1821402.',
        port: 'cloudflared',
        docs: 'docs/SECURITY_ARCHITECTURE.md',
        healthUrl: null,
        url: null,
      },
      {
        key: 'mcp-servers',
        name: 'MCP Servers',
        description: '7 MCP servers (4011-4017): Qdrant, Coolify, Ollama, System, Cron, Memory, Postgres. Claude Code tool access.',
        port: '4011-4017',
        docs: 'docs/SPECS/SPEC-115-painel-organism.md',
        healthUrl: null,
        url: null,
      },
      {
        key: 'monorepo',
        name: 'Monorepo',
        description: 'Central git repo at /srv/monorepo. All apps, configs, docs, scripts, agents. Git worktrees for parallel work.',
        port: '/srv/monorepo',
        docs: null,
        healthUrl: null,
        url: 'https://git.zappro.site/will-zappro/monorepo',
      },
    ],
  },
]

const ALL_SERVICES = LAYERS.flatMap(l => l.services)

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ service, status }) {
  const liveStatus = status ?? (service.healthUrl ? 'offline' : 'working')

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-dark-800/50 hover:border-neon-cyan transition-all duration-300 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white font-mono text-sm">{service.name}</h3>
        {service.healthUrl && <StatusDot status={liveStatus} />}
        {!service.healthUrl && <span className="text-xs text-gray-500 font-mono">CLI/Host</span>}
      </div>
      <p className="text-xs text-gray-400 leading-relaxed flex-1">{service.description}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {service.port && (
          <span className="text-xs text-neon-cyan font-mono bg-dark-900 px-2 py-0.5 rounded border border-gray-700">
            {service.port}
          </span>
        )}
        {service.url && (
          <a href={service.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-neon-green hover:underline">
            ↗ {new URL(service.url).hostname}
          </a>
        )}
        {service.docs && (
          <a href={`https://git.zappro.site/will-zappro/monorepo/raw/HEAD/${service.docs}`} target="_blank" rel="noopener noreferrer"
            className="text-xs text-neon-purple hover:underline">
            📄 docs
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Layer Section ────────────────────────────────────────────────────────────

function LayerSection({ layer, health }) {
  return (
    <section id={layer.id} className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{layer.icon}</span>
        <h2 className={`text-xl font-bold font-mono text-${layer.color}`}>{layer.name}</h2>
        <div className={`flex-1 h-px bg-gradient-to-r from-${layer.color} to-transparent`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {layer.services.map(svc => (
          <ServiceCard key={svc.key} service={svc} status={health[svc.key]} />
        ))}
      </div>
    </section>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const [scrollProgress, setScrollProgress] = useState(0)
  const health = useServiceHealth(ALL_SERVICES)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-dark-900 gradient-grid">
      {/* Scroll Progress Bar */}
      <div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-neon-cyan via-neon-green to-neon-purple z-50 transition-all duration-100"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Hero */}
      <header className="relative min-h-screen flex flex-col items-center justify-center gradient-hero overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(0, 245, 212, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 245, 212, 0.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
          <div className="absolute top-0 w-full h-0.5 bg-gradient-to-r from-transparent via-neon-cyan to-transparent animate-scan opacity-30" />
        </div>

        <div className="relative z-10 text-center px-4">
          <div className="flex justify-center mb-8 animate-float">
            <BrainIcon className="w-48 h-48 md:w-64 md:h-64" />
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-4">
            <span className="text-neon-cyan">PAINEL</span>
            <span className="text-white"> HOMELAB</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Catálogo de serviços do organism — tudo que o homelab oferece, explicado.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <a href="#memory" className="px-6 py-3 bg-neon-cyan text-dark-900 font-bold rounded-lg hover:bg-neon-cyan/90 transition-all shadow-neon-cyan">
              Explorar Camadas
            </a>
            <a href="https://git.zappro.site/will-zappro/monorepo" target="_blank" rel="noopener noreferrer"
              className="px-6 py-3 border border-gray-600 text-gray-300 font-bold rounded-lg hover:border-white hover:text-white transition-all">
              Monorepo
            </a>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-500 animate-bounce">
          ↓ Rolar para explorar
        </div>
      </header>

      {/* Layers */}
      <main className="container mx-auto px-4 py-16 space-y-12">
        {LAYERS.map(layer => (
          <LayerSection key={layer.id} layer={layer} health={health} />
        ))}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 mt-16">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BrainIcon className="w-8 h-8" animate={false} />
            <div>
              <p className="text-white font-mono text-sm">Painel Homelab</p>
              <p className="text-xs text-gray-500">v2.0 | Catálogo de Serviços</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-2">
              <StatusDot status="working" />
              Homelab Online
            </span>
            <a href="https://git.zappro.site/will-zappro/monorepo" target="_blank" rel="noopener noreferrer"
              className="text-neon-cyan hover:underline">
              Monorepo →
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
