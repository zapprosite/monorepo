// Anti-hardcoded: all config via process.env
// Hermes Agency Suite — Skill Registry

export interface Skill {
  id: string;
  name: string;
  description: string;
  tools: string[];
  triggers: string[];
}

// Canonical list of known tool names — used for validation at module load time.
// When a new tool is introduced, add it here first.
const REGISTERED_TOOLS = new Set([
  // CEO / routing
  'langgraph_execute',
  'skill_route',
  'human_gate_trigger',
  'qdrant_query',
  // Onboarding
  'create_client_profile',
  'init_qdrant_collection',
  'send_welcome_sequence',
  'create_first_milestone',
  // Video
  'transcribe_video',
  'extract_key_moments',
  'generate_caption',
  'upload_to_r2',
  // Organizer
  'create_task',
  'update_task_status',
  'assign_to_agent',
  'set_reminder',
  'list_tasks',
  // Creative
  'generate_script',
  'brainstorm_angles',
  'write_copy',
  'create_mood_board',
  'qdrant_retrieve',
  // Design
  'generate_image_prompt',
  'create_brand_kit',
  'suggest_colors',
  'mockup_layout',
  // Social
  'schedule_post',
  'generate_hashtags',
  'cross_post',
  'analyze_engagement',
  'post_to_social',
  // PM
  'create_milestone',
  'check_deliverables',
  'send_status_update',
  'escalate_if_needed',
  'get_campaign_status',
  // Analytics
  'fetch_metrics',
  'generate_report',
  'compare_campaigns',
  'alert_anomaly',
  'qdrant_aggregate',
  // Brand Guardian
  'check_brand_consistency',
  'scan_for_violations',
  'approve_content',
  'flag_for_review',
  'score_content',
  // Client Success
  'send_nps_survey',
  'collect_feedback',
  'schedule_call',
  'renew_subscription',
  'update_health_score',
]) as const;

function _validateSkills(skills: readonly Skill[]): void {
  // 1. Unique IDs
  const seenIds = new Set<string>();
  for (const skill of skills) {
    if (seenIds.has(skill.id)) {
      console.error(`[skills] DUPLICATE skill id: '${skill.id}'`);
    }
    seenIds.add(skill.id);
  }

  // 2. Each tool must be in REGISTERED_TOOLS (warn, don't hard-fail)
  for (const skill of skills) {
    for (const tool of skill.tools) {
      if (!REGISTERED_TOOLS.has(tool)) {
        console.warn(`[skills] Skill '${skill.id}' references unknown tool: '${tool}'`);
      }
    }
    // 3. No duplicate tools within a single skill
    const seenTools = new Set<string>();
    for (const tool of skill.tools) {
      if (seenTools.has(tool)) {
        console.warn(`[skills] Skill '${skill.id}' has duplicate tool: '${tool}'`);
      }
      seenTools.add(tool);
    }
  }
}

