/**
 * Webhook Queue Utilities
 *
 * This module handles sending webhooks with Bearer token authentication.
 * Includes Dead Letter Queue (DLQ) for failed webhooks and structured logging.
 *
 * ## Webhook Authentication Guide for Consumers
 *
 * All outgoing webhooks include an `Authorization` header with a Bearer token:
 * - `Authorization: Bearer <your-token>`
 */

import { logger } from "@backend/app";
import { sql } from "@backend/db/base_table";
import { db } from "@backend/db/db";
import type { SubscriptionAlertWebhookPayload } from "@connected-repo/zod-schemas/webhook_call_queue.zod";
import axios, { type AxiosError } from "axios";
import { WEBHOOK_BATCH_PROCESSING_LIMIT } from "../constants/apiGateway.constants";

/**
 * Structured log for webhook events
 */
function logWebhookEvent(
	level: "info" | "warn" | "error",
	event: string,
	data: {
		webhookId?: string;
		teamId?: string;
		url?: string;
		attempt?: number;
		maxAttempts?: number;
		status?: number;
		error?: string;
		duration?: number;
	},
) {
	logger[level](
		{
			event: `webhook_queue:${event}`,
			webhookId: data.webhookId,
			teamId: data.teamId,
			url: data.url ? `***` : undefined, // Mask URL for security
			attempt: data.attempt,
			maxAttempts: data.maxAttempts,
			status: data.status,
			error: data.error,
			duration: data.duration,
		},
		`Webhook queue: ${event}`,
	);
}

/**
 * Send a webhook via HTTP POST using axios
 * @param url - The webhook URL
 * @param payload - The payload to send
 * @param bearerToken - The bearer token for authentication (optional)
 * @param timeoutMs - Request timeout in milliseconds (default: 3000)
 * @returns Response status and data
 */
export async function sendWebhook(
	url: string,
	payload: SubscriptionAlertWebhookPayload,
	bearerToken?: string,
	timeoutMs = 3000,
): Promise<{ success: boolean; status?: number; error?: string }> {
	const startTime = Date.now();

	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"User-Agent": "API-Gateway-Webhook/1.0",
		};

		// Add Authorization header if bearer token is provided
		if (bearerToken) {
			headers.Authorization = `Bearer ${bearerToken}`;
		}

		const response = await axios.post(url, payload, {
			headers,
			timeout: timeoutMs,
			validateStatus: (status) => status >= 200 && status < 300,
		});

		const duration = Date.now() - startTime;

		logWebhookEvent("info", "send_success", {
			url,
			status: response.status,
			duration,
		});

		return {
			success: true,
			status: response.status,
		};
	} catch (error) {
		const duration = Date.now() - startTime;
		const axiosError = error as AxiosError;

		let errorMessage: string;
		let status: number | undefined;

		if (axiosError.response) {
			// Server responded with error status
			status = axiosError.response.status;
			errorMessage = `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`;
		} else if (axiosError.request) {
			// Request made but no response received
			errorMessage =
				axiosError.code === "ECONNABORTED" ? "Request timeout" : "No response from server";
		} else {
			// Error setting up the request
			errorMessage = axiosError.message || "Unknown error occurred";
		}

		logWebhookEvent("warn", "send_failure", {
			url,
			status,
			error: errorMessage,
			duration,
		});

		return {
			success: false,
			status,
			error: errorMessage,
		};
	}
}

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempt: number): number {
	// Exponential backoff: 2^attempt * 1000ms
	// Attempt 0: 1s, Attempt 1: 2s, Attempt 2: 4s
	return 2 ** attempt * 1000;
}

/**
 * Process all pending webhooks in the queue
 * Handles retry logic with exponential backoff and DLQ for permanently failed webhooks
 */
