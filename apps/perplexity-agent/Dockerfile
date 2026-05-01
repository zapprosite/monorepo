FROM python:3.12-slim

WORKDIR /app

# Install system deps for Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy project files
COPY pyproject.toml uv.lock ./
COPY agent/ ./agent/
COPY app.py config.py ./

# Install Python deps
RUN uv sync --frozen

# Install Playwright browsers
RUN uvx browser-use install

# Chrome profile directory
RUN mkdir -p /srv/data/perplexity-agent/chrome-profile

ENV CHROME_PROFILE_PATH=/srv/data/perplexity-agent/chrome-profile
ENV STREAMLIT_PORT=4004
ENV PYTHONUNBUFFERED=1

EXPOSE 4004

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:4004/_stcore/health')"

CMD ["uv", "run", "streamlit", "run", "app.py", "--server.port=4004", "--server.address=0.0.0.0", "--server.headless=true"]
