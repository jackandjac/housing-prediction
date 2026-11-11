package com.housing.market.web;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.housing.market.analysis.InvalidRequestException;
import com.housing.market.analysis.MarketStatsService;
import com.housing.market.analysis.MarketStatsService.Correlation;
import com.housing.market.analysis.MarketStatsService.Distribution;
import com.housing.market.analysis.MarketStatsService.MarketSummary;
import com.housing.market.analysis.MarketStatsService.PropertyPage;
import com.housing.market.analysis.MarketStatsService.Segments;
import com.housing.market.analysis.PropertyFilter;
import com.housing.market.analysis.SegmentType;
import com.housing.market.export.ExportService;
import com.housing.market.whatif.WhatIfRequest;
import com.housing.market.whatif.WhatIfResponse;
import com.housing.market.whatif.WhatIfService;
import com.housing.market.whatif.WhatIfService.ModelFit;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * Market analysis endpoints. Every read endpoint accepts range filters as query parameters:
 * {@code <column>.min} / {@code <column>.max}, where column is price, price_per_sqft or any feature.
 */
@RestController
@RequestMapping("/api/market")
@Tag(name = "market", description = "Aggregate statistics, what-if analysis and exports")
public class MarketController {

    private static final String FILTER_DOC = "Range filters: <column>.min / <column>.max, e.g. bedrooms.min=3, "
            + "price.max=300000. Columns: price, price_per_sqft and every dataset feature.";

    private final MarketStatsService stats;
    private final WhatIfService whatIf;
    private final ExportService export;
    private final CacheManager caches;

    public MarketController(MarketStatsService stats, WhatIfService whatIf, ExportService export,
            CacheManager caches) {
        this.stats = stats;
        this.whatIf = whatIf;
        this.export = export;
        this.caches = caches;
    }

    public record Meta(int totalProperties, List<String> features, List<String> groupBy,
            Map<String, double[]> ranges) {
    }

    @GetMapping("/meta")
    @Operation(summary = "Dataset columns, value ranges and grouping options (for building filter UIs)")
    public Meta meta() {
        var ds = stats.dataset();
        Map<String, double[]> ranges = new java.util.LinkedHashMap<>();
        List<String> cols = new ArrayList<>(ds.featureNames());
        cols.add("price");
        cols.add("price_per_sqft");
        for (String c : cols) {
            var values = ds.properties().stream().map(p -> p.value(c)).filter(java.util.Objects::nonNull)
                    .mapToDouble(Double::doubleValue).summaryStatistics();
            if (values.getCount() > 0) {
                ranges.put(c, new double[] {values.getMin(), values.getMax()});
            }
        }
        List<String> groupBy = java.util.Arrays.stream(SegmentType.values())
                .filter(t -> ds.hasFeature(t.feature())).map(t -> t.name().toLowerCase()).toList();
        return new Meta(ds.properties().size(), ds.featureNames(), groupBy, ranges);
    }

    @GetMapping("/summary")
    @Operation(summary = "Count, price and price-per-sq-ft statistics, and feature averages")
    public MarketSummary summary(@Parameter(description = FILTER_DOC) @RequestParam MultiValueMap<String, String> params) {
        return stats.summary(filter(params));
    }

    @GetMapping("/segments")
    @Operation(summary = "Statistics per market segment")
    public Segments segments(
            @Parameter(description = "bedrooms | bathrooms | decade | school_band | distance_band")
            @RequestParam(defaultValue = "bedrooms") String groupBy,
            @Parameter(description = FILTER_DOC) @RequestParam MultiValueMap<String, String> params) {
        return stats.segments(SegmentType.parse(groupBy), filter(params));
    }

    @GetMapping("/distribution")
    @Operation(summary = "Histogram of a column")
    public Distribution distribution(@RequestParam(defaultValue = "price") String field,
            @RequestParam(defaultValue = "8") int bins,
            @Parameter(description = FILTER_DOC) @RequestParam MultiValueMap<String, String> params) {
        return stats.distribution(field, bins, filter(params));
    }

    @GetMapping("/correlations")
    @Operation(summary = "Pearson correlation of each feature with price, strongest first")
    public List<Correlation> correlations(
            @Parameter(description = FILTER_DOC) @RequestParam MultiValueMap<String, String> params) {
        return stats.correlations(filter(params));
    }

    @GetMapping("/properties")
    @Operation(summary = "Filtered, sorted, paged property rows")
    public PropertyPage properties(@RequestParam(defaultValue = "price") String sort,
            @RequestParam(defaultValue = "desc") String dir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @Parameter(description = FILTER_DOC) @RequestParam MultiValueMap<String, String> params) {
        if (page < 0 || size < 1 || size > 200) {
            throw new InvalidRequestException("page must be >= 0 and size between 1 and 200");
        }
        return stats.properties(filter(params), sort, dir, page, size);
    }

    @PostMapping("/what-if")
    @Operation(summary = "Predicted price as one feature varies, everything else fixed (uses the ML model)")
    public WhatIfResponse whatIf(@Valid @RequestBody WhatIfRequest request) {
        return whatIf.analyse(request);
    }

    @GetMapping("/model-fit")
    @Operation(summary = "Model predictions vs recorded prices for every property in the dataset")
    public ModelFit modelFit() {
        return whatIf.modelFit();
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    @Operation(summary = "Filtered properties as CSV")
    public ResponseEntity<byte[]> exportCsv(@RequestParam(defaultValue = "price") String sort,
            @RequestParam(defaultValue = "desc") String dir,
            @Parameter(description = FILTER_DOC) @RequestParam MultiValueMap<String, String> params) {
        return download(export.csv(filter(params), sort, dir), "csv", new MediaType("text", "csv"));
    }

    @GetMapping(value = "/export.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Report with summary, segments and filtered properties as PDF")
    public ResponseEntity<byte[]> exportPdf(@RequestParam(defaultValue = "price") String sort,
            @RequestParam(defaultValue = "desc") String dir,
            @Parameter(description = FILTER_DOC) @RequestParam MultiValueMap<String, String> params) {
        return download(export.pdf(filter(params), sort, dir), "pdf", MediaType.APPLICATION_PDF);
    }

    public record CacheStats(String name, long size, long hits, long misses, double hitRate, long evictions) {
    }

    @GetMapping("/cache-stats")
    @Operation(summary = "Hit and miss counts for each cache")
    public List<CacheStats> cacheStats() {
        return caches.getCacheNames().stream().sorted().map(name -> {
            var cache = ((CaffeineCache) caches.getCache(name)).getNativeCache();
            var s = cache.stats();
            return new CacheStats(name, cache.estimatedSize(), s.hitCount(), s.missCount(),
                    Math.round(s.hitRate() * 1000) / 1000.0, s.evictionCount());
        }).toList();
    }

    private PropertyFilter filter(MultiValueMap<String, String> params) {
        return PropertyFilter.from(params, stats.dataset());
    }

    private static ResponseEntity<byte[]> download(byte[] body, String ext, MediaType type) {
        String filename = "property-market-" + LocalDate.now() + "." + ext;
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(body);
    }
}
