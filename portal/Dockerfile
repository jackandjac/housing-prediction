# Build from the repository root:
#   docker build -f portal/Dockerfile -t housing-portal .
FROM node:22-alpine AS deps
WORKDIR /app
COPY portal/package.json portal/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY portal/ ./
ENV NEXT_TELEMETRY_DISABLED=1
# Backends are not needed at build time: all backend data is fetched at request time.
RUN npx next build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    ESTIMATOR_API_URL=http://estimator-api:8001 \
    MARKET_API_URL=http://market-api:8080 \
    ML_API_URL=http://ml-api:8000
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1
CMD ["node", "server.js"]
