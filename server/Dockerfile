# Pi Remote Server image. BUILD FROM THE REPO ROOT so `shared/` is in context:
#   docker build -t pi-remote-server:0.1.0 -f server/Dockerfile .
#
# Layout in the image mirrors the repo (/app/server imports ../../shared), so
# the same relative imports resolve at runtime. Runs via tsx (a prod dep) — no
# separate build step.
FROM node:22-slim AS deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app/server
COPY --chown=node:node --from=deps /app/server/node_modules ./node_modules
COPY --chown=node:node shared /app/shared
COPY --chown=node:node server/package.json server/tsconfig.json ./
COPY --chown=node:node server/src ./src
# Non-root, set after COPY so the working tree is fully node-owned.
USER node
EXPOSE 8787
# Run node as PID 1 (via tsx's loader) so Kubernetes' SIGTERM reaches the
# graceful-shutdown handler — `npm start` would swallow the signal and skip the
# socket drain. Reads config from env (dotenv is a no-op here).
CMD ["node", "--import", "tsx", "src/index.ts"]
