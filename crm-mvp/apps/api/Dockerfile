# API Dockerfile — usa build pré-compilado + node_modules do host (root + workspace)
FROM node:22-alpine
WORKDIR /app
COPY apps/api/node_modules ./apps/api/node_modules
COPY dist/apps/api/apps/api/src ./dist
ENV NODE_ENV=production
ENV API_PORT=4088
ENV NODE_PATH=/app/apps/api/node_modules
EXPOSE 4088
COPY apps/api/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh
CMD ["/usr/local/bin/start.sh"]
