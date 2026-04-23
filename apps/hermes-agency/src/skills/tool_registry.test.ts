import { describe, it, expect, vi } from 'vitest';
import { TOOL_REGISTRY, executeTool } from './tool_registry.js';

// ---------------------------------------------------------------------------
// Helper: mock dependencies
// ---------------------------------------------------------------------------

// Mock qdrant client
vi.mock('../qdrant/client.js', () => ({
  search: vi.fn().mockResolvedValue([]),
  getPoint: vi.fn().mockResolvedValue(null),
  updatePoint: vi.fn().mockResolvedValue(true),
  scrollCollection: vi.fn().mockResolvedValue({ points: [] }),
  COLLECTIONS: {
    TASKS: 'agency_tasks',
    WORKING_MEMORY: 'agency_working_memory',
  },
}));

// Mock redis
vi.mock('../telegram/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
}));

// Mock llmComplete
vi.mock('../litellm/router.js', () => ({
  llmComplete: vi.fn().mockResolvedValue({ content: 'Mocked LLM response' }),
}));

// Mock circuit_breaker
vi.mock('./circuit_breaker.js', () => ({
  getAllCircuitBreakers: vi.fn().mockReturnValue({}),
  resetCircuitBreaker: vi.fn(),
  isCallPermitted: vi.fn().mockReturnValue(true),
}));

// Mock rag-instance-organizer
vi.mock('./rag-instance-organizer.js', () => ({
  ragRetrieve: vi.fn().mockResolvedValue([]),
  ragSearch: vi.fn().mockResolvedValue([]),
  createDataset: vi.fn().mockResolvedValue({ id: 'ds_123', name: 'test' }),
  buildDatasetName: vi.fn().mockReturnValue('test-name'),
  DATASET_TEMPLATES: {
    'hermes-knowledge': { app: 'hermes', description: 'Hermes knowledge' },
  },
}));

// Mock langgraph supervisor
vi.mock('../langgraph/supervisor.ts', () => ({
  invokeWorkflow: vi.fn().mockResolvedValue({ status: 'ok', data: {} }),
}));

// ---------------------------------------------------------------------------
// TOOL_REGISTRY entries
// ---------------------------------------------------------------------------

describe('TOOL_REGISTRY', () => {
  const toolNames = Object.keys(TOOL_REGISTRY);

  it('contains expected tools', () => {
    const expected = [
      'rag_retrieve',
      'rag_search',
      'rag_create_dataset',
      'rag_list_datasets',
      'qdrant_query',
      'langgraph_execute',
      'skill_route',
      'human_gate_trigger',
      'generate_script',
      'brainstorm_angles',
      'write_copy',
      'create_mood_board',
      'schedule_post',
      'generate_hashtags',
      'analyze_engagement',
      'create_task',
      'update_task_status',
      'assign_to_agent',
      'set_reminder',
      'list_tasks',
      'resetCircuitBreaker',
      'getCircuitBreakers',
      'isCallPermitted',
    ];

    for (const name of expected) {
      expect(toolNames).toContain(name);
    }
  });

  it('each tool is a function', () => {
    for (const name of toolNames) {
      expect(typeof TOOL_REGISTRY[name]).toBe('function');
    }
  });
});

// ---------------------------------------------------------------------------
// executeTool
// ---------------------------------------------------------------------------

