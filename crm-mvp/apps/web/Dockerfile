# Web Dockerfile — roda vite dev server (modo dev, para MVP)
FROM node:22-alpine
WORKDIR /app/apps/web
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml /app/
RUN cd /app && npm install -g pnpm && pnpm install
COPY . /app/
ENV VITE_API_URL=http://api:4088
EXPOSE 3080
CMD ["npx", "vite", "--port", "3080", "--host"]
