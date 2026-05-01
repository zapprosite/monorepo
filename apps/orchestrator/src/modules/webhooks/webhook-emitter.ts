// Webhook Emitter - Event emission with retry logic
import { globalEventBus } from "../../core/event-bus.js";
import type { WorkflowEvent } from "../../core/types.js";

export interface WebhookDelivery {
	url: string;
	payload: Record<string, unknown>;
	headers?: Record<string, string>;
	secret?: string; // For HMAC signature
}

export interface WebhookCallback {
	url: string;
	headers?: Record<string, string>;
	secret?: string;
	retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
	maxAttempts: number;
	backoffMs: number;
	backoffMultiplier: number;
}

interface QueuedDelivery extends WebhookDelivery {
	deliveryId: string;
	attempt: number;
	scheduledFor: number;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
	maxAttempts: 3,
	backoffMs: 1000,
	backoffMultiplier: 2,
};

export class WebhookEmitter {
	private queue: QueuedDelivery[] = [];
	private callbacks: Map<string, WebhookCallback> = new Map();

	async emit(
		event: WorkflowEvent,
		callback?: WebhookCallback
	): Promise<string> {
		const deliveryId = crypto.randomUUID();

		// Store callback if provided
		if (callback) {
			this.callbacks.set(deliveryId, callback);
		}

		// Emit event to internal bus
		globalEventBus.emit({
			...event,
		});

		// Queue webhook delivery if URL is configured
		// In production, this would check workflow configuration
		console.log(`[Webhook] Event emitted: ${event.type}`, {
			deliveryId,
			hasCallback: !!callback,
		});

		return deliveryId;
	}

	async emitWebhook(delivery: WebhookDelivery): Promise<string> {
		const deliveryId = crypto.randomUUID();

		const queued: QueuedDelivery = {
			...delivery,
			deliveryId,
			attempt: 0,
			scheduledFor: Date.now(),
		};

		this.queue.push(queued);

		// Process queue asynchronously
		this.processQueue();

		return deliveryId;
	}

	private async processQueue(): Promise<void> {
		const now = Date.now();

		for (const delivery of this.queue) {
			if (delivery.scheduledFor > now) continue;

			try {
				await this.sendWebhook(delivery);
				// Remove from queue on success
				this.queue = this.queue.filter((d) => d.deliveryId !== delivery.deliveryId);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				console.error(`[Webhook] Delivery failed: ${delivery.deliveryId}`, errorMessage);

				// Check retry policy
				if (delivery.attempt < (DEFAULT_RETRY_POLICY.maxAttempts - 1)) {
					const backoff =
						DEFAULT_RETRY_POLICY.backoffMs *
						Math.pow(DEFAULT_RETRY_POLICY.backoffMultiplier, delivery.attempt);
					delivery.scheduledFor = Date.now() + backoff;
					delivery.attempt++;
				} else {
					// Max retries reached, remove from queue
					console.error(`[Webhook] Max retries reached for: ${delivery.deliveryId}`);
					this.queue = this.queue.filter((d) => d.deliveryId !== delivery.deliveryId);
				}
			}
		}
	}

	private async sendWebhook(delivery: QueuedDelivery): Promise<void> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...delivery.headers,
		};

		// Add HMAC signature if secret is configured
		if (delivery.secret) {
			const signature = this.computeHmacSignature(
				JSON.stringify(delivery.payload),
				delivery.secret
			);
			headers["X-Webhook-Signature"] = `sha256=${signature}`;
		}

		// In production, use fetch
		// const response = await fetch(delivery.url, {
		//   method: 'POST',
		//   headers,
		//   body: JSON.stringify(delivery.payload),
		// });

		console.log(`[Webhook] Sending to ${delivery.url}`, {
			deliveryId: delivery.deliveryId,
			attempt: delivery.attempt + 1,
		});

		// Mock successful delivery
		return Promise.resolve();
	}

	private computeHmacSignature(payload: string, secret: string): string {
		// In production, use crypto.createHmac
		// For now, return a mock signature
		return "mock-signature-" + Buffer.from(payload).toString("base64").slice(0, 32);
	}

	// Handle incoming webhook callback
	async processCallback(
		callbackId: string,
		payload: unknown
	): Promise<void> {
		const callback = this.callbacks.get(callbackId);
		if (!callback) {
			console.warn(`[Webhook] Callback not found: ${callbackId}`);
			return;
		}

		// Emit callback event
		globalEventBus.emit({
			type: "webhook.callback",
			instanceId: callbackId,
			payload,
		} as WorkflowEvent);

		// Remove callback after processing
		this.callbacks.delete(callbackId);
	}

	getQueueStatus(): { pending: number; processing: number } {
		const now = Date.now();
		const pending = this.queue.filter((d) => d.scheduledFor > now).length;
		const processing = this.queue.filter((d) => d.scheduledFor <= now).length;
		return { pending, processing };
	}
}

// Singleton
export const webhookEmitter = new WebhookEmitter();
