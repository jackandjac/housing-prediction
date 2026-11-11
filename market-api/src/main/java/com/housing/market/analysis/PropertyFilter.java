package com.housing.market.analysis;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.function.Predicate;

import org.springframework.util.MultiValueMap;

import com.housing.market.data.Dataset;
import com.housing.market.data.Property;

/**
 * Range filters on any column, parsed from query parameters of the form {@code <column>.min} and
 * {@code <column>.max}, e.g. {@code ?bedrooms.min=3&price.max=300000}. Because the column names come
 * from the dataset, new CSV columns are filterable without code changes.
 *
 * <p>A record, so equal filters are equal cache keys.
 */
public record PropertyFilter(SortedMap<String, Range> ranges) implements Predicate<Property> {

    public record Range(Double min, Double max) {
        boolean contains(Double v) {
            return v != null && (min == null || v >= min) && (max == null || v <= max);
        }
    }

    public static final PropertyFilter NONE = new PropertyFilter(new TreeMap<>());

    public PropertyFilter {
        ranges = Collections.unmodifiableSortedMap(new TreeMap<>(ranges));
    }

    public static PropertyFilter from(MultiValueMap<String, String> params, Dataset dataset) {
        SortedMap<String, Double[]> bounds = new TreeMap<>();
        List<String> errors = new ArrayList<>();
        for (Map.Entry<String, List<String>> e : params.entrySet()) {
            String key = e.getKey();
            boolean isMin = key.endsWith(".min");
            if (!isMin && !key.endsWith(".max")) {
                continue; // not a filter (sort, page, ...)
            }
            String column = key.substring(0, key.length() - 4);
            if (!dataset.hasColumn(column)) {
                errors.add("unknown filter column '" + column + "'");
                continue;
            }
            String raw = e.getValue().isEmpty() ? "" : e.getValue().getFirst().trim();
            if (raw.isEmpty()) {
                continue;
            }
            try {
                bounds.computeIfAbsent(column, c -> new Double[2])[isMin ? 0 : 1] = Double.parseDouble(raw);
            } catch (NumberFormatException ex) {
                errors.add("'" + key + "' must be a number");
            }
        }
        bounds.forEach((col, b) -> {
            if (b[0] != null && b[1] != null && b[0] > b[1]) {
                errors.add("'" + col + ".min' is greater than '" + col + ".max'");
            }
        });
        if (!errors.isEmpty()) {
            throw new InvalidRequestException("Invalid filters", errors);
        }
        SortedMap<String, Range> ranges = new TreeMap<>();
        bounds.forEach((col, b) -> ranges.put(col, new Range(b[0], b[1])));
        return new PropertyFilter(ranges);
    }

    @Override
    public boolean test(Property p) {
        return ranges.entrySet().stream().allMatch(e -> e.getValue().contains(p.value(e.getKey())));
    }

    public boolean isEmpty() {
        return ranges.isEmpty();
    }

    /** Human-readable description, used in PDF exports. */
    public String describe() {
        if (ranges.isEmpty()) {
            return "All properties";
        }
        List<String> parts = new ArrayList<>();
        ranges.forEach((col, r) -> {
            String label = col.replace('_', ' ');
            if (r.min() != null && r.max() != null) {
                parts.add(label + " " + fmt(r.min()) + "–" + fmt(r.max()));
            } else if (r.min() != null) {
                parts.add(label + " ≥ " + fmt(r.min()));
            } else {
                parts.add(label + " ≤ " + fmt(r.max()));
            }
        });
        return String.join(", ", parts);
    }

    private static String fmt(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v);
    }
}
