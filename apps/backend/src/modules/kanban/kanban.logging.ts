/**
 * Kanban Module — Structured Logging Events
 * Integration point for observability and audit trails
 */

export interface KanbanLogEvent {
  eventType: string;
  timestamp: Date;
  usuarioId: string;
  boardId?: string;
  cardId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log events for Kanban operations
 */
export const kanbanLogEvents = {
  /**
   * Emitted when: New kanban board is created
   * Used for: Audit trail, notifications
   */
  BOARD_CREATED: (
    boardId: string,
    nome: string,
    setor: string,
    usuarioId: string
  ): KanbanLogEvent => ({
    eventType: "kanban.board.created",
    timestamp: new Date(),
    usuarioId,
    boardId,
    metadata: { nome, setor },
  }),

  /**
   * Emitted when: Card is moved between columns
   * Used for: Workflow tracking, SLA calculations
   */
  CARD_MOVED: (
    cardId: string,
    boardId: string,
    fromColuna: string,
    toColuna: string,
    usuarioId: string
  ): KanbanLogEvent => ({
    eventType: "kanban.card.moved",
    timestamp: new Date(),
    usuarioId,
    boardId,
    cardId,
    metadata: { fromColuna, toColuna },
  }),

  /**
   * Emitted when: Card is assigned to a user
   * Used for: Notifications, workload tracking
   */
  CARD_ASSIGNED: (
    cardId: string,
    boardId: string,
    fromUser: string | null,
    toUser: string,
    usuarioId: string
  ): KanbanLogEvent => ({
    eventType: "kanban.card.assigned",
    timestamp: new Date(),
    usuarioId,
    boardId,
    cardId,
    metadata: { fromUser, toUser },
  }),

  /**
   * Emitted when: Board is viewed
   * Used for: Usage analytics, engagement metrics
   */
  BOARD_VIEWED: (
    boardId: string,
    usuarioId: string
  ): KanbanLogEvent => ({
    eventType: "kanban.board.viewed",
    timestamp: new Date(),
    usuarioId,
    boardId,
    metadata: {},
  }),
};

/**
 * Integration with observability platform
 * Currently configured for: stdout, file rotation, external sink (optional)
 */
export function logKanbanEvent(event: KanbanLogEvent): void {
  const logEntry = {
    timestamp: event.timestamp.toISOString(),
    event: event.eventType,
    userId: event.usuarioId,
    boardId: event.boardId || null,
    cardId: event.cardId || null,
    ...event.metadata,
  };

  console.log("[KANBAN]", JSON.stringify(logEntry));

  // TODO: Send to observability platform (DataDog, New Relic, etc)
  // observability.send(event);
}
