"""OAuth Persona Manager — multi-account Google + Perplexity login."""

import streamlit as st
import hashlib
import time
from datetime import datetime, timedelta

# Simulated OAuth state storage (in production, use secure storage)
# Each persona has: email, access_token, refresh_token, expires_at

PERSONAS = ["gemini", "perplexity"]


def init_oauth_state():
    """Initialize OAuth session state."""
    if "oauth_personas" not in st.session_state:
        st.session_state.oauth_personas = {}
        for persona in PERSONAS:
            st.session_state.oauth_personas[persona] = {
                "email": None,
                "access_token": None,
                "refresh_token": None,
                "expires_at": None,
                "logged_in": False,
            }

    if "active_persona" not in st.session_state:
        st.session_state.active_persona = "gemini"


def get_google_auth_url(persona: str, redirect_uri: str) -> str:
    """Build Google OAuth URL with select_account prompt."""
    # In production, use proper Google OAuth credentials from config
    client_id = _get_credential(f"GOOGLE_OAUTH_CLIENT_ID_{persona.upper()}")
    if not client_id:
        return None

    import urllib.parse
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "prompt": "select_account",  # Force account selection
        "state": persona,
        "access_type": "offline",
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"


def _get_credential(key: str) -> str | None:
    """Fetch credential from environment or Streamlit secrets."""
    import os
    # Try Streamlit secrets first
    try:
        return st.secrets.get(key.lower(), None)
    except Exception:
        pass
    # Fallback to environment
    return os.environ.get(key, None)


def _hash_token(token: str) -> str:
    """Hash token for display (security)."""
    return hashlib.sha256(token.encode()).hexdigest()[:8]


def is_token_valid(persona: str) -> bool:
    """Check if persona's token is still valid."""
    state = st.session_state.oauth_personas.get(persona, {})
    if not state.get("logged_in"):
        return False
    expires = state.get("expires_at")
    if expires and datetime.now() >= expires - timedelta(minutes=5):
        return False
    return True


def render_oauth_sidebar():
    """Render OAuth persona selector in sidebar."""
    init_oauth_state()

    with st.sidebar:
        st.header("🔐 Personas")

        # Show active persona
        active = st.session_state.active_persona
        st.radio(
            "Active persona:",
            PERSONAS,
            index=PERSONAS.index(active) if active in PERSONAS else 0,
            key="persona_selector",
            format_func=lambda x: f"{'🔵' if x == 'gemini' else '🟣'} {x.title()}",
            on_change=_on_persona_change,
        )

        # Show login status for each persona
        for persona in PERSONAS:
            state = st.session_state.oauth_personas[persona]
            icon = "🔵" if persona == "gemini" else "🟣"

            with st.expander(f"{icon} {persona.title()}", expanded=(persona == active)):
                if state["logged_in"]:
                    email = state["email"] or "unknown@..."
                    st.success(f"✅ Logged in as")
                    st.caption(f"📧 {email}")
                    if st.button(f"Logout {persona}", key=f"logout_{persona}"):
                        _logout_persona(persona)
                        st.rerun()
                else:
                    st.warning("⚠️ Not logged in")
                    if st.button(f"Login with Google", key=f"login_{persona}"):
                        _initiate_oauth_flow(persona)


def _on_persona_change():
    """Handle persona selection change."""
    st.session_state.active_persona = st.session_state.persona_selector


def _initiate_oauth_flow(persona: str):
    """Initiate OAuth flow for persona."""
    # In production, redirect to Google OAuth
    # For now, simulate with a form
    st.info(f"🔄 Initiating OAuth for {persona}...")


def _logout_persona(persona: str):
    """Logout persona and clear tokens."""
    st.session_state.oauth_personas[persona] = {
        "email": None,
        "access_token": None,
        "refresh_token": None,
        "expires_at": None,
        "logged_in": False,
    }


def get_active_persona_state() -> dict:
    """Get the active persona's OAuth state."""
    init_oauth_state()
    active = st.session_state.active_persona
    return st.session_state.oauth_personas.get(active, {})


def simulate_oauth_login(persona: str, email: str):
    """Simulate OAuth login (for testing)."""
    init_oauth_state()
    st.session_state.oauth_personas[persona] = {
        "email": email,
        "access_token": f"simulated_token_{persona}_{int(time.time())}",
        "refresh_token": f"simulated_refresh_{persona}_{int(time.time())}",
        "expires_at": datetime.now() + timedelta(hours=1),
        "logged_in": True,
    }