describe('executeTool', () => {
  it('returns error for unknown tool', async () => {
    const result = await executeTool('unknown_tool', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Unknown tool');
    }
  });

  it('returns error when tool throws', async () => {
    // This should not happen with proper tool implementations, but verify error handling
    const result = await executeTool('rag_create_dataset', { app: '' });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tool: rag_retrieve
// ---------------------------------------------------------------------------

describe('rag_retrieve', () => {
  it('returns {ok: false} when query is missing', async () => {
    const result = await TOOL_REGISTRY['rag_retrieve']({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('query is required');
  });

  it('returns {ok: true} with data when query is provided', async () => {
    const result = await TOOL_REGISTRY['rag_retrieve']({ query: 'test query', topK: 5 });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tool: rag_search
// ---------------------------------------------------------------------------

describe('rag_search', () => {
  it('returns {ok: false} when query is missing', async () => {
    const result = await TOOL_REGISTRY['rag_search']({ datasetId: 'ds_123' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('query and datasetId required');
  });

  it('returns {ok: false} when datasetId is missing', async () => {
    const result = await TOOL_REGISTRY['rag_search']({ query: 'test' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('query and datasetId required');
  });

  it('returns {ok: true} when required args provided', async () => {
    const result = await TOOL_REGISTRY['rag_search']({ query: 'test', datasetId: 'ds_123', limit: 5 });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tool: rag_create_dataset
// ---------------------------------------------------------------------------

describe('rag_create_dataset', () => {
  it('returns {ok: false} when app is missing', async () => {
    const result = await TOOL_REGISTRY['rag_create_dataset']({ description: 'test' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('app is required');
  });

  it('returns {ok: true} with data when app is provided', async () => {
    const result = await TOOL_REGISTRY['rag_create_dataset']({ app: 'testapp', description: 'test' });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tool: rag_list_datasets
// ---------------------------------------------------------------------------

describe('rag_list_datasets', () => {
  it('returns {ok: true} with template keys', async () => {
    const result = await TOOL_REGISTRY['rag_list_datasets']({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.data)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: qdrant_query
// ---------------------------------------------------------------------------

describe('qdrant_query', () => {
  it('returns {ok: false} when collection is missing', async () => {
    const result = await TOOL_REGISTRY['qdrant_query']({ vector: [0.1, 0.2] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('collection and vector required');
  });

  it('returns {ok: false} when vector is missing', async () => {
    const result = await TOOL_REGISTRY['qdrant_query']({ collection: 'test' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('collection and vector required');
  });

  it('returns {ok: true} when required args provided', async () => {
    const result = await TOOL_REGISTRY['qdrant_query']({ collection: 'test', vector: [0.1, 0.2], limit: 5 });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tool: langgraph_execute
// ---------------------------------------------------------------------------

describe('langgraph_execute', () => {
  it('returns {ok: false} when workflow is missing', async () => {
    const result = await TOOL_REGISTRY['langgraph_execute']({ input: 'test' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('workflow is required');
  });

  it('returns {ok: true} when workflow is provided', async () => {
    const result = await TOOL_REGISTRY['langgraph_execute']({ workflow: 'test_workflow', input: 'test' });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tool: skill_route
// ---------------------------------------------------------------------------

describe('skill_route', () => {
  it('returns {ok: true} with routed input', async () => {
    const result = await TOOL_REGISTRY['skill_route']({ input: 'test input' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('routed');
      expect(result.data).toHaveProperty('status');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: human_gate_trigger
// ---------------------------------------------------------------------------

describe('human_gate_trigger', () => {
  it('returns {ok: true} with message', async () => {
    const result = await TOOL_REGISTRY['human_gate_trigger']({ message: 'test message' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('message', 'test message');
      expect(result.data).toHaveProperty('status', 'human_gate pending');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: generate_script
// ---------------------------------------------------------------------------

describe('generate_script', () => {
  it('returns {ok: false} when topic is missing', async () => {
    const result = await TOOL_REGISTRY['generate_script']({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('topic is required');
  });

  it('returns {ok: true} with script data when topic provided', async () => {
    const result = await TOOL_REGISTRY['generate_script']({ topic: 'test campaign' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('tool', 'generate_script');
      expect(result.data).toHaveProperty('topic', 'test campaign');
      expect(result.data).toHaveProperty('script');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: brainstorm_angles
// ---------------------------------------------------------------------------

describe('brainstorm_angles', () => {
  it('returns {ok: false} when topic is missing', async () => {
    const result = await TOOL_REGISTRY['brainstorm_angles']({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('topic is required');
  });

  it('returns {ok: true} with angles array', async () => {
    const result = await TOOL_REGISTRY['brainstorm_angles']({ topic: 'summer campaign' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('tool', 'brainstorm_angles');
      expect(result.data).toHaveProperty('angles');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: write_copy
// ---------------------------------------------------------------------------

describe('write_copy', () => {
  it('returns {ok: false} when topic is missing', async () => {
    const result = await TOOL_REGISTRY['write_copy']({ platform: 'Instagram' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('topic is required');
  });

  it('returns {ok: true} with copy data', async () => {
    const result = await TOOL_REGISTRY['write_copy']({ topic: 'new product', platform: 'Instagram' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('tool', 'write_copy');
      expect(result.data).toHaveProperty('topic', 'new product');
      expect(result.data).toHaveProperty('platform', 'Instagram');
      expect(result.data).toHaveProperty('copy');
    }
  });

  it('defaults platform to Instagram', async () => {
    const result = await TOOL_REGISTRY['write_copy']({ topic: 'test' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('platform', 'Instagram');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: create_mood_board
// ---------------------------------------------------------------------------

describe('create_mood_board', () => {
  it('returns {ok: false} when topic is missing', async () => {
    const result = await TOOL_REGISTRY['create_mood_board']({ style: 'moderna' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('topic is required');
  });

  it('returns {ok: true} with image URLs', async () => {
    const result = await TOOL_REGISTRY['create_mood_board']({ topic: 'beach vacation', style: 'tropical' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('tool', 'create_mood_board');
      expect(result.data).toHaveProperty('images');
      expect(Array.isArray(result.data.images)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: schedule_post
// ---------------------------------------------------------------------------

describe('schedule_post', () => {
  it('returns {ok: false} when content is missing', async () => {
    const result = await TOOL_REGISTRY['schedule_post']({ platform: 'Telegram' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('content is required');
  });

  it('returns {ok: true} with scheduled time', async () => {
    const result = await TOOL_REGISTRY['schedule_post']({ content: 'Hello world', platform: 'Telegram' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('tool', 'schedule_post');
      expect(result.data).toHaveProperty('scheduledTime');
      expect(result.data).toHaveProperty('status', 'scheduled');
    }
  });

  it('defaults platform to Telegram', async () => {
    const result = await TOOL_REGISTRY['schedule_post']({ content: 'test' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('platform', 'Telegram');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: generate_hashtags
// ---------------------------------------------------------------------------

describe('generate_hashtags', () => {
  it('returns {ok: false} when topic is missing', async () => {
    const result = await TOOL_REGISTRY['generate_hashtags']({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('topic is required');
  });

  it('returns {ok: true} with hashtags array', async () => {
    const result = await TOOL_REGISTRY['generate_hashtags']({ topic: 'marketing', count: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('tool', 'generate_hashtags');
      expect(result.data).toHaveProperty('hashtags');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: analyze_engagement
// ---------------------------------------------------------------------------

describe('analyze_engagement', () => {
  it('returns {ok: true} with mock metrics', async () => {
    const result = await TOOL_REGISTRY['analyze_engagement']({ postId: 'post_123', platform: 'Instagram' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('tool', 'analyze_engagement');
      expect(result.data).toHaveProperty('likes');
      expect(result.data).toHaveProperty('engagementRate');
    }
  });

  it('defaults platform to Instagram', async () => {
    const result = await TOOL_REGISTRY['analyze_engagement']({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('platform', 'Instagram');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: create_task
// ---------------------------------------------------------------------------

describe('create_task', () => {
  it('returns {ok: false} when title is missing', async () => {
    const result = await TOOL_REGISTRY['create_task']({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('title is required');
  });

  it('returns {ok: true} with task data', async () => {
    const result = await TOOL_REGISTRY['create_task']({
      title: 'Test task',
      description: 'Test description',
      priority: 'high',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('tool', 'create_task');
      expect(result.data).toHaveProperty('task');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: update_task_status
// ---------------------------------------------------------------------------

describe('update_task_status', () => {
  it('returns {ok: false} when task_id is missing', async () => {
    const result = await TOOL_REGISTRY['update_task_status']({ status: 'completed' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('task_id is required');
  });

  it('returns {ok: false} for invalid status', async () => {
    const result = await TOOL_REGISTRY['update_task_status']({ task_id: 'task_123', status: 'invalid' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('status must be one of');
  });
});

// ---------------------------------------------------------------------------
// Tool: assign_to_agent
// ---------------------------------------------------------------------------

describe('assign_to_agent', () => {
  it('returns {ok: false} when task_id is missing', async () => {
    const result = await TOOL_REGISTRY['assign_to_agent']({ agent_id: 'agent_1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('task_id and agent_id are required');
  });

  it('returns {ok: false} when agent_id is missing', async () => {
    const result = await TOOL_REGISTRY['assign_to_agent']({ task_id: 'task_1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('task_id and agent_id are required');
  });

  it('returns {ok: true} with assignment data', async () => {
    const result = await TOOL_REGISTRY['assign_to_agent']({
      task_id: 'task_1',
      agent_id: 'agent_1',
      agent_name: 'Test Agent',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('tool', 'assign_to_agent');
      expect(result.data).toHaveProperty('status', 'assigned');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: set_reminder
// ---------------------------------------------------------------------------

describe('set_reminder', () => {
  it('returns {ok: false} when message is missing', async () => {
    const result = await TOOL_REGISTRY['set_reminder']({ remind_at: '2025-01-01' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('message is required');
  });

  it('returns {ok: true} with reminder data (uses Qdrant fallback)', async () => {
    const result = await TOOL_REGISTRY['set_reminder']({ message: 'Test reminder' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('tool', 'set_reminder');
      expect(result.data).toHaveProperty('reminderId');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: list_tasks
// ---------------------------------------------------------------------------

describe('list_tasks', () => {
  it('returns {ok: true} with tasks array', async () => {
    const result = await TOOL_REGISTRY['list_tasks']({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('tool', 'list_tasks');
      expect(result.data).toHaveProperty('tasks');
      expect(Array.isArray(result.data.tasks)).toBe(true);
    }
  });

  it('accepts optional filters', async () => {
    const result = await TOOL_REGISTRY['list_tasks']({ status: 'pending', assignee: 'agent_1', limit: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('filters');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: resetCircuitBreaker
// ---------------------------------------------------------------------------

describe('resetCircuitBreaker', () => {
  it('returns {ok: false} when skillId is missing', async () => {
    const result = await TOOL_REGISTRY['resetCircuitBreaker']({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('skillId required');
  });

  it('returns {ok: true} when skillId provided', async () => {
    const result = await TOOL_REGISTRY['resetCircuitBreaker']({ skillId: 'agency-creative' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('status', 'reset');
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: getCircuitBreakers
// ---------------------------------------------------------------------------

describe('getCircuitBreakers', () => {
  it('returns {ok: true} with circuit breakers data', async () => {
    const result = await TOOL_REGISTRY['getCircuitBreakers']();
    expect(result.ok).toBe(true);
    if (result.ok) {
      // getAllCircuitBreakers returns an array of CircuitBreakerState
      expect(result.data).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Tool: isCallPermitted
// ---------------------------------------------------------------------------

describe('isCallPermitted', () => {
  it('returns {ok: true} with permitted status', async () => {
    const result = await TOOL_REGISTRY['isCallPermitted']({ skillId: 'agency-creative' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('permitted');
    }
  });

  it('handles missing skillId', async () => {
    const result = await TOOL_REGISTRY['isCallPermitted']({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty('permitted');
    }
  });
});
