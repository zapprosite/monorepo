// Approval Service Implementation
import type {
	ApprovalGateDefinition,
	ApprovalRequest,
	WorkflowEvent,
} from "../../core/types.js";
import { globalEventBus } from "../../core/event-bus.js";
import type { ApprovalGateService, NotificationService } from "./types.js";
import { approvalStore } from "./approval-store.js";

export class ApprovalGateServiceImpl implements ApprovalGateService {
	constructor(private notificationService?: NotificationService) {}

	async createRequest(
		instanceId: string,
		gate: ApprovalGateDefinition,
		context: Record<string, unknown>
	): Promise<ApprovalRequest> {
		const request: ApprovalRequest = {
			requestId: crypto.randomUUID(),
			instanceId,
			gateId: gate.id,
			gateType: gate.type,
			status: "pending",
			requestedBy: "system",
			payload: context,
			timeoutAt: Date.now() + gate.timeout * 1000,
			createdAt: Date.now(),
		};

		await approvalStore.save(request);

		// Emit event
		globalEventBus.emit({
			type: "workflow.waiting_approval",
			instanceId,
			phase: gate.id,
			gateId: gate.id,
		} as WorkflowEvent);

		// Send notification if configured
		if (this.notificationService) {
			await this.notificationService.sendApprovalRequest(request);
		}

		return request;
	}

	async approve(
		requestId: string,
		approverId: string,
		notes?: string
	): Promise<void> {
		const request = await approvalStore.findById(requestId);
		if (!request) {
			throw new Error(`Approval request not found: ${requestId}`);
		}

		if (request.status !== "pending") {
			throw new Error(`Request is not pending: ${requestId}`);
		}

		await approvalStore.update(requestId, {
			status: "approved",
			approverId,
			notes,
			respondedAt: Date.now(),
		});

		// Emit approval event
		globalEventBus.emit({
			type: "workflow.approved",
			instanceId: request.instanceId,
			gateId: request.gateId,
			approverId,
		} as WorkflowEvent);

		// Send notification
		if (this.notificationService) {
			await this.notificationService.sendApprovalNotification(
				request,
				"approved",
				notes
			);
		}
	}

	async reject(
		requestId: string,
		approverId: string,
		reason: string
	): Promise<void> {
		const request = await approvalStore.findById(requestId);
		if (!request) {
			throw new Error(`Approval request not found: ${requestId}`);
		}

		if (request.status !== "pending") {
			throw new Error(`Request is not pending: ${requestId}`);
		}

		await approvalStore.update(requestId, {
			status: "rejected",
			approverId,
			notes: reason,
			respondedAt: Date.now(),
		});

		// Emit rejection event
		globalEventBus.emit({
			type: "workflow.rejected",
			instanceId: request.instanceId,
			gateId: request.gateId,
			approverId,
			reason,
		} as WorkflowEvent);

		// Send notification
		if (this.notificationService) {
			await this.notificationService.sendApprovalNotification(
				request,
				"rejected",
				reason
			);
		}
	}

	async getPending(approverId?: string): Promise<ApprovalRequest[]> {
		return approvalStore.findPending(approverId);
	}

	async getByInstance(instanceId: string): Promise<ApprovalRequest[]> {
		return approvalStore.findByInstance(instanceId);
	}

	async expireStaleRequests(): Promise<void> {
		const expired = await approvalStore.findExpired();

		for (const request of expired) {
			await approvalStore.update(request.requestId, {
				status: "expired",
				respondedAt: Date.now(),
			});

			// Emit expiration event
			globalEventBus.emit({
				type: "workflow.failed",
				instanceId: request.instanceId,
				error: `Approval request expired: ${request.gateId}`,
			} as WorkflowEvent);
		}
	}
}
