#!/usr/bin/env bash
set -euo pipefail

USER_CONFIG_DIR="$HOME/.config/systemd/user"
SYSTEMD_SOURCE_DIR="/srv/monorepo/.claude-events/systemd"

# Ensure ~/.config/systemd/user/ exists
mkdir -p "$USER_CONFIG_DIR"

# Symlink service files
ln -sf "$SYSTEMD_SOURCE_DIR/inotify-watch.service" "$USER_CONFIG_DIR/inotify-watch.service"
ln -sf "$SYSTEMD_SOURCE_DIR/trigger-bridge.service" "$USER_CONFIG_DIR/trigger-bridge.service"

# Reload systemd
systemctl --user daemon-reload

# Enable and start inotify-watch.service
systemctl --user enable inotify-watch.service
systemctl --user start inotify-watch.service

# Enable and start trigger-bridge.service
systemctl --user enable trigger-bridge.service
systemctl --user start trigger-bridge.service

# Show status
echo "=== inotify-watch.service ==="
systemctl --user status inotify-watch.service --no-pager

echo ""
echo "=== trigger-bridge.service ==="
systemctl --user status trigger-bridge.service --no-pager
