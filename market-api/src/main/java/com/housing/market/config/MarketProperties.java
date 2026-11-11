package com.housing.market.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings under {@code market.*} in application.yml (overridable with env vars such as
 * {@code MARKET_ML_API_URL}).
 */
@ConfigurationProperties("market")
public record MarketProperties(
        @DefaultValue("../data/House_Price_Dataset.csv") String datasetPath,
        @DefaultValue("price") String targetColumn,
        @DefaultValue("http://localhost:8000") String mlApiUrl,
        @DefaultValue("5s") Duration mlApiTimeout) {
}
