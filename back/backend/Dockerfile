ARG JDK_VERSION=17
ARG JDK_TAG=0.16
ARG ALPINE_TAG=3.22

# Stage 0, "build-admin-core", based on Amazon Corretto, to build and compile the frontend
FROM amazoncorretto:${JDK_VERSION}.${JDK_TAG} AS build-backend-core
COPY sitmun-backend-core /usr/src/sitmun-backend-core
WORKDIR /usr/src/sitmun-backend-core
RUN --mount=type=cache,target=/root/.gradle-proxy ./gradlew --no-daemon -i clean build \
    -x check -x setupGitHooks

# Stage 1, based on Amazon Corretto, to have only the compiled app, ready for production with Nginx
FROM amazoncorretto:${JDK_VERSION}.${JDK_TAG}-alpine${ALPINE_TAG}
RUN apk add --no-cache curl
COPY --from=build-backend-core /usr/src/sitmun-backend-core/build/libs/*.jar /usr/src/sitmun.jar
WORKDIR /usr/src
ENTRYPOINT ["java", "-jar", "sitmun.jar"]
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl --fail http://localhost:8080/api/dashboard/health || exit 1
