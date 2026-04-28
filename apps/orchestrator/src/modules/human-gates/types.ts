// Human Gates - Types and Interfaces
import type { ApprovalGateDefinition, ApprovalRequest, ApprovalStatus, GateType } from "../../core/types.js";

export { ApprovalStatus, GateType };

export interface ApprovalGateService {
	createRequest(
		instanceId: string,
		gate: ApprovalGateDefinition,
		context: Record<string, unknown>
	): Promise<ApprovalRequest>;

	approve(requestId: string, approverId: string, notes?: string): Promise<void>;

	reject(requestId: string, approverId: string, reason: string): Promise<void>;

	getPending(approverId?: string): Promise<ApprovalRequest[]>;

	getByInstance(instanceId: string): Promise<ApprovalRequest[]>;

	expireStaleRequests(): Promise<void>;
}

export interface NotificationChannel {
	type: "email" | "webhook" | "push";
	config: Record<string, unknown>;
}

export interface NotificationService {
	sendApprovalRequest(request: ApprovalRequest): Promise<void>;

	sendReminder(request: ApprovalRequest): Promise<void>;

	sendApprovalNotification(
		request: ApprovalRequest,
		outcome: "approved" | "rejected",
		notes?: string
	): Promise<void>;
}

export interface ApprovalStore {
	save(request: ApprovalRequest): Promise<void>;

	update(requestId: string, updates: Partial<ApprovalRequest>): Promise<void>;

	findById(requestId: string): Promise<ApprovalRequest | null>;

	findByInstance(instanceId: string): Promise<ApprovalRequest[]>;

	findPending(approverId?: string): Promise<ApprovalRequest[]>;

	findExpired(): Promise<ApprovalRequest[]>;
}
