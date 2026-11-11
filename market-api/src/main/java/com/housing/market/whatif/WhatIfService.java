package com.housing.market.whatif;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;

import com.housing.market.analysis.InvalidRequestException;
import com.housing.market.analysis.Stats;
import com.housing.market.config.CacheConfig;
import com.housing.market.data.Dataset;
import com.housing.market.data.Property;
import com.housing.market.ml.MlApiClient;
import com.housing.market.ml.MlModels;

/**
 * What-if analysis and model fit, both backed by ml-api batch predictions.
 *
 * <p>Caching is done with the Cache API directly (not {@code @Cacheable}) so the response can say
 * whether it was served from cache, and so the active model id is part of the key: switching models
 * in ml-api never returns predictions from the previous model.
 */
@Service
public class WhatIfService {

    private final MlApiClient ml;
    private final Cache whatIfCache;
    private final Cache modelFitCache;
    private final Dataset dataset;

    public WhatIfService(MlApiClient ml, CacheManager caches, Dataset dataset) {
        this.ml = ml;
        this.whatIfCache = Objects.requireNonNull(caches.getCache(CacheConfig.WHAT_IF));
        this.modelFitCache = Objects.requireNonNull(caches.getCache(CacheConfig.MODEL_FIT));
        this.dataset = dataset;
    }

    public WhatIfResponse analyse(WhatIfRequest req) {
        String modelId = ml.activeModelId();
        String key = modelId + "|" + req;
        WhatIfResponse hit = whatIfCache.get(key, WhatIfResponse.class);
        if (hit != null) {
            return hit.withCached(true);
        }
        WhatIfResponse fresh = compute(req, ml.features());
        whatIfCache.put(key, fresh);
        return fresh;
    }

    private WhatIfResponse compute(WhatIfRequest req, MlModels.Features features) {
        List<String> errors = new ArrayList<>();
        for (MlModels.FeatureSpec f : features.features()) {
            Double value = req.base().get(f.name());
            if (value == null) {
                errors.add("base." + f.name() + " is required");
            } else {
                checkRange(errors, "base." + f.name(), value, f);
            }
        }
        for (String name : req.base().keySet()) {
            if (features.get(name) == null) {
                errors.add("base." + name + " is not an input of the current model");
            }
        }
        MlModels.FeatureSpec spec = features.get(req.vary());
        if (spec == null) {
            errors.add("vary must be one of: " + String.join(", ", features.features().stream()
                    .map(MlModels.FeatureSpec::name).toList()));
        } else {
            checkRange(errors, "from", req.from(), spec);
            checkRange(errors, "to", req.to(), spec);
            if (req.from() >= req.to()) {
                errors.add("from must be less than to");
            }
        }
        if (!errors.isEmpty()) {
            throw new InvalidRequestException("Invalid what-if request", errors);
        }

        // Evenly spaced values; integer features are rounded and de-duplicated.
        Set<Double> values = new LinkedHashSet<>();
        for (int i = 0; i < req.steps(); i++) {
            double v = req.from() + (req.to() - req.from()) * i / (req.steps() - 1);
            values.add(spec.isInt() ? Math.rint(v) : Stats.round(v));
        }

        // Row 0 is the base property; the rest vary one feature. One batch call to ml-api.
        Map<String, Double> base = ordered(req.base(), features);
        List<Map<String, Double>> rows = new ArrayList<>();
        rows.add(base);
        for (double v : values) {
            Map<String, Double> row = new LinkedHashMap<>(base);
            row.put(req.vary(), v);
            rows.add(row);
        }
        MlModels.Prediction prediction = ml.predict(rows);
        double basePrice = prediction.predictions().getFirst();
        List<WhatIfResponse.Point> points = new ArrayList<>();
        int i = 1;
        for (double v : values) {
            double price = prediction.predictions().get(i++);
            points.add(new WhatIfResponse.Point(v, price, Stats.round(price - basePrice)));
        }
        return new WhatIfResponse(prediction.modelId(), req.vary(), base.get(req.vary()), basePrice, base, points,
                false);
    }

    public record FitPoint(int id, double actual, double predicted, double error) {
    }

    public record ModelFit(String modelId, int count, double mae, double rmse, List<FitPoint> points, boolean cached) {
    }

    /** Predicts every dataset row with the active model and compares with the recorded price. */
    public ModelFit modelFit() {
        String modelId = ml.activeModelId();
        ModelFit hit = modelFitCache.get(modelId, ModelFit.class);
        if (hit != null) {
            return new ModelFit(hit.modelId(), hit.count(), hit.mae(), hit.rmse(), hit.points(), true);
        }
        MlModels.Features features = ml.features();
        List<Property> props = dataset.properties();
        List<Map<String, Double>> rows = props.stream().map(p -> ordered(p.features(), features)).toList();
        MlModels.Prediction prediction = ml.predict(rows);
        List<FitPoint> points = new ArrayList<>();
        double abs = 0, sq = 0;
        for (int i = 0; i < props.size(); i++) {
            double actual = props.get(i).price();
            double predicted = prediction.predictions().get(i);
            points.add(new FitPoint(props.get(i).id(), actual, predicted, Stats.round(predicted - actual)));
            abs += Math.abs(predicted - actual);
            sq += (predicted - actual) * (predicted - actual);
        }
        ModelFit fit = new ModelFit(prediction.modelId(), props.size(), Stats.round(abs / props.size()),
                Stats.round(Math.sqrt(sq / props.size())), points, false);
        modelFitCache.put(modelId, fit);
        return fit;
    }

    /** Only the model's inputs, in model order (extra dataset columns are dropped). */
    private static Map<String, Double> ordered(Map<String, Double> values, MlModels.Features features) {
        Map<String, Double> out = new LinkedHashMap<>();
        for (MlModels.FeatureSpec f : features.features()) {
            Double v = values.get(f.name());
            if (v == null) {
                throw new InvalidRequestException("Missing value for model input '" + f.name() + "'");
            }
            out.put(f.name(), v);
        }
        return out;
    }

    private static void checkRange(List<String> errors, String field, double v, MlModels.FeatureSpec spec) {
        if (spec.min() != null && v < spec.min()) {
            errors.add(field + " must be at least " + spec.min());
        }
        if (spec.max() != null && v > spec.max()) {
            errors.add(field + " must be at most " + spec.max());
        }
    }
}
