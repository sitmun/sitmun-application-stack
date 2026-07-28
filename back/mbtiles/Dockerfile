ARG JDK_VERSION=17
ARG JDK_TAG=0.17
ARG ALPINE_TAG=3.22

FROM amazoncorretto:${JDK_VERSION}.${JDK_TAG} AS build-mbtiles
COPY sitmun-mbtiles /usr/src/sitmun-mbtiles
WORKDIR /usr/src/sitmun-mbtiles
RUN --mount=type=cache,target=/root/.gradle-mbtiles \
    GRADLE_USER_HOME=/root/.gradle-mbtiles ./gradlew --no-daemon -i build \
    -x check -x setupGitHooks

FROM amazoncorretto:${JDK_VERSION}.${JDK_TAG}-alpine${ALPINE_TAG}
RUN apk add --no-cache curl
COPY --from=build-mbtiles /usr/src/sitmun-mbtiles/build/libs/*.jar /usr/src/mbtiles.jar
WORKDIR /usr/src
VOLUME ["/tmp/mbtiles"]
ENV JAVA_OPTS="-Xms256m -Xmx512m"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar mbtiles.jar"]
HEALTHCHECK --interval=30s --timeout=30s --start-period=20s --retries=3 \
  CMD curl --fail http://localhost:8080/actuator/health || exit 1
