FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 HOST=0.0.0.0 DATA_DIR=/data
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server ./server
COPY web ./web
COPY device ./device
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/api/auth/status || exit 1
CMD ["node", "server/index.js"]
