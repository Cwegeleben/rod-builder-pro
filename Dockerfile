FROM node:22.14.0-alpine
RUN apk add --no-cache openssl

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

# Build the Remix app
RUN npm run build

# Remove devDependencies to slim the final image, then set production env
RUN npm prune --omit=dev && npm cache clean --force
ENV NODE_ENV=production

CMD ["npm", "run", "docker-start"]
