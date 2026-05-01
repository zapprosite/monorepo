-- SPEC-POLYMER-003: Enterprise Orchestration Schema
-- PostgreSQL schema for session state, checkpoints, and history

BEGIN;

-- Sessions table
CREATE TABLE IF NOT EXISTS orchestrator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phase TEXT NOT NULL DEFAULT 'idle',
    status TEXT NOT NULL DEFAULT 'created',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}',
    checkpoint_id UUID,
    current_step TEXT,
    error_message TEXT
);

-- Checkpoints per phase
CREATE TABLE IF NOT EXISTS orchestrator_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES orchestrator_sessions(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    step TEXT NOT NULL,
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- History de transições
CREATE TABLE IF NOT EXISTS orchestrator_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES orchestrator_sessions(id) ON DELETE CASCADE,
    from_phase TEXT,
    to_phase TEXT,
    action TEXT NOT NULL,
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_status ON orchestrator_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_phase ON orchestrator_sessions(phase);
CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON orchestrator_checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_history_session ON orchestrator_history(session_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON orchestrator_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
