// Workflow Engine - Loads YAML and Executes Workflows
import { parse } from "yaml";
import { readFile } from "fs/promises";
import { join } from "path";
import type {
	WorkflowDefinition,
	WorkflowState,
	PhaseDefinition,
	StepDefinition,
	WorkflowEvent,
} from "./types.js";
import { WorkflowStateMachine, createInitialState } from "./state-machine.js";
import { globalEventBus } from "./event-bus.js";

export interface WorkflowExecutor {
	load(workflowPath: string): Promise<WorkflowDefinition>;
	execute(workflow: WorkflowDefinition, initialContext?: Record<string, unknown>): Promise<WorkflowState>;
	pause(instanceId: string): void;
	resume(instanceId: string): void;
}

export class OrchestratorEngine implements WorkflowExecutor {
	private machines: Map<string, WorkflowStateMachine> = new Map();
	private workflows: Map<string, WorkflowDefinition> = new Map();

	async load(workflowPath: string): Promise<WorkflowDefinition> {
		const content = await readFile(workflowPath, "utf-8");
		const workflow = parse(content) as WorkflowDefinition;

		if (!workflow.name || !workflow.phases) {
			throw new Error("Invalid workflow: missing name or phases");
		}

		this.workflows.set(workflow.name, workflow);
		return workflow;
	}

	async loadFromString(yamlContent: string): Promise<WorkflowDefinition> {
		const workflow = parse(yamlContent) as WorkflowDefinition;

		if (!workflow.name || !workflow.phases) {
			throw new Error("Invalid workflow: missing name or phases");
		}

		this.workflows.set(workflow.name, workflow);
		return workflow;
	}

