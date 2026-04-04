// Event Bus for Workflow Orchestration
import type { WorkflowEvent } from "./types.js";

type EventHandler = (event: WorkflowEvent) => void | Promise<void>;

type Subscription = {
	handler: EventHandler;
	eventType?: string;
};

export class EventBus {
	private subscriptions: Map<string, Subscription[]> = new Map();
	private globalHandlers: EventHandler[] = [];

	emit(event: WorkflowEvent): void {
		// Call global handlers
		for (const handler of this.globalHandlers) {
			try {
				const result = handler(event);
				if (result instanceof Promise) {
					result.catch((err) => console.error("Event handler error:", err));
				}
			} catch (err) {
				console.error("Event handler error:", err);
			}
		}

		// Call type-specific handlers
		const handlers = this.subscriptions.get(event.type);
		if (handlers) {
			for (const { handler } of handlers) {
				try {
					const result = handler(event);
					if (result instanceof Promise) {
						result.catch((err) => console.error("Event handler error:", err));
					}
				} catch (err) {
					console.error("Event handler error:", err);
				}
			}
		}
	}

	subscribe(eventType: string, handler: EventHandler): () => void {
		const subscription: Subscription = { handler, eventType };
		const existing = this.subscriptions.get(eventType) || [];
		this.subscriptions.set(eventType, [...existing, subscription]);

		// Return unsubscribe function
		return () => {
			const handlers = this.subscriptions.get(eventType) || [];
			this.subscriptions.set(
				eventType,
				handlers.filter((h) => h.handler !== handler)
			);
		};
	}

	subscribeToAll(handler: EventHandler): () => void {
		this.globalHandlers.push(handler);
		return () => {
			this.globalHandlers = this.globalHandlers.filter((h) => h !== handler);
		};
	}

	clear(): void {
		this.subscriptions.clear();
		this.globalHandlers = [];
	}
}

// Singleton instance for global use
export const globalEventBus = new EventBus();
