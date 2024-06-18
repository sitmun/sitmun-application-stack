# Stage 0, "build-admin-app", based on Node.js, to build and compile the frontend
FROM node:12 AS build-admin-app
ARG GITHUB_TOKEN
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY admin/sitmun-admin-app/package*.json ./
COPY admin/sitmun-admin-app/.npmrc ./
RUN npm set //npm.pkg.github.com/:_authToken $GITHUB_TOKEN
RUN npm ci
COPY --chown=node:node admin/sitmun-admin-app/*.json admin/sitmun-admin-app/*.js ./
COPY --chown=node:node admin/sitmun-admin-app/src/ ./src/
COPY --chown=node:node admin/sitmun-admin-app/dist/sitmun-frontend-gui ./dist/sitmun-frontend-gui/
COPY --chown=node:node admin/sitmun-admin-app/dist/sitmun-frontend-core ./dist/sitmun-frontend-core/
COPY --chown=node:node admin/environment.testdeployment.ts ./src/environments/environment.testdeployment.ts
RUN npm run build -- --configuration=testdeployment --baseHref=/admin/ --source-map=true

# Stage 1, "build-viewer-app", based on Node.js, to build and compile the frontend
FROM node:18 AS build-viewer-app
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY viewer/sitmun-viewer-app/package*.json ./
RUN npm ci
COPY --chown=node:node viewer/sitmun-viewer-app/*.json  viewer/sitmun-viewer-app/*.js ./
COPY --chown=node:node viewer/sitmun-viewer-app/src/ ./src/
COPY --chown=node:node viewer/environment.testdeployment.ts ./src/environments/environment.testdeployment.ts
COPY --chown=node:node viewer/index.html ./src/index.html
RUN npm run build -- --configuration=testdeployment --base-href=/viewer/ --source-map=true

# Stage 2, based on Nginx, to have only the compiled app, ready for production with Nginx
FROM nginx:1.27-alpine
COPY --from=build-admin-app /home/node/app/dist/admin-app/ /usr/share/nginx/html/admin
COPY --from=build-viewer-app /home/node/app/dist/viewer-app/ /usr/share/nginx/html/viewer