export async function processWebhookQueue() {
	// Get pending webhooks that are ready to be processed
	const pendingWebhooks = await db.webhookCallQueues
		.where({
			status: "Pending",
			scheduledFor: { lt: sql`NOW()` },
			attempts: { lt: sql`"max_attempts"` },
		})
		.order({ scheduledFor: "ASC" })
		.limit(WEBHOOK_BATCH_PROCESSING_LIMIT);

	const results = {
		processed: 0,
		succeeded: 0,
		failed: 0,
		retried: 0,
		deadLettered: 0,
	};

	logWebhookEvent("info", "batch_start", {
		webhookId: `batch:${pendingWebhooks.length} webhooks`,
	});

	for (const webhook of pendingWebhooks) {
		results.processed++;

		logWebhookEvent("info", "processing", {
			webhookId: webhook.webhookCallQueueId,
			teamId: webhook.teamId,
			url: webhook.webhookUrl,
			attempt: webhook.attempts + 1,
			maxAttempts: webhook.maxAttempts,
		});

		// Fetch team webhook bearer token (optional)
		const team = await db.teams
			.select("subscriptionAlertWebhookBearerToken")
			.find(webhook.teamId);

		// Send webhook with bearer token (if configured)
		const result = await sendWebhook(
			webhook.webhookUrl,
			webhook.payload as SubscriptionAlertWebhookPayload,
			team?.subscriptionAlertWebhookBearerToken || undefined,
		);

		// Increment attempt count
		const newAttempts = webhook.attempts + 1;

		if (result.success) {
			// Mark as sent
			await db.webhookCallQueues.find(webhook.webhookCallQueueId).update({
				status: "Sent",
				lastAttemptAt: () => sql`NOW()`,
				sentAt: () => sql`NOW()`,
				errorMessage: null,
			}).increment("attempts");

			logWebhookEvent("info", "sent", {
				webhookId: webhook.webhookCallQueueId,
				teamId: webhook.teamId,
				attempt: newAttempts,
				status: result.status,
			});

			results.succeeded++;
		} else {
			// Check if we should retry
			if (newAttempts < webhook.maxAttempts) {
				// Schedule retry with exponential backoff
				const backoffMs = calculateBackoff(newAttempts);

				await db.webhookCallQueues.find(webhook.webhookCallQueueId).update({
					lastAttemptAt: () => sql`NOW()`,
					scheduledFor: () => sql`NOW() + INTERVAL '${backoffMs} milliseconds'`,
					errorMessage: result.error || "Unknown error",
				}).increment("attempts");

				logWebhookEvent("warn", "retry_scheduled", {
					webhookId: webhook.webhookCallQueueId,
					teamId: webhook.teamId,
					attempt: newAttempts,
					maxAttempts: webhook.maxAttempts,
					error: result.error,
				});

				results.retried++;
			} else {
				// Max attempts reached, move to Dead Letter Queue
				await db.webhookCallQueues.find(webhook.webhookCallQueueId).update({
					status: "DeadLetter",
					lastAttemptAt: () => sql`NOW()`,
					errorMessage: result.error || "Max retry attempts exceeded",
				}).increment("attempts");

				logWebhookEvent("error", "dead_lettered", {
					webhookId: webhook.webhookCallQueueId,
					teamId: webhook.teamId,
					attempt: newAttempts,
					maxAttempts: webhook.maxAttempts,
					error: result.error,
				});

				results.deadLettered++;
				results.failed++;
			}
		}
	}

	logWebhookEvent("info", "batch_complete", {
		webhookId: `batch:${results.processed} processed`,
	});

	return results;
}

/**
 * Get all webhooks in the Dead Letter Queue (DLQ)
 * Use this for inspection and manual retry/reprocessing
 */
export async function getDeadLetterQueue(): Promise<
	Array<{
		webhookCallQueueId: string;
		teamId: string;
		webhookUrl: string;
		payload: unknown;
		attempts: number;
		maxAttempts: number;
		lastAttemptAt: Date | null;
		scheduledFor: Date;
		errorMessage: string | null;
		createdAt: Date;
	}>
> {
	const dlqWebhooks = await db.webhookCallQueues
		.where({ status: "DeadLetter" })
		.order({ lastAttemptAt: "DESC" });

	logWebhookEvent("info", "dlq_fetched", {
		webhookId: `count:${dlqWebhooks.length} dead-lettered webhooks`,
	});

	return dlqWebhooks;
}

/**
 * Retry a specific webhook from the DLQ by moving it back to Pending
 * Resets attempts to 0 so it goes through the full retry cycle again
 */
export async function retryFromDeadLetter(webhookCallQueueId: string): Promise<{
	success: boolean;
	error?: string;
}> {
	const webhook = await db.webhookCallQueues.find(webhookCallQueueId);

	if (!webhook) {
		logWebhookEvent("error", "dlq_retry_not_found", {
			webhookId: webhookCallQueueId,
		});
		return { success: false, error: "Webhook not found" };
	}

	if (webhook.status !== "DeadLetter") {
		logWebhookEvent("warn", "dlq_retry_invalid_status", {
			webhookId: webhookCallQueueId,
			status: webhook.status as string,
		});
		return { success: false, error: `Webhook is not in DeadLetter status: ${webhook.status}` };
	}

	// Reset attempts and move back to Pending
	await db.webhookCallQueues.find(webhookCallQueueId).update({
		status: "Pending",
		scheduledFor: () => sql`NOW()`,
		errorMessage: null,
	});

	logWebhookEvent("info", "dlq_retry_initiated", {
		webhookId: webhookCallQueueId,
		teamId: webhook.teamId,
	});

	return { success: true };
}

/**
 * Permanently discard a webhook from the DLQ (mark as Failed, not recoverable)
 */
export async function discardDeadLetter(webhookCallQueueId: string): Promise<{
	success: boolean;
	error?: string;
}> {
	const webhook = await db.webhookCallQueues.find(webhookCallQueueId);

	if (!webhook) {
		logWebhookEvent("error", "dlq_discard_not_found", {
			webhookId: webhookCallQueueId,
		});
		return { success: false, error: "Webhook not found" };
	}

	if (webhook.status !== "DeadLetter") {
		logWebhookEvent("warn", "dlq_discard_invalid_status", {
			webhookId: webhookCallQueueId,
			status: webhook.status as string,
		});
		return { success: false, error: `Webhook is not in DeadLetter status: ${webhook.status}` };
	}

	// Mark as Failed (not DeadLetter) to indicate it's been reviewed and discarded
	await db.webhookCallQueues.find(webhookCallQueueId).update({
		status: "Failed",
	});

	logWebhookEvent("info", "dlq_discarded", {
		webhookId: webhookCallQueueId,
		teamId: webhook.teamId,
	});

	return { success: true };
}
