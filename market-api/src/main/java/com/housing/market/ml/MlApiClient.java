package com.housing.market.ml;

import java.net.http.HttpClient;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import com.housing.market.analysis.InvalidRequestException;
import com.housing.market.config.CacheConfig;
import com.housing.market.config.MarketProperties;

/** Calls the Task 1 ML API. Schema and active-model lookups are cached for a few seconds. */
@Component
public class MlApiClient {

    private final RestClient http;

    @Autowired
    public MlApiClient(RestClient.Builder builder, MarketProperties props) {
        // HTTP/1.1 explicitly: the JDK client otherwise attempts an h2c upgrade on plain http://,
        // which uvicorn (ml-api) does not support for POST bodies; the body arrives empty.
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(props.mlApiTimeout())
                .build());
        factory.setReadTimeout(props.mlApiTimeout());
        this.http = builder.baseUrl(props.mlApiUrl()).requestFactory(factory).build();
    }

    /** For tests: use a pre-configured RestClient (e.g. bound to MockRestServiceServer). */
    MlApiClient(RestClient http) {
        this.http = http;
    }

    @Cacheable(CacheConfig.ML_FEATURES)
    public MlModels.Features features() {
        return call(() -> http.get().uri("/features").retrieve().body(MlModels.Features.class));
    }

    /** Id of the model currently serving predictions; part of every model-dependent cache key. */
    @Cacheable(CacheConfig.ML_ACTIVE_MODEL)
    public String activeModelId() {
        MlModels.Health health = call(() -> http.get().uri("/health").retrieve().body(MlModels.Health.class));
        if (health == null || !health.modelLoaded() || health.activeModelId() == null) {
            throw new MlApiUnavailableException("the prediction service has no active model");
        }
        return health.activeModelId();
    }

    public MlModels.Prediction predict(List<Map<String, Double>> rows) {
        return call(() -> http.post().uri("/predict").contentType(MediaType.APPLICATION_JSON).body(rows)
                .retrieve().body(MlModels.Prediction.class));
    }

    private static <T> T call(java.util.function.Supplier<T> request) {
        try {
            return request.get();
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == HttpStatus.UNPROCESSABLE_ENTITY.value()) {
                throw new InvalidRequestException("The model rejected the input: " + e.getResponseBodyAsString());
            }
            if (e.getStatusCode().value() == HttpStatus.SERVICE_UNAVAILABLE.value()) {
                throw new MlApiUnavailableException("the prediction service has no active model");
            }
            throw new MlApiUnavailableException("the prediction service returned HTTP " + e.getStatusCode().value());
        } catch (ResourceAccessException e) {
            throw new MlApiUnavailableException("the prediction service is unreachable or timed out");
        } catch (RestClientException e) {
            throw new MlApiUnavailableException("unexpected response from the prediction service");
        }
    }
}
