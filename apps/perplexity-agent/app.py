"""Perplexity-like Browser Agent — Streamlit UI."""
import streamlit as st

from config import CHROME_PROFILE_PATH, STREAMLIT_PORT

st.set_page_config(
    page_title="Perplexity Agent",
    page_icon="🌐",
)

st.title("🌐 Perplexity Agent")
st.caption(f"Chrome profile: `{CHROME_PROFILE_PATH}`")

if "messages" not in st.session_state:
    st.session_state.messages = []

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

# Sidebar — browser status
with st.sidebar:
    st.header("Status")
    st.write(f"**Chrome profile:** `{CHROME_PROFILE_PATH}`")
    st.write(f"**Port:** `{STREAMLIT_PORT}`")
    st.divider()
    st.caption("💡 Login manually in Chrome at the profile path to persist sessions.")
