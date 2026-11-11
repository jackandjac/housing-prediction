package com.housing.market.analysis;

import java.util.Arrays;
import java.util.List;

/** Small descriptive-statistics helpers. Inputs must be non-empty. */
public final class Stats {

    private Stats() {
    }

    public record Summary(double min, double p25, double median, double p75, double max, double mean) {
    }

    public static Summary summarize(List<Double> values) {
        double[] v = values.stream().mapToDouble(Double::doubleValue).sorted().toArray();
        return new Summary(v[0], percentile(v, 25), percentile(v, 50), percentile(v, 75), v[v.length - 1],
                round(Arrays.stream(v).average().orElseThrow()));
    }

    public static double median(List<Double> values) {
        return percentile(values.stream().mapToDouble(Double::doubleValue).sorted().toArray(), 50);
    }

    public static double mean(List<Double> values) {
        return round(values.stream().mapToDouble(Double::doubleValue).average().orElseThrow());
    }

    /** Linear interpolation between closest ranks (same as numpy's default). */
    static double percentile(double[] sorted, double p) {
        double rank = p / 100.0 * (sorted.length - 1);
        int lo = (int) Math.floor(rank);
        int hi = (int) Math.ceil(rank);
        return round(sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo));
    }

    /** Pearson correlation; NaN when either series is constant. */
    public static double pearson(double[] x, double[] y) {
        double mx = Arrays.stream(x).average().orElse(0);
        double my = Arrays.stream(y).average().orElse(0);
        double sxy = 0, sxx = 0, syy = 0;
        for (int i = 0; i < x.length; i++) {
            sxy += (x[i] - mx) * (y[i] - my);
            sxx += (x[i] - mx) * (x[i] - mx);
            syy += (y[i] - my) * (y[i] - my);
        }
        return sxx == 0 || syy == 0 ? Double.NaN : sxy / Math.sqrt(sxx * syy);
    }

    public static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
