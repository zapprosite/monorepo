#!/bin/sh
set -e
# Inject env.js with OAuth config
printf 'window.__ENV__ = {\n  GOOGLE_CLIENT_ID: "%s",\n  GOOGLE_CLIENT_SECRET: "%s",\n  GOOGLE_REDIRECT_URI: "%s"\n};\n' "$GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_SECRET" "$GOOGLE_REDIRECT_URI" > /usr/share/nginx/html/env.js
exec dockerd &
nginx -g 'daemon off;'
