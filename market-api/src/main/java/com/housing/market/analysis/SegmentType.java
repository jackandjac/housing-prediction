package com.housing.market.analysis;

import java.util.function.DoubleFunction;

/**
 * Ways to split the market into segments. Each maps a feature value to a segment key; keys sort
 * in a natural order and have a display label.
 */
public enum SegmentType {
    BEDROOMS("bedrooms", v -> String.valueOf((int) v), k -> k + " bed"),
    BATHROOMS("bathrooms", v -> trim(v), k -> k + " bath"),
    DECADE("year_built", v -> String.valueOf((int) (Math.floor(v / 10) * 10)), k -> k + "s"),
    SCHOOL_BAND("school_rating", v -> v < 7 ? "0" : v < 8 ? "7" : v < 9 ? "8" : "9",
            k -> switch (k) {
                case "0" -> "Under 7";
                case "9" -> "9 and above";
                default -> k + " to " + (Integer.parseInt(k) + 1);
            }),
    DISTANCE_BAND("distance_to_city_center", v -> v < 3 ? "0" : v < 5 ? "3" : v < 7 ? "5" : "7",
            k -> switch (k) {
                case "0" -> "Under 3 mi";
                case "7" -> "7 mi and more";
                default -> k + " to " + (Integer.parseInt(k) + 2) + " mi";
            });

    private final String feature;
    private final DoubleFunction<String> keyFn;
    private final java.util.function.Function<String, String> labelFn;

    SegmentType(String feature, DoubleFunction<String> keyFn, java.util.function.Function<String, String> labelFn) {
        this.feature = feature;
        this.keyFn = keyFn;
        this.labelFn = labelFn;
    }

    public String feature() {
        return feature;
    }

    public String key(double value) {
        return keyFn.apply(value);
    }

    public String label(String key) {
        return labelFn.apply(key);
    }

    /** Accepts "bedrooms", "school_band", "school-band" (case-insensitive). */
    public static SegmentType parse(String raw) {
        try {
            return valueOf(raw.trim().toUpperCase().replace('-', '_'));
        } catch (IllegalArgumentException e) {
            throw new InvalidRequestException("Unknown groupBy '" + raw + "'. Use one of: bedrooms, bathrooms, "
                    + "decade, school_band, distance_band.");
        }
    }

    private static String trim(double v) {
        return v == Math.rint(v) ? String.valueOf((int) v) : String.valueOf(v);
    }
}
