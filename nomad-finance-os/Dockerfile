FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY README.md ./

ENV NODE_ENV=production
ENV PORT=5001
ENV DB_PATH=/data/nomad-finance.db
ENV BACKUP_DIR=/backups

RUN mkdir -p /data /backups && chown -R node:node /app /data /backups

USER node

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

VOLUME ["/data", "/backups"]

CMD ["node", "src/server.js"]
