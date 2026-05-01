// Universal Orchestrator - Core Types

export type WorkflowStatus =
	| "pending"
	| "running"
	| "waiting_approval"
	| "paused"
	| "completed"
	| "failed"
	| "cancelled";

export type PhaseStatus = "pending" | "running" | "completed" | "skipped" | "failed";

export type GateType = "approval" | "choice" | "manual";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

// Workflow execution state
export interface WorkflowState {
	workflowId: string;
	instanceId: string;
	name: string;
	version: string;
	status: WorkflowStatus;
	currentPhase: string;
	currentStep: number;
	context: WorkflowContext;
	startedAt: number;
	updatedAt: number;
	completedAt?: number;
	error?: string;
}

export interface WorkflowContext {
	[k: string]: unknown;
}

// Workflow definition from YAML
export interface WorkflowDefinition {
	name: string;
	description?: string;
	version: string;
	triggers?: Trigger[];
	variables?: Record<string, string>;
	phases: PhaseDefinition[];
	onFailure?: OnFailureDefinition;
}

export interface Trigger {
	type: "webhook" | "schedule" | "manual";
	event?: string;
	cron?: string;
}

export interface PhaseDefinition {
	name: string;
	condition?: string;
	steps: StepDefinition[];
	approvalGate?: ApprovalGateDefinition;
}

export interface StepDefinition {
	skill?: SkillStep;
	agent?: AgentStep;
	mcp?: McpStep;
	webhook?: WebhookStep;
}

export interface SkillStep {
	name: string;
	input?: Record<string, unknown>;
}

export interface AgentStep {
	role: string;
	task: string;
	context?: Record<string, unknown>;
}

export interface McpStep {
	provider: "claude" | "anthropic" | "make" | "zapier";
	tool: string;
	input: Record<string, unknown>;
	timeout?: number;
}

export interface WebhookStep {
	url: string;
	payload: Record<string, unknown>;
	headers?: Record<string, string>;
}

export interface ApprovalGateDefinition {
	id: string;
	type: GateType;
	approvers: Array<{ role?: string; userId?: string }>;
	prompt: string;
	timeout: number;
}

export interface OnFailureDefinition {
	phase: string;
	steps: StepDefinition[];
}

// Events for the event bus
export type WorkflowEvent =
	| { type: "workflow.started"; instanceId: string; timestamp: number }
	| { type: "workflow.phase.started"; instanceId: string; phase: string }
	| { type: "workflow.phase.completed"; instanceId: string; phase: string }
	| { type: "workflow.waiting_approval"; instanceId: string; phase: string; gateId: string }
	| { type: "workflow.approved"; instanceId: string; gateId: string; approverId: string }
	| { type: "workflow.rejected"; instanceId: string; gateId: string; approverId: string; reason: string }
	| { type: "workflow.completed"; instanceId: string; result: unknown }
	| { type: "workflow.failed"; instanceId: string; error: string }
	| { type: "workflow.paused"; instanceId: string }
	| { type: "workflow.resumed"; instanceId: string }
	| { type: "skill.invoked"; instanceId: string; skillName: string }
	| { type: "skill.completed"; instanceId: string; skillName: string; result: unknown }
	| { type: "agent.spawned"; instanceId: string; agentId: string; role: string }
	| { type: "agent.completed"; instanceId: string; agentId: string; result: unknown }
	| { type: "mcp.called"; instanceId: string; provider: string; tool: string }
	| { type: "mcp.response"; instanceId: string; provider: string; tool: string; result: unknown }
	| { type: "webhook.emitted"; instanceId: string; url: string }
	| { type: "webhook.callback"; instanceId: string; payload: unknown };

// Human approval request
export interface ApprovalRequest {
	requestId: string;
	instanceId: string;
	gateId: string;
	gateType: GateType;
	status: ApprovalStatus;
	requestedBy: string;
	approverId?: string;
	notes?: string;
	payload: Record<string, unknown>;
	timeoutAt: number;
	respondedAt?: number;
	createdAt: number;
}

// Agent session
export interface AgentSession {
	agentId: string;
	instanceId: string;
	role: string;
	task: string;
	status: "idle" | "busy" | "completed" | "failed";
	spawnedAt: number;
	completedAt?: number;
	result?: unknown;
}
