# --- BUILD STAGE -------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# --- RUNTIME STAGE -----------------------------------------------------
FROM node:24-alpine
WORKDIR /app

# Copy build output from builder
COPY --from=builder /app/build ./build

# Copy FULL node_modules from builder (needed for SSR)
COPY --from=builder /app/node_modules ./node_modules

# Copy package.json (useful for introspection)
COPY --from=builder /app/package*.json ./

EXPOSE 3000

CMD ["node", "build/index.js"]