export const AGENCY_SKILLS: readonly Skill[] = [
  {
    id: 'agency-ceo',
    name: 'CEO MIX',
    description:
      'Router supervisor — routes tasks to specialized skills, executes LangGraph workflows, triggers human gates',
    tools: ['langgraph_execute', 'skill_route', 'human_gate_trigger', 'qdrant_query'],
    triggers: ['/start', '/agency', 'brief', 'campaign'],
  },
  {
    id: 'agency-onboarding',
    name: 'ONBOARDING',
    description:
      'New client onboarding — creates profile, initializes Qdrant collection, sends welcome sequence',
    tools: [
      'create_client_profile',
      'init_qdrant_collection',
      'send_welcome_sequence',
      'create_first_milestone',
    ],
    triggers: ['/start', 'novo cliente', 'onboarding', 'bem-vindo'],
  },
  {
    id: 'agency-video-editor',
    name: 'VIDEO EDITOR',
    description: 'Video processing — transcribes, extracts key moments, generates captions',
    tools: ['transcribe_video', 'extract_key_moments', 'generate_caption', 'upload_to_r2'],
    triggers: ['vídeo', 'video', 'youtube', 'transcrever'],
  },
  {
    id: 'agency-organizer',
    name: 'ORGANIZADOR',
    description:
      'Task management — creates tasks, updates status, assigns to agents, sets reminders',
    tools: ['create_task', 'update_task_status', 'assign_to_agent', 'set_reminder', 'list_tasks'],
    triggers: ['tarefa', 'task', 'organizar', 'lembrete'],
  },
  {
    id: 'agency-creative',
    name: 'CREATIVE',
    description:
      'Content creation — generates scripts, brainstorm angles, writes copy, creates mood boards',
    tools: [
      'generate_script',
      'brainstorm_angles',
      'write_copy',
      'create_mood_board',
      'qdrant_retrieve',
    ],
    triggers: ['criar', 'script', 'copy', 'ideia', 'criativo'],
  },
  {
    id: 'agency-design',
    name: 'DESIGN',
    description:
      'Visual design — generates image prompts, creates brand kits, suggests colors, mockups',
    tools: ['generate_image_prompt', 'create_brand_kit', 'suggest_colors', 'mockup_layout'],
    triggers: ['design', 'imagem', 'visual', 'cores', 'brand'],
  },
  {
    id: 'agency-social',
    name: 'SOCIAL MEDIA',
    description:
      'Social media management — schedules posts, generates hashtags, cross-posts, analyzes engagement',
    tools: [
      'schedule_post',
      'generate_hashtags',
      'cross_post',
      'analyze_engagement',
      'post_to_social',
    ],
    triggers: ['postar', 'social', 'hashtag', 'publicar', 'instagram', 'twitter'],
  },
  {
    id: 'agency-pm',
    name: 'PROJECT MANAGER',
    description:
      'Project management — creates milestones, checks deliverables, sends status updates, escalates',
    tools: [
      'create_milestone',
      'check_deliverables',
      'send_status_update',
      'escalate_if_needed',
      'get_campaign_status',
    ],
    triggers: ['milestone', 'status', 'entrega', 'projeto', 'pm'],
  },
  {
    id: 'agency-analytics',
    name: 'ANALYTICS',
    description:
      'Analytics and reporting — fetches metrics, generates reports, compares campaigns, alerts anomalies',
    tools: [
      'fetch_metrics',
      'generate_report',
      'compare_campaigns',
      'alert_anomaly',
      'qdrant_aggregate',
    ],
    triggers: ['métricas', 'analytics', 'relatório', 'dashboard', 'análise'],
  },
  {
    id: 'agency-brand-guardian',
    name: 'BRAND GUARDIAN',
    description:
      'Brand consistency enforcement — checks brand consistency, scans for violations, approves content',
    tools: [
      'check_brand_consistency',
      'scan_for_violations',
      'approve_content',
      'flag_for_review',
      'score_content',
    ],
    triggers: ['brand', 'marca', 'consistência', 'approvar', 'revisar'],
  },
  {
    id: 'agency-client-success',
    name: 'CLIENT SUCCESS',
    description:
      'Client success management — sends NPS surveys, collects feedback, schedules calls, renewals',
    tools: [
      'send_nps_survey',
      'collect_feedback',
      'schedule_call',
      'renew_subscription',
      'update_health_score',
    ],
    triggers: ['nps', 'feedback', 'cliente', 'sucesso', 'renovar', 'satisfaction'],
  },
];

export function getSkillById(id: string): Skill | undefined {
  return AGENCY_SKILLS.find((s) => s.id === id);
}

export function getSkillByTrigger(input: string): Skill | undefined {
  const lower = input.toLowerCase();
  return AGENCY_SKILLS.find((skill) =>
    skill.triggers.some((t) => lower.includes(t.toLowerCase())),
  );
}

// Run validation once at module load time
_validateSkills(AGENCY_SKILLS);
