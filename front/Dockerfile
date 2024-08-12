# Stage 0, "build-admin-app", based on Node.js, to build and compile the frontend
FROM node:18 AS build-admin-app
ARG FRONT_CONTEXT_PATH=/
RUN export FRONT_CONTEXT_PATH=${FRONT_CONTEXT_PATH}
RUN apt-get update && apt-get install -y gettext
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY admin/sitmun-admin-app/package*.json ./
RUN npm install
RUN npm ci
COPY --chown=node:node admin/sitmun-admin-app/*.json admin/sitmun-admin-app/*.js ./
COPY --chown=node:node admin/sitmun-admin-app/src/ ./src/
COPY --chown=node:node admin/environment.testdeployment.ts.template ./src/environments/environment.testdeployment.ts.template
RUN envsubst < ./src/environments/environment.testdeployment.ts.template > ./src/environments/environment.testdeployment.ts
RUN npm run build -- --configuration=testdeployment --base-href=${FRONT_CONTEXT_PATH}admin/ --source-map=true

# Stage 1, "build-viewer-app", based on Node.js, to build and compile the frontend
FROM node:18 AS build-viewer-app
ARG FRONT_CONTEXT_PATH=/
RUN export FRONT_CONTEXT_PATH=${FRONT_CONTEXT_PATH}
RUN apt-get update && apt-get install -y gettext
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY viewer/sitmun-viewer-app/package*.json ./
RUN npm ci
COPY --chown=node:node viewer/sitmun-viewer-app/*.json  viewer/sitmun-viewer-app/*.js ./
COPY --chown=node:node viewer/sitmun-viewer-app/src/ ./src/
COPY --chown=node:node viewer/environment.testdeployment.ts.template ./src/environments/environment.testdeployment.ts.template
COPY --chown=node:node viewer/index.html.template ./src/index.html.template
RUN envsubst < ./src/environments/environment.testdeployment.ts.template > ./src/environments/environment.testdeployment.ts
RUN envsubst < ./src/index.html.template > ./src/index.html
RUN npm run build -- --configuration=testdeployment --base-href=${FRONT_CONTEXT_PATH}viewer/ --source-map=true

# Stage 2, based on Nginx, to have only the compiled app, ready for production with Nginx
FROM nginx:1.27-alpine
COPY --from=build-admin-app /home/node/app/dist/admin-app/ /usr/share/nginx/html/admin
COPY --from=build-viewer-app /home/node/app/dist/viewer-app/ /usr/share/nginx/html/viewer
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl --fail http://localhost:8080/actuator/health || exit 1