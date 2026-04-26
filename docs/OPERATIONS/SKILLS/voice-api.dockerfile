FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
COPY docs/OPERATIONS/SKILLS/voice-api.py /app/voice-api.py
WORKDIR /app
CMD ["python3", "voice-api.py"]
