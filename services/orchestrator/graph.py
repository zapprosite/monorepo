# orchestrator/graph.py — LangGraph StateGraph orchestrator
import json
import sys
sys.path.insert(0, '/app/services/orchestrator')
from typing import TypedDict
from langgraph.graph import StateGraph, END
from state import Session

# ── State schema (TypedDict — LangGraph compatible) ─────────────
class OrchestratorState(TypedDict):
    session_id: str
    phase: str          # idle | planning | executing | validating | done | error | rolled_back
    status: str         # created | running | paused | done | failed | rolled_back
    current_step: str
    steps: list
    results: dict
    error_msg: str
    ckpt: str

# ── Nodes ──────────────────────────────────────────────────────
def start_node(state: OrchestratorState):
    sid = state["session_id"]
    session = Session.get(sid)
    session.update(status="running", phase="planning")
    session.history_add("start", to_phase="planning", result="ok")
    return {**state, "phase": "planning", "status": "running"}

def plan_node(state: OrchestratorState):
    sid = state["session_id"]
    session = Session.get(sid)
    session.update(phase="planning", current_step="plan")
    session.history_add("plan", from_phase="planning", to_phase="executing", result="ok")
    return {**state, "phase": "executing", "current_step": "execute"}

def execute_node(state: OrchestratorState):
    sid = state["session_id"]
    session = Session.get(sid)
    session.update(phase="executing", current_step="execute")
    ckpt = session.checkpoint("execute", dict(state))
    session.history_add("execute", from_phase="executing", to_phase="validating", result="ok")
    return {**state, "phase": "validating", "ckpt": ckpt}

def validate_node(state: OrchestratorState):
    sid = state["session_id"]
    session = Session.get(sid)
    session.update(phase="validating", current_step="validate")
    ckpt = session.checkpoint("validate", dict(state))
    session.history_add("validate", from_phase="validating", to_phase="done", result="ok")
    session.update(status="done", phase="done", checkpoint_id=ckpt)
    return {**state, "phase": "done", "status": "done", "ckpt": ckpt}

def error_node(state: OrchestratorState):
    sid = state["session_id"]
    err = state.get("error_msg", "unknown")
    session = Session.get(sid)
    session.update(phase="error", status="failed", error_message=err)
    session.history_add("error", from_phase=state.get("phase"), result=err)
    return {**state, "status": "failed"}

def rollback_node(state: OrchestratorState):
    sid = state["session_id"]
    session = Session.get(sid)
    restored = session.restore_checkpoint()
    session.update(phase="rolled_back", status="rolled_back")
    session.history_add("rollback", result=f"restored {restored.get('id')}")
    return {**state, "phase": "rolled_back", "status": "rolled_back",
            "restored_checkpoint": restored}

# ── Graph ──────────────────────────────────────────────────────
def build_graph():
    g = StateGraph(OrchestratorState)
    g.add_node("start", start_node)
    g.add_node("plan", plan_node)
    g.add_node("execute", execute_node)
    g.add_node("validate", validate_node)
    g.add_node("error", error_node)
    g.add_node("rollback", rollback_node)
    g.set_entry_point("start")
    g.add_edge("start", "plan")
    g.add_edge("plan", "execute")
    g.add_edge("execute", "validate")
    g.add_edge("validate", END)
    g.add_edge("error", "rollback")
    g.add_edge("rollback", END)
    return g

_graph = None
def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph().compile()
    return _graph
