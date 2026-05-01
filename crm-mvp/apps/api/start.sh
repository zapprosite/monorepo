#!/bin/sh
export NODE_PATH="/app/apps/api/node_modules:/app/node_modules"
exec node dist/main.js
