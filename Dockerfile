FROM node:22.14.0-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    openssl ca-certificates tini \
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

COPY . .
RUN chmod +x scripts/start-production.sh

# Build the Remix app
RUN npm run build

# Ensure Prisma client is generated in the final image to avoid runtime generation
RUN npx prisma generate

# Install Playwright chromium and required system deps for runtime preview endpoint
RUN npx playwright install --with-deps chromium

# Optionally prune devDependencies to slim the final image (default true)
ARG PRUNE_DEV=true
RUN if [ "$PRUNE_DEV" = "true" ]; then npm prune --omit=dev && npm cache clean --force; else echo "[build] Skipping dev prune for maintenance variant"; fi
ENV NODE_ENV=production

ENTRYPOINT ["scripts/start-production.sh"]
