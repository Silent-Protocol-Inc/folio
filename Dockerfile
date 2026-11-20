# Folio needs Node.js 24 (node:sqlite). Data goes in the /data volume; the app listens on PORT (default 4173).
FROM node:26-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev
ENV FOLIO_HOST=0.0.0.0 PORT=4173 FOLIO_DB_PATH=/data/folio.sqlite
EXPOSE 4173
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
CMD ["node", "scripts/serve.mjs"]
