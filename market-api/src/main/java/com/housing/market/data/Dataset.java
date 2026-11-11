package com.housing.market.data;

import java.util.List;

/** The loaded dataset: rows plus the feature column names in file order. */
public record Dataset(List<Property> properties, List<String> featureNames, String source) {

    public Dataset {
        properties = List.copyOf(properties);
        featureNames = List.copyOf(featureNames);
    }

    public boolean hasFeature(String name) {
        return featureNames.contains(name);
    }

    /** Columns that can be sorted, filtered or charted: features plus derived price columns. */
    public boolean hasColumn(String name) {
        return hasFeature(name) || name.equals("price") || name.equals("price_per_sqft") || name.equals("id");
    }
}
