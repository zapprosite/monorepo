"""Perplexity-like Browser Agent — Streamlit UI."""
import streamlit as st

from config import CHROME_PROFILE_PATH, STREAMLIT_PORT
from components.oauth_personas import render_oauth_sidebar, get_active_persona_state, simulate_oauth_login

st.set_page_config(
    page_title="Perplexity Agent",
    page_icon="🌐",
)

st.title("🌐 Perplexity Agent")
st.caption(f"Chrome profile: `{CHROME_PROFILE_PATH}`")

if "messages" not in st.session_state:
    st.session_state.messages = []

# Render OAuth persona selector in sidebar
render_oauth_sidebar()

# Show active persona's OAuth status in main UI
active_state = get_active_persona_state()
if active_state.get("logged_in"):
    persona_email = active_state.get("email", "")
    persona_type = st.session_state.active_persona
    st.info(f"🔐 Logged in as {persona_email} ({persona_type})")
else:
    persona_type = st.session_state.active_persona
    st.warning(f"⚠️ Not logged in ({persona_type}). Select persona and login in sidebar.")

# Chat history
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# Chat input
if prompt := st.chat_input("Ask me anything..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            try:
                from agent.browser_agent import get_agent
                agent = get_agent()
                result = agent.run(prompt)
                st.markdown(result)
                st.session_state.messages.append({"role": "assistant", "content": result})
            except Exception as e:
                st.error(f"Error: {e}")

# Sidebar — debug/test controls
with st.sidebar:
    st.divider()
    st.header("🔧 Debug")
    if st.button("🔵 Simulate Gemini Login"):
        simulate_oauth_login("gemini", "will.gemini@gmail.com")
        st.rerun()
    if st.button("🟣 Simulate Perplexity Login"):
        simulate_oauth_login("perplexity", "will.perplexity@gmail.com")
        st.rerun()
    st.caption("💡 In production, use real Google OAuth via sidebar login.")
