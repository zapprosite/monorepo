// Notification Service - Sends notifications for approval requests
import type { ApprovalRequest } from "../../core/types.js";
import type { NotificationService } from "./types.js";

export class WebhookNotificationService implements NotificationService {
	constructor(private webhookUrl: string) {}

	async sendApprovalRequest(request: ApprovalRequest): Promise<void> {
		// In production, this would call a webhook or send an email
		console.log(`[Notification] Approval request: ${request.gateId}`);
		console.log(`[Notification] Instance: ${request.instanceId}`);
		console.log(`[Notification] Timeout: ${new Date(request.timeoutAt).toISOString()}`);
		console.log(`[Notification] Payload:`, request.payload);

		// Example webhook payload structure
		const payload = {
			type: "approval_request",
			requestId: request.requestId,
			gateId: request.gateId,
			gateType: request.gateType,
			instanceId: request.instanceId,
			prompt: this.buildPrompt(request),
			timeoutAt: new Date(request.timeoutAt).toISOString(),
			createdAt: new Date(request.createdAt).toISOString(),
		};

		// In full implementation, POST to webhookUrl
		// await fetch(this.webhookUrl, {
		//   method: 'POST',
		//   headers: { 'Content-Type': 'application/json' },
		//   body: JSON.stringify(payload),
		// });
	}

	async sendReminder(request: ApprovalRequest): Promise<void> {
		console.log(`[Notification] Reminder for request: ${request.requestId}`);
	}

	async sendApprovalNotification(
		request: ApprovalRequest,
		outcome: "approved" | "rejected",
		notes?: string
	): Promise<void> {
		console.log(`[Notification] Request ${request.requestId}: ${outcome}`);
		if (notes) {
			console.log(`[Notification] Notes: ${notes}`);
		}
	}

	private buildPrompt(request: ApprovalRequest): string {
		// Build a human-readable prompt from the approval gate
		const payload = request.payload as Record<string, unknown>;
		const lines = [
			`Approval Required: ${request.gateId}`,
			`Type: ${request.gateType}`,
			"",
		];

		// Add relevant context from payload
		for (const [key, value] of Object.entries(payload)) {
			if (value !== undefined && value !== null) {
				lines.push(`${key}: ${JSON.stringify(value)}`);
			}
		}

		return lines.join("\n");
	}
}
