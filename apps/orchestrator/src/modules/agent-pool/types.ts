// Agent Pool - Types
import type { AgentSession } from "../../core/types.js";

export interface AgentConfig {
	role: string;
	task: string;
	capabilities?: string[];
	maxConcurrency?: number;
	timeout?: number;
}

export interface AgentHandle {
	agentId: string;
	role: string;
	task: string;
	status: "idle" | "busy" | "completed" | "failed";
	spawnedAt: number;
	completedAt?: number;
	result?: unknown;
}

export interface AgentPool {
	spawn(config: AgentConfig): Promise<AgentHandle>;
	getStatus(agentId: string): Promise<AgentHandle | null>;
	complete(agentId: string, result: unknown): Promise<void>;
	fail(agentId: string, error: string): Promise<void>;
	release(agentId: string): Promise<void>;
	getAvailable(role: string): Promise<AgentHandle | null>;
	getActive(): Promise<AgentHandle[]>;
}

export interface AgentSessionStore {
	save(session: AgentSession): Promise<void>;
	update(agentId: string, updates: Partial<AgentSession>): Promise<void>;
	findById(agentId: string): Promise<AgentSession | null>;
	findByRole(role: string): Promise<AgentSession[]>;
	findActive(): Promise<AgentSession[]>;
	delete(agentId: string): Promise<void>;
}
