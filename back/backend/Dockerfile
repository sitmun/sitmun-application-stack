ARG JDK_VERSION=17
ARG JDK_TAG=0.17
ARG ALPINE_TAG=3.22

# Stage 0, based on Amazon Corretto, to compile the shared library and the backend
FROM amazoncorretto:${JDK_VERSION}.${JDK_TAG} AS build-backend-core
COPY shared/sitmun-shared /usr/src/sitmun-shared
WORKDIR /usr/src/sitmun-shared
RUN --mount=type=cache,target=/root/.gradle-shared \
    GRADLE_USER_HOME=/root/.gradle-shared ./gradlew --no-daemon publishToMavenLocal -x test

COPY backend/sitmun-backend-core /usr/src/sitmun-backend-core
WORKDIR /usr/src/sitmun-backend-core
RUN --mount=type=cache,target=/root/.gradle-backend \
    GRADLE_USER_HOME=/root/.gradle-backend ./gradlew --no-daemon -i build \
    -x check -x setupGitHooks

# Stage 1, based on Amazon Corretto, to have only the compiled app, ready for production with Nginx
FROM amazoncorretto:${JDK_VERSION}.${JDK_TAG}-alpine${ALPINE_TAG}
RUN apk add --no-cache curl
COPY --from=build-backend-core /usr/src/sitmun-backend-core/build/libs/*.jar /usr/src/sitmun.jar
WORKDIR /usr/src
ENTRYPOINT ["java", "-jar", "sitmun.jar"]
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl --fail http://localhost:8080/api/dashboard/health || exit 1
