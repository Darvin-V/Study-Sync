# ==============================================================================
# StudySync AI — Multi-Stage Production Dockerfile with Litestream
#
# Target: Node.js 22+ (Required for native node:sqlite DatabaseSync)
# Architectures: linux/amd64
# Includes: Litestream continuous replication for zero-cost Cloudflare R2 persistence
# ==============================================================================

# Stage 1: Build the Frontend Static Assets
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies required for Vite build)
RUN npm ci

# Copy application source code
COPY . .

# Build the production frontend into /app/dist
RUN npm run build

# Stage 2: Production Container Runtime
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Install ca-certificates and download Litestream v0.3.13 binary
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && \
    curl -sL https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz | tar -xz -C /usr/local/bin && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Set production environment flags
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV DATABASE_PATH=/data/studysync.db
ENV SERVE_STATIC=true

# Create persistent data volume mount point
RUN mkdir -p /data && chown -R node:node /data

# Copy dependency manifests and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy backend source, migrations, and scripts
COPY server/ ./server/
COPY litestream.yml ./litestream.yml

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist

# Ensure the non-root node user owns application files and entrypoint is executable
RUN chmod +x /app/server/scripts/entrypoint.sh && chown -R node:node /app

# Switch to non-root user for security hardening
USER node

# Expose server port
EXPOSE 3001

# Health check probe against the genuine /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start via Litestream lifecycle entrypoint (restores on boot, replicates WAL, never overwrites existing local data)
ENTRYPOINT ["/app/server/scripts/entrypoint.sh"]
