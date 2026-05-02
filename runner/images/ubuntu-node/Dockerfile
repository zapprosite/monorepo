# syntax=docker/dockerfile:1
#
# Custom Gitea Actions Runner Image with Node.js 22 pre-installed
# Based on Ubuntu 22.04 with Node.js, pnpm, and essential build tools
#
# Build and push:
#   docker build -t gitea-runner-ubuntu-node:22 ./runner/images/ubuntu-node/
#   docker tag gitea-runner-ubuntu-node:22 localhost:5000/gitea-runner-ubuntu-node:22
#   docker push localhost:5000/gitea-runner-ubuntu-node:22
#

FROM ubuntu:22.04

LABEL maintainer="will-zappro"
LABEL description="Gitea Actions Runner with Node.js 22 and pnpm"

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install base system, Node.js 22.x, and build essentials
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22.x from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally via corepack
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install Bun (optional, useful for some projects)
RUN npm install -g bun@latest

# Verify installations
RUN node --version \
    && npm --version \
    && pnpm --version \
    && bun --version

# Create non-root user for security
RUN useradd -m -s /bin/bash runner && \
    mkdir -p /home/runner && \
    chown -R runner:runner /home/runner

USER runner
WORKDIR /home/runner

# Default command
CMD ["/bin/bash"]
