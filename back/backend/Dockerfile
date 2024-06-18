# Stage 0, "build-admin-core", based on OpenJDK 11, to build and compile the frontend
FROM openjdk:11 AS build-backend-core
COPY sitmun-backend-core /usr/src/sitmun-backend-core
RUN rm -rf /usr/src/sitmun-backend-core/deploy/heroku-dev-full/src/main/resources/config
WORKDIR /usr/src/sitmun-backend-core
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon -i stage

# Stage 1, based on OpenJDK, to have only the compiled app, ready for production with Nginx
FROM openjdk:11-jre-slim-buster
COPY --from=build-backend-core /usr/src/sitmun-backend-core/deploy/heroku-dev-full/build/libs/*.jar /usr/src/sitmun.jar
WORKDIR /usr/src
ENTRYPOINT ["java", "-jar", "sitmun.jar"]
