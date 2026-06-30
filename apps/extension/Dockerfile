# Builds the Engram browser extension (Plasmo, Chrome MV3) and the popup preview
# as static artifacts. The live preview server runs via docker-compose.yml using
# a plain node image (see that file); this Dockerfile is the reproducible build.
#
#   docker build -t engram-extension apps/extension
#   docker create --name x engram-extension && docker cp x:/app/build ./build && docker rm x
#
# Artifacts inside the image:
#   /app/build/chrome-mv3-prod   → unpacked Chrome extension (Load unpacked)
#   /app/build/preview           → static popup preview
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build && npm run preview:build

# Lightweight stage that just serves the built preview on :5174.
FROM node:22-bookworm-slim AS preview
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/build/preview ./preview
EXPOSE 5174
CMD ["serve", "-s", "preview", "-l", "5174"]
