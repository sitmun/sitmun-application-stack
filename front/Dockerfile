# Stage 0, "build-apps", based on Node.js, to build and compile both frontend apps sequentially
FROM node:18 AS build-apps
ARG PUBLIC_BASE_PATH=/
RUN export PUBLIC_BASE_PATH=${PUBLIC_BASE_PATH}
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
COPY admin/sitmun-admin-app/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY --chown=node:node admin/sitmun-admin-app/*.json admin/sitmun-admin-app/*.js ./
COPY --chown=node:node admin/sitmun-admin-app/src/ ./src/
COPY --chown=node:node admin/environment.testdeployment.ts.template ./src/environments/environment.testdeployment.ts.template
RUN export BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z") && envsubst < ./src/environments/environment.testdeployment.ts.template > ./src/environments/environment.testdeployment.ts
RUN npm run build -- --configuration=testdeployment --base-href=${PUBLIC_BASE_PATH}admin/

# Clean up and prepare for viewer app build
RUN rm -rf node_modules package*.json src
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

# Build viewer app second
COPY viewer/sitmun-viewer-app/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY --chown=node:node viewer/sitmun-viewer-app/*.json viewer/sitmun-viewer-app/*.js ./
COPY --chown=node:node viewer/sitmun-viewer-app/src/ ./src/
COPY --chown=node:node viewer/environment.testdeployment.ts.template ./src/environments/environment.testdeployment.ts.template
COPY --chown=node:node viewer/index.html.template ./src/index.html.template
COPY --chown=node:node viewer/webpack.config.js.template ./webpack.config.js.template
RUN export BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z") && envsubst < ./src/environments/environment.testdeployment.ts.template > ./src/environments/environment.testdeployment.ts
RUN envsubst < ./src/index.html.template > ./src/index.html
RUN envsubst < ./webpack.config.js.template > ./webpack.config.js
RUN npm run build -- --configuration=testdeployment --base-href=${PUBLIC_BASE_PATH}viewer/

# Stage 1, based on Nginx, to have only the compiled apps, ready for production with Nginx
FROM nginx:1.27-alpine
COPY --from=build-apps /home/node/app/dist/admin-app/ /usr/share/nginx/html/admin
COPY --from=build-apps /home/node/app/dist/viewer-app/ /usr/share/nginx/html/viewer
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl --fail http://localhost:8080/actuator/health || exit 1