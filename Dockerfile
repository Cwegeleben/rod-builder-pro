FROM node:22.14.0-alpine
RUN apk add --no-cache openssl ca-certificates tini

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

# Optionally prune devDependencies to slim the final image (default true)
ARG PRUNE_DEV=true
RUN if [ "$PRUNE_DEV" = "true" ]; then npm prune --omit=dev && npm cache clean --force; else echo "[build] Skipping dev prune for maintenance variant"; fi
ENV NODE_ENV=production

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["scripts/start-production.sh"]
