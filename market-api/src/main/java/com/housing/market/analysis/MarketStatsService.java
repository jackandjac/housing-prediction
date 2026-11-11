package com.housing.market.analysis;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.housing.market.config.CacheConfig;
import com.housing.market.data.Dataset;
import com.housing.market.data.Property;

/**
 * Aggregate statistics over the housing dataset. Every public method is cached by its arguments
 * (filters are records, so equal filters share an entry).
 */
@Service
public class MarketStatsService {

    private final Dataset dataset;

    public MarketStatsService(Dataset dataset) {
        this.dataset = dataset;
    }

    // ---- response records ---------------------------------------------------------------------

    public record MarketSummary(int count, int totalProperties, Stats.Summary price, Stats.Summary pricePerSqft,
            Map<String, Double> featureAverages) {
    }

    public record Segment(String key, String label, int count, double medianPrice, double meanPrice,
            double minPrice, double maxPrice, Double medianPricePerSqft) {
    }

    public record Segments(String groupBy, String feature, List<Segment> segments) {
    }

    public record Bin(double from, double to, int count) {
    }

    public record Distribution(String field, List<Bin> bins) {
    }

    public record Correlation(String feature, double r) {
    }

    public record PropertyRow(int id, Map<String, Double> features, double price, Double pricePerSqft) {
        static PropertyRow of(Property p) {
            Double ppsf = p.pricePerSqft();
            return new PropertyRow(p.id(), p.features(), p.price(), ppsf == null ? null : Stats.round(ppsf));
        }
    }

    public record PropertyPage(List<PropertyRow> items, int total, int page, int size, String sort, String dir) {
    }

    // ---- queries --------------------------------------------------------------------------------

    public List<Property> filtered(PropertyFilter filter) {
        return dataset.properties().stream().filter(filter).toList();
    }

    @Cacheable(CacheConfig.SUMMARY)
    public MarketSummary summary(PropertyFilter filter) {
        List<Property> rows = filtered(filter);
        int total = dataset.properties().size();
        if (rows.isEmpty()) {
            return new MarketSummary(0, total, null, null, Map.of());
        }
        List<Double> ppsf = rows.stream().map(Property::pricePerSqft).filter(Objects::nonNull).toList();
        Map<String, Double> averages = new LinkedHashMap<>();
        for (String f : dataset.featureNames()) {
            averages.put(f, Stats.mean(rows.stream().map(p -> p.feature(f)).toList()));
        }
        return new MarketSummary(rows.size(), total, Stats.summarize(prices(rows)),
                ppsf.isEmpty() ? null : Stats.summarize(ppsf), averages);
    }

    @Cacheable(CacheConfig.SEGMENTS)
    public Segments segments(SegmentType type, PropertyFilter filter) {
        if (!dataset.hasFeature(type.feature())) {
            throw new InvalidRequestException("The dataset has no '" + type.feature() + "' column to group by.");
        }
        Map<String, List<Property>> groups = filtered(filter).stream()
                .collect(Collectors.groupingBy(p -> type.key(p.feature(type.feature())),
                        () -> new TreeMap<>(Comparator.comparingDouble(Double::parseDouble)), Collectors.toList()));
        List<Segment> segments = new ArrayList<>();
        groups.forEach((key, rows) -> {
            List<Double> prices = prices(rows);
            List<Double> ppsf = rows.stream().map(Property::pricePerSqft).filter(Objects::nonNull).toList();
            Stats.Summary s = Stats.summarize(prices);
            segments.add(new Segment(key, type.label(key), rows.size(), s.median(), s.mean(), s.min(), s.max(),
                    ppsf.isEmpty() ? null : Stats.median(ppsf)));
        });
        return new Segments(type.name().toLowerCase(), type.feature(), segments);
    }

    @Cacheable(CacheConfig.DISTRIBUTION)
    public Distribution distribution(String field, int bins, PropertyFilter filter) {
        requireColumn(field);
        if (bins < 2 || bins > 30) {
            throw new InvalidRequestException("bins must be between 2 and 30");
        }
        List<Double> values = filtered(filter).stream().map(p -> p.value(field)).filter(Objects::nonNull).toList();
        if (values.isEmpty()) {
            return new Distribution(field, List.of());
        }
        double min = values.stream().mapToDouble(Double::doubleValue).min().orElseThrow();
        double max = values.stream().mapToDouble(Double::doubleValue).max().orElseThrow();
        double width = max > min ? (max - min) / bins : 1;
        int[] counts = new int[bins];
        for (double v : values) {
            counts[Math.min(bins - 1, (int) ((v - min) / width))]++;
        }
        List<Bin> out = new ArrayList<>();
        for (int i = 0; i < bins; i++) {
            out.add(new Bin(Stats.round(min + i * width), Stats.round(min + (i + 1) * width), counts[i]));
        }
        return new Distribution(field, out);
    }

    /** How strongly each feature moves with price, strongest first. */
    @Cacheable(CacheConfig.CORRELATIONS)
    public List<Correlation> correlations(PropertyFilter filter) {
        List<Property> rows = filtered(filter);
        if (rows.size() < 3) {
            return List.of();
        }
        double[] price = rows.stream().mapToDouble(Property::price).toArray();
        return dataset.featureNames().stream()
                .map(f -> new Correlation(f, Stats.pearson(rows.stream().mapToDouble(p -> p.feature(f)).toArray(), price)))
                .filter(c -> !Double.isNaN(c.r()))
                .map(c -> new Correlation(c.feature(), Math.round(c.r() * 1000) / 1000.0))
                .sorted(Comparator.comparingDouble((Correlation c) -> Math.abs(c.r())).reversed())
                .toList();
    }

    @Cacheable(CacheConfig.PROPERTIES)
    public PropertyPage properties(PropertyFilter filter, String sort, String dir, int page, int size) {
        List<PropertyRow> all = sorted(filter, sort, dir).stream().map(PropertyRow::of).toList();
        int from = Math.min(page * size, all.size());
        int to = Math.min(from + size, all.size());
        return new PropertyPage(all.subList(from, to), all.size(), page, size, sort, dir);
    }

    /** All matching rows in the requested order (used by exports). */
    public List<Property> sorted(PropertyFilter filter, String sort, String dir) {
        requireColumn(sort);
        Comparator<Property> cmp = Comparator.comparing(p -> p.value(sort),
                Comparator.nullsLast(Comparator.naturalOrder()));
        if ("desc".equalsIgnoreCase(dir)) {
            cmp = cmp.reversed();
        } else if (!"asc".equalsIgnoreCase(dir)) {
            throw new InvalidRequestException("dir must be 'asc' or 'desc'");
        }
        return filtered(filter).stream().sorted(cmp.thenComparingInt(Property::id)).toList();
    }

    public Dataset dataset() {
        return dataset;
    }

    private void requireColumn(String column) {
        if (!dataset.hasColumn(column)) {
            throw new InvalidRequestException("Unknown column '" + column + "'. Use price, price_per_sqft, id or one "
                    + "of: " + String.join(", ", dataset.featureNames()));
        }
    }

    private static List<Double> prices(List<Property> rows) {
        return rows.stream().map(Property::price).toList();
    }
}
