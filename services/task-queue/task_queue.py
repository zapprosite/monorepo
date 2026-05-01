"""
Task Queue — Redis-backed priority queue for Hermes sub-agents.
Part of SPEC-POLYMER-006 multi-agent architecture.

Priority levels:
    EMERGENCY = 0  (immediate, bypasses rate limits)
    SÊNIOR    = 1  (important, high priority)
    JUNIOR    = 2  (normal operations)
    DEV       = 3  (background/development)
"""
import json
import time
import uuid
import heapq
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Optional, Any
import redis


class Priority(IntEnum):
    EMERGENCY = 0
    SENIOR = 1
    JUNIOR = 2
    DEV = 3


PRIORITY_NAMES = {
    0: "EMERGENCY",
    1: "SÊNIOR",
    2: "JUNIOR",
    3: "DEV",
}

# Agent routing
AGENT_FOR_PRIORITY = {
    Priority.EMERGENCY: ["security", "backup"],
    Priority.SENIOR: ["sre", "docs", "backup"],
    Priority.JUNIOR: ["sre", "dev", "docs", "backup"],
    Priority.DEV: ["dev"],
}


@dataclass
class Task:
    id: str
    description: str
    priority: int  # Lower = higher priority
    agent: Optional[str]  # Target agent, or None for auto-route
    mode: str = "JUNIOR"
    payload: dict = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    enqueued_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    status: str = "pending"  # pending, queued, processing, completed, failed

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "description": self.description,
            "priority": self.priority,
            "agent": self.agent,
            "mode": self.mode,
            "payload": self.payload,
            "created_at": self.created_at,
            "enqueued_at": self.enqueued_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "result": self.result,
            "error": self.error,
            "status": self.status,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Task":
        return cls(
            id=d["id"],
            description=d["description"],
            priority=d["priority"],
            agent=d.get("agent"),
            mode=d.get("mode", "JUNIOR"),
            payload=d.get("payload", {}),
            created_at=d.get("created_at", time.time()),
            enqueued_at=d.get("enqueued_at", time.time()),
            started_at=d.get("started_at"),
            completed_at=d.get("completed_at"),
            result=d.get("result"),
            error=d.get("error"),
            status=d.get("status", "pending"),
        )


@dataclass(order=False)
class QueuedTask:
    """Wrapper for heap queue ordering."""
    task: Task
    sequence: int  # Tiebreaker for same priority

    def __lt__(self, other: "QueuedTask") -> bool:
        if self.task.priority != other.task.priority:
            return self.task.priority < other.task.priority
        return self.sequence < other.sequence


