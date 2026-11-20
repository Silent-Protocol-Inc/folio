# Folio needs Node 24 (node:sqlite); the host runs Node 22, so it runs in a container.
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev
USER node
CMD ["node", "scripts/serve.mjs"]