	async execute(
		workflow: WorkflowDefinition,
		initialContext: Record<string, unknown> = {}
	): Promise<WorkflowState> {
		const instanceId = crypto.randomUUID();
		const machine = new WorkflowStateMachine(
			createInitialState(workflow.name, instanceId, workflow.name, workflow.version)
		);

		// Initialize context with workflow variables and initial context
		for (const [key, value] of Object.entries(workflow.variables || {})) {
			machine.updateContext(key, this.interpolate(value, initialContext));
		}
		for (const [key, value] of Object.entries(initialContext)) {
			machine.updateContext(key, value);
		}

		this.machines.set(instanceId, machine);

		// Emit started event
		globalEventBus.emit({
			type: "workflow.started",
			instanceId,
			timestamp: Date.now(),
		});

		// Start execution
		try {
			const result = await this.executePhases(machine, workflow.phases, instanceId);
			machine.transition({ type: "workflow.completed", instanceId, result });
			globalEventBus.emit({
				type: "workflow.completed",
				instanceId,
				result,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			machine.transition({
				type: "workflow.failed",
				instanceId,
				error: errorMessage,
			});
			globalEventBus.emit({
				type: "workflow.failed",
				instanceId,
				error: errorMessage,
			});
		}

		return machine.getState();
	}

	private async executePhases(
		machine: WorkflowStateMachine,
		phases: PhaseDefinition[],
		instanceId: string
	): Promise<unknown> {
		for (const phase of phases) {
			// Check condition if defined
			if (phase.condition && !this.evaluateCondition(phase.condition, machine.getContext())) {
				continue;
			}

			machine.transition({
				type: "workflow.phase.started",
				instanceId,
				phase: phase.name,
			});
			globalEventBus.emit({
				type: "workflow.phase.started",
				instanceId,
				phase: phase.name,
			});

			// Check if approval gate is required
			if (phase.approvalGate) {
				machine.transition({
					type: "workflow.waiting_approval",
					instanceId,
					phase: phase.name,
					gateId: phase.approvalGate.id,
				});
				globalEventBus.emit({
					type: "workflow.waiting_approval",
					instanceId,
					phase: phase.name,
					gateId: phase.approvalGate.id,
				});
				return { status: "waiting_approval", gateId: phase.approvalGate.id };
			}

			// Execute steps
			for (const step of phase.steps) {
				await this.executeStep(machine, step, instanceId);
			}

			machine.transition({
				type: "workflow.phase.completed",
				instanceId,
				phase: phase.name,
			});
			globalEventBus.emit({
				type: "workflow.phase.completed",
				instanceId,
				phase: phase.name,
			});
		}

		return { status: "completed" };
	}

	private async executeStep(
		machine: WorkflowStateMachine,
		step: StepDefinition,
		instanceId: string
	): Promise<void> {
		if (step.skill) {
			await this.executeSkill(machine, step.skill.name, step.skill.input, instanceId);
		} else if (step.agent) {
			await this.executeAgent(machine, step.agent.role, step.agent.task, instanceId);
		} else if (step.mcp) {
			await this.executeMcp(machine, step.mcp, instanceId);
		} else if (step.webhook) {
			await this.executeWebhook(machine, step.webhook, instanceId);
		}
	}

	private async executeSkill(
		machine: WorkflowStateMachine,
		skillName: string,
		input: Record<string, unknown> | undefined,
		instanceId: string
	): Promise<void> {
		globalEventBus.emit({
			type: "skill.invoked",
			instanceId,
			skillName,
		});

		// In a full implementation, this would invoke the skill system
		// For now, we emit the event and store context
		const result = { skillName, input, executedAt: Date.now() };
		machine.updateContext(`skills.${skillName}`, result);

		globalEventBus.emit({
			type: "skill.completed",
			instanceId,
			skillName,
			result,
		});
	}

	private async executeAgent(
		machine: WorkflowStateMachine,
		role: string,
		task: string,
		instanceId: string
	): Promise<void> {
		const agentId = crypto.randomUUID();

		globalEventBus.emit({
			type: "agent.spawned",
			instanceId,
			agentId,
			role,
		});

		// In a full implementation, this would spawn an agent
		const result = { role, task, agentId, executedAt: Date.now() };
		machine.updateContext(`agents.${role}`, result);

		globalEventBus.emit({
			type: "agent.completed",
			instanceId,
			agentId,
			result,
		});
	}

	private async executeMcp(
		machine: WorkflowStateMachine,
		mcp: NonNullable<StepDefinition["mcp"]>,
		instanceId: string
	): Promise<void> {
		globalEventBus.emit({
			type: "mcp.called",
			instanceId,
			provider: mcp.provider,
			tool: mcp.tool,
		});

		// In a full implementation, this would call the MCP adapter
		const result = {
			provider: mcp.provider,
			tool: mcp.tool,
			input: mcp.input,
			executedAt: Date.now(),
		};
		machine.updateContext(`mcp.${mcp.provider}.${mcp.tool}`, result);

		globalEventBus.emit({
			type: "mcp.response",
			instanceId,
			provider: mcp.provider,
			tool: mcp.tool,
			result,
		});
	}

	private async executeWebhook(
		machine: WorkflowStateMachine,
		webhook: NonNullable<StepDefinition["webhook"]>,
		instanceId: string
	): Promise<void> {
		globalEventBus.emit({
			type: "webhook.emitted",
			instanceId,
			url: webhook.url,
		});

		// In a full implementation, this would emit to the webhook queue
		const result = {
			url: webhook.url,
			payload: webhook.payload,
			emittedAt: Date.now(),
		};
		machine.updateContext(`webhooks.${webhook.url}`, result);
	}

	private interpolate(
		template: string,
		context: Record<string, unknown>
	): string {
		return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
			const value = this.getNestedValue(context, key);
			return String(value ?? `{{${key}}}`);
		});
	}

	private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
		return path.split(".").reduce((acc: unknown, key) => {
			if (acc && typeof acc === "object") {
				return (acc as Record<string, unknown>)[key];
			}
			return undefined;
		}, obj);
	}

	private evaluateCondition(
		condition: string,
		context: Record<string, unknown>
	): boolean {
		// Simple condition evaluation - in production use a proper expression evaluator
		// Supported: gate.{phase}.approved == true, phase.{name}.status == 'completed'
		if (condition.includes("gate.") && condition.includes(".approved")) {
			const gateMatch = condition.match(/gate\.(\w+)\.approved/);
			if (gateMatch) {
				const gateContext = this.getNestedValue(context, `gate.${gateMatch[1]}`);
				return gateContext === true;
			}
		}
		return true;
	}

	pause(instanceId: string): void {
		const machine = this.machines.get(instanceId);
		if (machine) {
			machine.transition({ type: "workflow.paused", instanceId });
			globalEventBus.emit({ type: "workflow.paused", instanceId });
		}
	}

	resume(instanceId: string): void {
		const machine = this.machines.get(instanceId);
		if (machine) {
			machine.transition({ type: "workflow.resumed", instanceId });
			globalEventBus.emit({ type: "workflow.resumed", instanceId });
		}
	}

	getInstance(instanceId: string): WorkflowState | undefined {
		return this.machines.get(instanceId)?.getState();
	}

	getWorkflow(name: string): WorkflowDefinition | undefined {
		return this.workflows.get(name);
	}
}
