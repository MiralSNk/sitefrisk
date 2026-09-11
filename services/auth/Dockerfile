FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

# *.jar — маска на случай, если имя файла чуть отличается от ожидаемого
COPY --from=builder --chown=appuser:appgroup /app/target/*.jar app.jar

USER appuser

ENTRYPOINT ["java", "-jar", "app.jar"]