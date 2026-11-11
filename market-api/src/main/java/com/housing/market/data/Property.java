package com.housing.market.data;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * One row of the housing dataset. Features are kept in a map (column order preserved) so new
 * columns in the CSV need no code changes.
 */
public record Property(int id, Map<String, Double> features, double price) {

    public static final String SQUARE_FOOTAGE = "square_footage";

    public Property {
        features = Collections.unmodifiableMap(new LinkedHashMap<>(features)); // keeps CSV column order
    }

    public Double feature(String name) {
        return features.get(name);
    }

    /** Price per square foot, or null when the dataset has no square_footage column. */
    public Double pricePerSqft() {
        Double sqft = features.get(SQUARE_FOOTAGE);
        return sqft == null || sqft == 0 ? null : price / sqft;
    }

    /** Value of a column by name: "price", "price_per_sqft", "id", or any feature. */
    public Double value(String column) {
        return switch (column) {
            case "price" -> price;
            case "price_per_sqft" -> pricePerSqft();
            case "id" -> (double) id;
            default -> features.get(column);
        };
    }
}
