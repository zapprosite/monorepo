# orchestrator/state.py — PostgreSQL state management
import os, json, uuid
from datetime import datetime
from typing import Optional
from dataclasses import dataclass
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get(
    "ORCHESTRATOR_DB",
    "postgresql://crm:crm@10.0.0.4:5432/crm_mvp"
)

def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

# All table names prefixed with schema — no search_path manipulation needed
T_SESSION = "orchestrator.orchestrator_sessions"
T_CHECKPOINT = "orchestrator.orchestrator_checkpoints"
T_HISTORY = "orchestrator.orchestrator_history"
T_NOTIFICATION = "orchestrator.orchestrator_notifications"

@dataclass
class Session:
    id: str
    name: str
    phase: str
    status: str
    created_at: datetime
    updated_at: datetime
    metadata: dict
    checkpoint_id: Optional[str]
    current_step: Optional[str]
    error_message: Optional[str]

    def create(self) -> "Session":
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""INSERT INTO {T_SESSION} (id, name, phase, metadata)
                        VALUES (%s, %s, %s, %s) RETURNING *""",
                    (self.id, self.name, self.phase, json.dumps(self.metadata))
                )
                row = cur.fetchone()
        return Session(**dict(row))

    def update(self, phase=None, status=None, current_step=None,
               error_message=None, metadata=None, checkpoint_id=None):
        with get_conn() as conn:
            with conn.cursor() as cur:
                updates = []
                values = []
                if phase is not None:
                    updates.append("phase = %s"); values.append(phase)
                if status is not None:
                    updates.append("status = %s"); values.append(status)
                if current_step is not None:
                    updates.append("current_step = %s"); values.append(current_step)
                if error_message is not None:
                    updates.append("error_message = %s"); values.append(error_message)
                if metadata is not None:
                    updates.append("metadata = %s"); values.append(json.dumps(metadata))
                if checkpoint_id is not None:
                    updates.append("checkpoint_id = %s"); values.append(checkpoint_id)
                values.append(self.id)
                cur.execute(
                    f"UPDATE {T_SESSION} SET {', '.join(updates)} WHERE id = %s RETURNING *",
                    values
                )
                row = cur.fetchone()
        for k, v in dict(row).items():
            setattr(self, k, v)
        return self

    def checkpoint(self, step: str, state: dict) -> str:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""INSERT INTO {T_CHECKPOINT} (session_id, phase, step, state)
                        VALUES (%s, %s, %s, %s) RETURNING id""",
                    (self.id, self.phase, step, json.dumps(state))
                )
                return cur.fetchone()["id"]

    def restore_checkpoint(self, checkpoint_id: str = None) -> dict:
        cid = checkpoint_id or self.checkpoint_id
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT * FROM {T_CHECKPOINT} WHERE id = %s",
                    (cid,)
                )
                row = cur.fetchone()
        result = dict(row) if row else {}
        for k, v in result.items():
            if hasattr(v, 'isoformat'):
                result[k] = v.isoformat()
        return result

    def history_add(self, action: str, from_phase: str = None,
                    to_phase: str = None, result: str = None):
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""INSERT INTO {T_HISTORY}
                        (session_id, from_phase, to_phase, action, result)
                        VALUES (%s, %s, %s, %s, %s)""",
                    (self.id, from_phase, self.phase, action, result)
                )

    @classmethod
    def get(cls, session_id: str) -> Optional["Session"]:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT * FROM {T_SESSION} WHERE id = %s", (session_id,))
                row = cur.fetchone()
        return cls(**dict(row)) if row else None

    @classmethod
    def list_all(cls, status: str = None) -> list:
        with get_conn() as conn:
            with conn.cursor() as cur:
                if status:
                    cur.execute(
                        f"SELECT * FROM {T_SESSION} WHERE status = %s ORDER BY created_at DESC",
                        (status,)
                    )
                else:
                    cur.execute(f"SELECT * FROM {T_SESSION} ORDER BY created_at DESC")
                return [cls(**dict(r)) for r in cur.fetchall()]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "phase": self.phase,
            "status": self.status,
            "created_at": str(self.created_at),
            "updated_at": str(self.updated_at),
            "metadata": self.metadata,
            "checkpoint_id": self.checkpoint_id,
            "current_step": self.current_step,
            "error_message": self.error_message
        }

    # Factory to create AND insert in one shot
    @classmethod
    def make(cls, name: str, phase: str = "idle", metadata: dict = None) -> "Session":
        sid = str(uuid.uuid4())
        instance = cls(
            id=sid,
            name=name,
            phase=phase,
            status="created",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            metadata=metadata or {},
            checkpoint_id=None,
            current_step=None,
            error_message=None
        )
        return instance.create()
