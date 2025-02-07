ARG JDK_TAG=0.26
ARG ALPINE_TAG=3.21

# Stage 0, "build-proxy-middleware", based on Amazon Corretto 11, to build and compile the frontend
FROM amazoncorretto:11.${JDK_TAG} AS build-proxy-middleware
COPY sitmun-proxy-middleware /usr/src/sitmun-proxy-middleware
WORKDIR /usr/src/sitmun-proxy-middleware
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon -i clean build -x test

# Stage 1, based on Amazon Corretto 11, to have only the compiled app
FROM amazoncorretto:11.${JDK_TAG}-alpine${ALPINE_TAG}
RUN apk add --no-cache curl
COPY --from=build-proxy-middleware /usr/src/sitmun-proxy-middleware/build/libs/*.jar /usr/src/proxy.jar
WORKDIR /usr/src
ENTRYPOINT ["java", "-jar", "proxy.jar"]
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl --fail http://localhost || exit 1
