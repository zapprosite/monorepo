FROM nginx:alpine

# Create non-root user
RUN addgroup -g 1001 -S nginxapp && \
    adduser -S nginxapp -u 1001 -G nginxapp

# Create nginx cache directories (needed by worker process)
RUN mkdir -p /var/cache/nginx/client_temp && \
    chown -R nginxapp:nginxapp /var/cache/nginx

# Copy static files
COPY --chown=nginxapp:nginxapp . /usr/share/nginx/html/

# Copy custom nginx config for auth callback route
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=5s \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

USER nginxapp

CMD ["nginx", "-g", "daemon off;"]
