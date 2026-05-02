# orchestrator/tools.py — MCPO tools exposed to Hermes
import json
import sys
sys.path.insert(0, '/app/services/orchestrator')
from state import Session
from graph import get_graph

def orchestrator_start(name: str, phase: str = "idle", metadata: dict = None) -> str:
    """Create a new orchestrator session and start it."""
    session = Session.make(name=name, phase=phase, metadata=metadata)
    graph = get_graph()
    result = graph.invoke({
        "session_id": session.id,
        "phase": "idle",
        "status": "created",
        "steps": [],
        "results": {},
        "error_msg": "",
        "ckpt": ""
    })
    return json.dumps({"ok": True, "session": session.to_dict(), "final_state": result})

def orchestrator_status(session_id: str) -> str:
    """Get the current status of an orchestrator session."""
    session = Session.get(session_id)
    if not session:
        return json.dumps({"ok": False, "error": "session not found"})
    return json.dumps({"ok": True, "session": session.to_dict()})

def orchestrator_checkpoint(session_id: str, step: str, state: dict) -> str:
    """Create a checkpoint for a session."""
    session = Session.get(session_id)
    if not session:
        return json.dumps({"ok": False, "error": "session not found"})
    ckpt_id = session.checkpoint(step, state)
    return json.dumps({"ok": True, "ckpt": ckpt_id})

def orchestrator_rollback(session_id: str, ckpt: str = None) -> str:
    """Rollback a session to its last checkpoint or a specific one."""
    session = Session.get(session_id)
    if not session:
        return json.dumps({"ok": False, "error": "session not found"})
    restored = session.restore_checkpoint(ckpt)
    session.update(phase="rolled_back", status="rolled_back")
    session.history_add("rollback", result=f"restored {ckpt or 'last checkpoint'}")
    return json.dumps({"ok": True, "session": session.to_dict(), "restored": restored})

def orchestrator_resume(session_id: str) -> str:
    """Resume a paused or failed session from last checkpoint."""
    session = Session.get(session_id)
    if not session:
        return json.dumps({"ok": False, "error": "session not found"})
    graph = get_graph()
    result = graph.invoke({
        "session_id": session.id,
        "phase": session.phase,
        "status": "running",
        "steps": session.metadata.get("plan", []),
        "results": {},
        "error_msg": "",
        "ckpt": ""
    })
    return json.dumps({"ok": True, "session": session.to_dict(), "final_state": result})

TOOLS = [
    {
        "name": "orchestrator_start",
        "description": "Create a new orchestrator session and start the execution graph",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Session name"},
                "phase": {"type": "string", "description": "Initial phase (default: idle)"},
                "metadata": {"type": "object", "description": "Additional metadata"}
            },
            "required": ["name"]
        }
    },
    {
        "name": "orchestrator_status",
        "description": "Get current status of an orchestrator session",
        "parameters": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "Session UUID"}
            },
            "required": ["session_id"]
        }
    },
    {
        "name": "orchestrator_checkpoint",
        "description": "Create a named checkpoint for a session",
        "parameters": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "Session UUID"},
                "step": {"type": "string", "description": "Step name (e.g. 'pre-deploy')"},
                "state": {"type": "object", "description": "State dict to persist"}
            },
            "required": ["session_id", "step", "state"]
        }
    },
    {
        "name": "orchestrator_rollback",
        "description": "Rollback session to last or specific checkpoint",
        "parameters": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "Session UUID"},
                "ckpt": {"type": "string", "description": "Optional: specific checkpoint UUID"}
            },
            "required": ["session_id"]
        }
    },
    {
        "name": "orchestrator_resume",
        "description": "Resume a paused or failed session from last checkpoint",
        "parameters": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "Session UUID"}
            },
            "required": ["session_id"]
        }
    }
]

HANDLERS = {
    "orchestrator_start": lambda args: orchestrator_start(
        name=args["name"], phase=args.get("phase","idle"), metadata=args.get("metadata")
    ),
    "orchestrator_status": lambda args: orchestrator_status(session_id=args["session_id"]),
    "orchestrator_checkpoint": lambda args: orchestrator_checkpoint(
        session_id=args["session_id"], step=args["step"], state=args["state"]
    ),
    "orchestrator_rollback": lambda args: orchestrator_rollback(
        session_id=args["session_id"], ckpt=args.get("ckpt")
    ),
    "orchestrator_resume": lambda args: orchestrator_resume(session_id=args["session_id"])
}
