package com.housing.market.whatif;

import java.util.List;
import java.util.Map;

public record WhatIfResponse(
        String modelId,
        String vary,
        double baseValue,
        double basePrice,
        Map<String, Double> base,
        List<Point> points,
        boolean cached) {

    public record Point(double value, double price, double delta) {
    }

    WhatIfResponse withCached(boolean cached) {
        return new WhatIfResponse(modelId, vary, baseValue, basePrice, base, points, cached);
    }
}
