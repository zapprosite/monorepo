-- HVAC Memory Schema
-- Rode: psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -f hvac_memory_schema.sql

create schema if not exists hvac_memory;

-- Tabela principal de eventos de memória
create table if not exists hvac_memory.agent_memory_events (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    user_id text not null,
    conversation_id text,
    domain text not null default 'hvac',
    event_type text not null, -- interaction, decision, preference, constraint, error
    content text not null,
    metadata jsonb default '{}'::jsonb,
    content_hash text, -- para dedupe
    source text default 'zappro-clima-tutor',
    confidence text default 'medium' -- high, medium, low
);

-- Estado da conversa (última posição known)
create table if not exists hvac_memory.conversation_state (
    id uuid primary key default gen_random_uuid(),
    user_id text not null,
    conversation_id text not null,
    state jsonb not null default '{}'::jsonb,
    updated_at timestamptz default now(),
    constraint unique_conv unique (user_id, conversation_id)
);

-- Writebacks audit trail
create table if not exists hvac_memory.memory_writebacks (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    user_id text not null,
    conversation_id text,
    query_summary text not null,
    answer_summary text not null,
    facts_extracted jsonb default '[]'::jsonb,
    metadata jsonb default '{}'::jsonb
);

-- Índices
create index if not exists agent_memory_events_user_id_idx
    on hvac_memory.agent_memory_events (user_id);

create index if not exists agent_memory_events_conversation_id_idx
    on hvac_memory.agent_memory_events (conversation_id);

create index if not exists agent_memory_events_content_hash_idx
    on hvac_memory.agent_memory_events (content_hash);

create index if not exists agent_memory_events_metadata_gin
    on hvac_memory.agent_memory_events using gin (metadata);

create index if not exists conversation_state_user_conv_idx
    on hvac_memory.conversation_state (user_id, conversation_id);

create index if not exists memory_writebacks_user_id_idx
    on hvac_memory.memory_writebacks (user_id);

-- Comentários
comment on table hvac_memory.agent_memory_events is 'Ledger de eventos de memória do HVAC copilot';
comment on column hvac_memory.agent_memory_events.content_hash is 'MD5 do conteúdo — para deduplicação';
comment on column hvac_memory.agent_memory_events.confidence is 'high|medium|low — priorização no context_fetch';
comment on table hvac_memory.conversation_state is 'Estado atual de cada conversa';
comment on table hvac_memory.memory_writebacks is 'Audit trail dos writebacks — nunca contém dados sensíveis';
