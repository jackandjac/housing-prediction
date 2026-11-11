package com.housing.market.config;

import java.time.Duration;

import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.github.benmanes.caffeine.cache.Caffeine;

/**
 * One Caffeine cache per concern, each with its own size and lifetime. Statistics are recorded
 * so hit rates show up at {@code GET /api/market/cache-stats} and in actuator metrics.
 */
@Configuration
public class CacheConfig {

    public static final String SUMMARY = "summary";
    public static final String SEGMENTS = "segments";
    public static final String DISTRIBUTION = "distribution";
    public static final String CORRELATIONS = "correlations";
    public static final String PROPERTIES = "properties";
    public static final String WHAT_IF = "whatIf";
    public static final String MODEL_FIT = "modelFit";
    public static final String ML_FEATURES = "mlFeatures";
    public static final String ML_ACTIVE_MODEL = "mlActiveModel";

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.setAllowNullValues(false);
        // The dataset never changes while the service runs, so statistics can live long.
        for (String name : new String[] {SUMMARY, SEGMENTS, DISTRIBUTION, CORRELATIONS, PROPERTIES}) {
            manager.registerCustomCache(name, build(500, Duration.ofHours(1)));
        }
        // Model-dependent results are keyed by model id, so a model switch never serves stale data.
        manager.registerCustomCache(WHAT_IF, build(1000, Duration.ofMinutes(30)));
        manager.registerCustomCache(MODEL_FIT, build(20, Duration.ofMinutes(30)));
        // Short TTLs: these follow ml-api's active model.
        manager.registerCustomCache(ML_FEATURES, build(1, Duration.ofSeconds(30)));
        manager.registerCustomCache(ML_ACTIVE_MODEL, build(1, Duration.ofSeconds(20)));
        return manager;
    }

    private static com.github.benmanes.caffeine.cache.Cache<Object, Object> build(long maxSize, Duration ttl) {
        return Caffeine.newBuilder().maximumSize(maxSize).expireAfterWrite(ttl).recordStats().build();
    }
}
