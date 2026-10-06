ARG JDK_VERSION=17
ARG JDK_TAG=0.17
ARG ALPINE_TAG=3.22

# Stage 0, based on Amazon Corretto, to compile the shared library and the proxy
FROM amazoncorretto:${JDK_VERSION}.${JDK_TAG} AS build-proxy-middleware
COPY shared/sitmun-shared /usr/src/sitmun-shared
WORKDIR /usr/src/sitmun-shared
RUN --mount=type=cache,target=/root/.gradle-shared \
    GRADLE_USER_HOME=/root/.gradle-shared ./gradlew --no-daemon publishToMavenLocal -x test

COPY proxy/sitmun-proxy-middleware /usr/src/sitmun-proxy-middleware
WORKDIR /usr/src/sitmun-proxy-middleware
RUN --mount=type=cache,target=/root/.gradle-proxy \
    GRADLE_USER_HOME=/root/.gradle-proxy ./gradlew --no-daemon -i build \
    -x check -x setupGitHooks

# Stage 1, based on Amazon Corretto, to have only the compiled app
FROM amazoncorretto:${JDK_VERSION}.${JDK_TAG}-alpine${ALPINE_TAG}
RUN apk add --no-cache curl
COPY --from=build-proxy-middleware /usr/src/sitmun-proxy-middleware/build/libs/*.jar /usr/src/proxy.jar
WORKDIR /usr/src
ENTRYPOINT ["java", "-jar", "proxy.jar"]
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl --fail http://localhost:8080/actuator/health || exit 1
