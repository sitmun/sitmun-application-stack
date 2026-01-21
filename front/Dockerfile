# Stage 0, "build-apps", based on Node.js, to build and compile both frontend apps sequentially
FROM node:18 AS build-apps
ARG PUBLIC_BASE_PATH=/
ARG BUILD_MODE=production
ENV PUBLIC_BASE_PATH=${PUBLIC_BASE_PATH}
ENV BUILD_MODE=${BUILD_MODE}
# Cache apt-get packages and install gettext
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y gettext
# Ensure case sensitivity is handled properly
ENV NODE_OPTIONS="--preserve-symlinks"
RUN mkdir -p /home/node/app && chown -R node:node /home/node/app
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app

# Build admin app first
COPY front/admin/sitmun-admin-app/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY --chown=node:node front/admin/sitmun-admin-app/*.json front/admin/sitmun-admin-app/*.js ./
COPY --chown=node:node front/admin/sitmun-admin-app/src/ ./src/
COPY --chown=node:node front/admin/environment.prod.ts.template ./src/environments/environment.prod.ts.template
RUN export BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z") && envsubst < ./src/environments/environment.prod.ts.template > ./src/environments/environment.prod.ts
RUN npm run build -- --configuration=${BUILD_MODE} --base-href=${PUBLIC_BASE_PATH}admin/

# Clean up and prepare for viewer app build
RUN rm -rf node_modules package*.json src
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

# Build viewer app second
COPY front/viewer/sitmun-viewer-app/package*.json ./
COPY --chown=node:node front/viewer/sitmun-viewer-app/scripts/ ./scripts/
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY --chown=node:node front/viewer/sitmun-viewer-app/*.json front/viewer/sitmun-viewer-app/*.js ./
COPY --chown=node:node front/viewer/sitmun-viewer-app/src/ ./src/
COPY --chown=node:node front/viewer/environment.prod.ts.template ./src/environments/environment.prod.ts.template
COPY --chown=node:node front/viewer/index.html.template ./src/index.html.template
COPY --chown=node:node front/viewer/webpack.config.js.template ./webpack.config.js.template
RUN export BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z") && envsubst < ./src/environments/environment.prod.ts.template > ./src/environments/environment.prod.ts
RUN envsubst < ./src/index.html.template > ./src/index.html
RUN envsubst < ./webpack.config.js.template > ./webpack.config.js
RUN npm run build -- --configuration=${BUILD_MODE} --base-href=${PUBLIC_BASE_PATH}viewer/

# Stage 1, based on Nginx, to have only the compiled apps, ready for production with Nginx
FROM nginx:1.27-alpine
COPY --from=build-apps /home/node/app/dist/admin-app/ /usr/share/nginx/html/admin
COPY --from=build-apps /home/node/app/dist/viewer-app/ /usr/share/nginx/html/viewer
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD wget -q --spider http://localhost/admin/ || exit 1
