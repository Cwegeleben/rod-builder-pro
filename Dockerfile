FROM node:22.14.0-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    openssl ca-certificates tini procps \
    && ln -sf $(command -v tini) /sbin/tini \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 3000

WORKDIR /app

# Disable Husky in CI
ENV HUSKY=0

COPY package.json package-lock.json* ./

# Install all deps (including dev) to allow Vite/Remix build
# Use NODE_ENV=development so npm doesn't omit devDependencies
ENV NODE_ENV=development
RUN npm ci --ignore-scripts

# Optional: Install Playwright earlier to leverage layer cache across source changes
# Toggle via build arg INSTALL_PLAYWRIGHT (default true)
ARG INSTALL_PLAYWRIGHT=true
RUN if [ "$INSTALL_PLAYWRIGHT" = "true" ]; then npx playwright install --with-deps chromium; else echo "[build] Skipping Playwright install"; fi

# Cache Prisma client generation when schema doesn't change
COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN chmod +x scripts/start-production.sh

# Build the Remix app
RUN npm run build

# (Playwright already installed earlier if enabled)

# Optionally prune devDependencies to slim the final image (default true)
ARG PRUNE_DEV=true
RUN if [ "$PRUNE_DEV" = "true" ]; then npm prune --omit=dev && npm cache clean --force; else echo "[build] Skipping dev prune for maintenance variant"; fi
ENV NODE_ENV=production
# <!-- BEGIN RBP GENERATED: importer-discover-headless-harden-v1 -->
# Signal that Playwright is available in the runtime
ENV PLAYWRIGHT_AVAILABLE=1
# <!-- END RBP GENERATED: importer-discover-headless-harden-v1 -->

ENTRYPOINT ["scripts/start-production.sh"]
