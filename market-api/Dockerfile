# Build from the repository root:
#   docker build -f market-api/Dockerfile -t housing-market-api .
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY market-api/.mvn .mvn
COPY market-api/mvnw market-api/pom.xml ./
RUN ./mvnw -q -B dependency:go-offline
COPY market-api/src src
RUN ./mvnw -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 appuser
COPY --from=build /src/target/market-api.jar app.jar
COPY data/House_Price_Dataset.csv data/House_Price_Dataset.csv
USER appuser

ENV MARKET_DATASET_PATH=/app/data/House_Price_Dataset.csv \
    ML_API_URL=http://ml-api:8000 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=3 \
    CMD ["sh", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /actuator/health HTTP/1.0\\r\\n\\r\\n' >&3 && grep -q UP <&3"]

ENTRYPOINT ["java", "-jar", "app.jar"]
