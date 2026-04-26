// In-Memory Approval Store
// In production, replace with Orchid ORM database table
import type { ApprovalRequest, ApprovalStatus } from "../../core/types.js";
import type { ApprovalStore } from "./types.js";

export class InMemoryApprovalStore implements ApprovalStore {
	private requests: Map<string, ApprovalRequest> = new Map();

	async save(request: ApprovalRequest): Promise<void> {
		this.requests.set(request.requestId, request);
	}

	async update(requestId: string, updates: Partial<ApprovalRequest>): Promise<void> {
		const existing = this.requests.get(requestId);
		if (!existing) {
			throw new Error(`Approval request not found: ${requestId}`);
		}
		const updated = { ...existing, ...updates };
		this.requests.set(requestId, updated);
	}

	async findById(requestId: string): Promise<ApprovalRequest | null> {
		return this.requests.get(requestId) ?? null;
	}

	async findByInstance(instanceId: string): Promise<ApprovalRequest[]> {
		return Array.from(this.requests.values()).filter(
			(r) => r.instanceId === instanceId
		);
	}

	async findPending(approverId?: string): Promise<ApprovalRequest[]> {
		return Array.from(this.requests.values()).filter((r) => {
			if (r.status !== "pending") return false;
			if (r.timeoutAt < Date.now()) return false;
			if (approverId) {
				// Check if this request was assigned to the specific approver
				// Approver info is stored in payload from the gate definition
				const payload = r.payload as Record<string, unknown>;
				const approvers = payload.approvers as Array<{ userId?: string; role?: string }> | undefined;
				if (approvers) {
					return approvers.some((a) => a.userId === approverId);
				}
				return r.approverId === approverId;
			}
			return true;
		});
	}

	async findExpired(): Promise<ApprovalRequest[]> {
		return Array.from(this.requests.values()).filter(
			(r) => r.status === "pending" && r.timeoutAt < Date.now()
		);
	}
}

// Singleton instance
export const approvalStore = new InMemoryApprovalStore();
