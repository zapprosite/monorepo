// State Machine for Workflow Execution
import type { WorkflowState, WorkflowStatus, WorkflowEvent } from "./types.js";

type StateTransition = {
	from: WorkflowStatus;
	to: WorkflowStatus;
	event: WorkflowEvent["type"];
};

const VALID_TRANSITIONS: StateTransition[] = [
	{ from: "pending", to: "running", event: "workflow.started" },
	{ from: "running", to: "waiting_approval", event: "workflow.waiting_approval" },
	{ from: "running", to: "completed", event: "workflow.completed" },
	{ from: "running", to: "failed", event: "workflow.failed" },
	{ from: "running", to: "paused", event: "workflow.paused" },
	{ from: "waiting_approval", to: "running", event: "workflow.resumed" },
	{ from: "waiting_approval", to: "completed", event: "workflow.approved" },
	{ from: "waiting_approval", to: "failed", event: "workflow.rejected" },
	{ from: "waiting_approval", to: "cancelled", event: "workflow.failed" },
	{ from: "paused", to: "running", event: "workflow.resumed" },
	{ from: "paused", to: "cancelled", event: "workflow.failed" },
];

export class WorkflowStateMachine {
	private state: WorkflowState;

	constructor(initialState: WorkflowState) {
		this.state = initialState;
	}

	getState(): WorkflowState {
		return this.state;
	}

	canTransition(event: WorkflowEvent["type"]): boolean {
		return VALID_TRANSITIONS.some(
			(t) => t.from === this.state.status && t.event === event
		);
	}

	transition(event: WorkflowEvent): WorkflowState {
		const eventType = event.type;
		const transition = VALID_TRANSITIONS.find(
			(t) => t.from === this.state.status && t.event === eventType
		);

		if (!transition) {
			throw new Error(
				`Invalid transition: ${this.state.status} + ${eventType}`
			);
		}

		this.state = {
			...this.state,
			status: transition.to,
			updatedAt: Date.now(),
		};

		// Handle specific event payloads
		switch (eventType) {
			case "workflow.phase.completed":
				this.state.currentPhase = event.phase;
				break;
			case "workflow.failed":
				this.state.error = event.error;
				break;
			case "workflow.completed":
				this.state.completedAt = Date.now();
				break;
		}

		return this.state;
	}

	isTerminal(): boolean {
		return ["completed", "failed", "cancelled"].includes(this.state.status);
	}

	isWaitingForApproval(): boolean {
		return this.state.status === "waiting_approval";
	}

	getCurrentPhase(): string {
		return this.state.currentPhase;
	}

	updateContext(key: string, value: unknown): void {
		this.state.context[key] = value;
		this.state.updatedAt = Date.now();
	}

	getContext(): Record<string, unknown> {
		return this.state.context;
	}
}

export function createInitialState(
	workflowId: string,
	instanceId: string,
	name: string,
	version: string
): WorkflowState {
	return {
		workflowId,
		instanceId,
		name,
		version,
		status: "pending",
		currentPhase: "",
		currentStep: 0,
		context: {},
		startedAt: Date.now(),
		updatedAt: Date.now(),
	};
}
