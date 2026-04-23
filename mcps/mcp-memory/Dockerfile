FROM python:3.11-slim

WORKDIR /app

# Install dependencies - avoid hnswlib compilation issues
RUN pip install --no-cache-dir \
    mcp==1.1.2 \
    qdrant-client==1.12.0 \
    fastapi==0.115.0 \
    uvicorn==0.34.0 \
    httpx==0.28.1 \
    pydantic==2.10.0

# Copy server
COPY server_simple.py /app/server.py

EXPOSE 4016

# Run server
CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "4016"]