class TaskQueue:
    """
    Redis-backed priority queue for task distribution.
    
    Usage:
        q = TaskQueue()
        task_id = q.enqueue("check docker", priority=Priority.JUNIOR, agent="sre")
        task = q.dequeue(agent="sre", timeout=5)
    """

    def __init__(
        self,
        redis_host: str = "localhost",
        redis_port: int = 6379,
        redis_db: int = 0,
        redis_password: str = None,
        queue_key: str = "hermes:tasks",
        results_key: str = "hermes:task_results",
        default_timeout: int = 3600,
    ):
        self.redis_host = redis_host
        self.redis_port = redis_port
        self.redis_db = redis_db
        self.redis_password = redis_password
        self.queue_key = queue_key
        self.results_key = results_key
        self.default_timeout = default_timeout
        self._redis: Optional[redis.Redis] = None
        self._sequence = 0
        self._seq_lock = __import__('threading').Lock()

    @property
    def redis(self) -> redis.Redis:
        """Lazy Redis connection."""
        if self._redis is None:
            self._redis = redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                db=self.redis_db,
                password=self.redis_password,
                decode_responses=True,
            )
        return self._redis

    def _get_next_sequence(self) -> int:
        with self._seq_lock:
            self._sequence += 1
            return self._sequence

    def enqueue(
        self,
        description: str,
        priority: int = Priority.JUNIOR,
        agent: Optional[str] = None,
        mode: str = "JUNIOR",
        payload: dict = None,
        task_id: str = None,
    ) -> str:
        """
        Add task to queue.
        
        Args:
            description: Human-readable task description
            priority: Priority level (0=EMERGENCY, 3=DEV)
            agent: Target agent name, or None for auto-route
            mode: Operation mode (DEV/JUNIOR/SÊNIOR/EMERGENCY)
            payload: Additional task data
            task_id: Optional explicit task ID
        
        Returns:
            Task ID string
        """
        task_id = task_id or str(uuid.uuid4())[:8]
        
        task = Task(
            id=task_id,
            description=description,
            priority=priority,
            agent=agent,
            mode=mode,
            payload=payload or {},
            enqueued_at=time.time(),
            status="queued",
        )
        
        # Store task details in Redis hash
        self.redis.hset(
            f"{self.results_key}:{task_id}",
            mapping={k: json.dumps(v) for k, v in task.to_dict().items()}
        )
        self.redis.expire(f"{self.results_key}:{task_id}", self.default_timeout)
        
        # Add to priority queue
        queued = QueuedTask(task=task, sequence=self._get_next_sequence())
        heapq.heappush(self._get_queue(), (queued.task.priority, queued.sequence, task_id))
        
        return task_id

    def dequeue(self, agent: str, timeout: int = 5) -> Optional[Task]:
        """
        Block waiting for task for specified agent.
        
        Args:
            agent: Agent name to receive task
            timeout: Seconds to wait (default 5)
        
        Returns:
            Task object, or None if timeout
        """
        deadline = time.time() + timeout
        
        while time.time() < deadline:
            # Try to get a task from the queue
            queue = self._get_queue()
            items = list(heapq.nsmallest(100, queue))  # Check top 100
            
            for i, (priority, sequence, task_id) in enumerate(items):
                # Get task details
                task_data = self.redis.hgetall(f"{self.results_key}:{task_id}")
                if not task_data:
                    # Task expired/missing, remove from heap
                    self._remove_from_queue((priority, sequence, task_id))
                    continue
                
                task = Task.from_dict({k: json.loads(v) for k, v in task_data.items()})
                
                # Check if this task is for this agent (or auto-route)
                if task.agent and task.agent != agent:
                    continue  # Not for this agent
                
                # Remove from queue
                self._remove_from_queue((priority, sequence, task_id))
                
                # Mark as processing
                task.status = "processing"
                task.started_at = time.time()
                self._update_task(task)
                
                return task
            
            # No task found, wait a bit
            remaining = deadline - time.time()
            if remaining > 0:
                time.sleep(min(0.5, remaining))
        
        return None

    def complete(self, task_id: str, result: dict = None, error: str = None) -> None:
        """Mark task as completed or failed."""
        task_data = self.redis.hgetall(f"{self.results_key}:{task_id}")
        if not task_data:
            return
        
        task = Task.from_dict({k: json.loads(v) for k, v in task_data.items()})
        task.status = "failed" if error else "completed"
        task.completed_at = time.time()
        task.result = result
        task.error = error
        self._update_task(task)

    def get_status(self, task_id: str) -> Optional[Task]:
        """Get current task status."""
        task_data = self.redis.hgetall(f"{self.results_key}:{task_id}")
        if not task_data:
            return None
        return Task.from_dict({k: json.loads(v) for k, v in task_data.items()})

    def requeue(self, task: Task) -> None:
        """Return task to queue with lower priority."""
        task.priority = min(task.priority + 1, Priority.DEV)  # Max at DEV
        task.status = "queued"
        task.started_at = None
        self._update_task(task)
        queued = QueuedTask(task=task, sequence=self._get_next_sequence())
        heapq.heappush(self._get_queue(), (queued.task.priority, queued.sequence, task.id))

    def _get_queue(self) -> list:
        """Get queue as list (for heapq operations)."""
        raw = self.redis.lrange(self.queue_key, 0, -1)
        result = []
        for item in raw:
            parts = item.rsplit(",", 2)
            if len(parts) == 3:
                result.append((int(parts[0]), int(parts[1]), parts[2]))
        return result

    def _remove_from_queue(self, item: tuple) -> None:
        """Remove specific item from queue."""
        self.redis.lrem(self.queue_key, 1, ",".join(str(x) for x in item))

    def _update_task(self, task: Task) -> None:
        """Update task in Redis."""
        self.redis.hset(
            f"{self.results_key}:{task.id}",
            mapping={k: json.dumps(v) for k, v in task.to_dict().items()}
        )
        self.redis.expire(f"{self.results_key}:{task.id}", self.default_timeout)

    def queue_size(self) -> int:
        """Get approximate queue size."""
        return self.redis.llen(self.queue_key)

    def clear_queue(self) -> None:
        """Clear all tasks (use with caution!)."""
        keys = self.redis.keys(f"{self.results_key}:*")
        if keys:
            self.redis.delete(*keys)
        self.redis.delete(self.queue_key)


# Singleton
_task_queue: Optional[TaskQueue] = None


def get_task_queue() -> TaskQueue:
    global _task_queue
    if _task_queue is None:
        _task_queue = TaskQueue()
    return _task_queue


# Convenience
def enqueue(description: str, priority: int = Priority.JUNIOR, agent: str = None, **kwargs) -> str:
    return get_task_queue().enqueue(description, priority, agent, **kwargs)


def dequeue(agent: str, timeout: int = 5) -> Optional[Task]:
    return get_task_queue().dequeue(agent, timeout)


def complete(task_id: str, result: dict = None, error: str = None) -> None:
    get_task_queue().complete(task_id, result, error)
