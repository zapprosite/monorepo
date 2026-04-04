// Agent Pool - In-memory implementation
import type { AgentSession } from "../../core/types.js";
import { globalEventBus } from "../../core/event-bus.js";
import type { AgentConfig, AgentHandle, AgentPool, AgentSessionStore } from "./types.js";

// In-memory store for agent sessions
class InMemoryAgentStore implements AgentSessionStore {
	private sessions: Map<string, AgentSession> = new Map();

	async save(session: AgentSession): Promise<void> {
		this.sessions.set(session.agentId, session);
	}

	async update(agentId: string, updates: Partial<AgentSession>): Promise<void> {
		const existing = this.sessions.get(agentId);
		if (!existing) {
			throw new Error(`Agent session not found: ${agentId}`);
		}
		this.sessions.set(agentId, { ...existing, ...updates });
	}

	async findById(agentId: string): Promise<AgentSession | null> {
		return this.sessions.get(agentId) ?? null;
	}

	async findByRole(role: string): Promise<AgentSession[]> {
		return Array.from(this.sessions.values()).filter((s) => s.role === role);
	}

	async findActive(): Promise<AgentSession[]> {
		return Array.from(this.sessions.values()).filter(
			(s) => s.status === "idle" || s.status === "busy"
		);
	}

	async delete(agentId: string): Promise<void> {
		this.sessions.delete(agentId);
	}
}

export class StandardAgentPool implements AgentPool {
	private store = new InMemoryAgentStore();
	private maxConcurrency = 10;

	async spawn(config: AgentConfig): Promise<AgentHandle> {
		const agentId = crypto.randomUUID();

		const session: AgentSession = {
			agentId,
			instanceId: "", // Will be set by workflow engine
			role: config.role,
			task: config.task,
			status: "busy",
			spawnedAt: Date.now(),
		};

		await this.store.save(session);

		// Emit event
		globalEventBus.emit({
			type: "agent.spawned",
			instanceId: session.instanceId,
			agentId,
			role: config.role,
		});

		return this.toHandle(session);
	}

	async getStatus(agentId: string): Promise<AgentHandle | null> {
		const session = await this.store.findById(agentId);
		return session ? this.toHandle(session) : null;
	}

	async complete(agentId: string, result: unknown): Promise<void> {
		const session = await this.store.findById(agentId);
		if (!session) {
			throw new Error(`Agent not found: ${agentId}`);
		}

		await this.store.update(agentId, {
			status: "completed",
			completedAt: Date.now(),
			result,
		});

		globalEventBus.emit({
			type: "agent.completed",
			instanceId: session.instanceId,
			agentId,
			result,
		});
	}

	async fail(agentId: string, error: string): Promise<void> {
		const session = await this.store.findById(agentId);
		if (!session) {
			throw new Error(`Agent not found: ${agentId}`);
		}

		await this.store.update(agentId, {
			status: "failed",
			completedAt: Date.now(),
		});

		globalEventBus.emit({
			type: "agent.completed",
			instanceId: session.instanceId,
			agentId,
			result: { error },
		});
	}

	async release(agentId: string): Promise<void> {
		await this.store.delete(agentId);
	}

	async getAvailable(role: string): Promise<AgentHandle | null> {
		const sessions = await this.store.findByRole(role);
		const available = sessions.find((s) => s.status === "idle");
		return available ? this.toHandle(available) : null;
	}

	async getActive(): Promise<AgentHandle[]> {
		const sessions = await this.store.findActive();
		return sessions.map((s) => this.toHandle(s));
	}

	private toHandle(session: AgentSession): AgentHandle {
		return {
			agentId: session.agentId,
			role: session.role,
			task: session.task,
			status: session.status,
			spawnedAt: session.spawnedAt,
			completedAt: session.completedAt,
			result: session.result,
		};
	}
}

// Singleton
export const agentPool = new StandardAgentPool();
