# ---- build: compile workspaces, prune dev deps ----
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/protocol/package.json ./packages/protocol/
RUN npm ci
COPY apps/server ./apps/server
COPY packages/protocol ./packages/protocol
RUN npm run build --workspace=@floodlight/protocol \
 && npm run build --workspace=@floodlight/server \
 && npm prune --omit=dev

# ---- run: dist + production node_modules only, non-root ----
FROM node:22-alpine
WORKDIR /srv
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./
COPY --from=build /repo/apps/server/package.json ./apps/server/
COPY --from=build /repo/apps/server/dist ./apps/server/dist
COPY --from=build /repo/apps/server/drizzle ./apps/server/drizzle
COPY --from=build /repo/packages/protocol/package.json ./packages/protocol/
COPY --from=build /repo/packages/protocol/dist ./packages/protocol/dist
RUN chown -R app:app /srv
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/healthz | grep -q '"status":"ok"'
CMD ["node", "apps/server/dist/index.js"]
