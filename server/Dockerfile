# ==============================================================================
# DOCKERFILE PER BACKEND API STANDALONE VOLTACRM
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder --chown=node:node /app/dist ./dist

EXPOSE 5000

USER node
CMD ["node", "dist/index.js"]
