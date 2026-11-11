package com.housing.market.ml;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** DTOs for the ml-api responses this service reads. Unknown fields are ignored. */
public final class MlModels {

    private MlModels() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FeatureSpec(String name, String type, Double min, Double max, String description, Double example) {
        public boolean isInt() {
            return "int".equals(type);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Features(@JsonProperty("model_id") String modelId, String target, List<FeatureSpec> features) {
        public FeatureSpec get(String name) {
            return features.stream().filter(f -> f.name().equals(name)).findFirst().orElse(null);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Health(String status, @JsonProperty("model_loaded") boolean modelLoaded,
            @JsonProperty("active_model_id") String activeModelId) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Prediction(@JsonProperty("model_id") String modelId, int count, List<Double> predictions) {
    }
}
