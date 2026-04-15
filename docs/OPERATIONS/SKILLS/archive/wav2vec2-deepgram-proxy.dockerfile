FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
COPY docs/OPERATIONS/SKILLS/wav2vec2-deepgram-proxy.py /app/proxy.py
WORKDIR /app
CMD ["python3", "proxy.py"]
