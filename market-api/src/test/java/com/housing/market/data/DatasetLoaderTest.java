package com.housing.market.data;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.StringReader;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.housing.market.TestData;

class DatasetLoaderTest {

    @Test
    void loadsBundledDatasetWithBomHeader() {
        Dataset ds = TestData.dataset();
        assertThat(ds.properties()).hasSize(50);
        // The file starts with a byte-order mark; the first column must still be recognised as "id".
        assertThat(ds.featureNames()).containsExactly("square_footage", "bedrooms", "bathrooms", "year_built",
                "lot_size", "distance_to_city_center", "school_rating");
        Property first = ds.properties().getFirst();
        assertThat(first.id()).isEqualTo(1);
        assertThat(first.price()).isEqualTo(185000);
        assertThat(first.features().keySet()).containsExactlyElementsOf(ds.featureNames()); // order kept
    }

    @Test
    void newColumnsBecomeFeaturesWithoutCodeChanges() throws Exception {
        String csv = "﻿id,square_footage,garage_spaces,price\n1,1000,2,150000\n2,1200,1,170000\n";
        Dataset ds = DatasetLoader.parse(new StringReader(csv), "price", "inline");
        assertThat(ds.featureNames()).isEqualTo(List.of("square_footage", "garage_spaces"));
        assertThat(ds.properties().get(1).feature("garage_spaces")).isEqualTo(1.0);
    }

    @Test
    void rejectsMissingTargetAndBadNumbers() {
        assertThatThrownBy(() -> DatasetLoader.parse(new StringReader("a,b\n1,2\n"), "price", "x"))
                .hasMessageContaining("missing target column 'price'");
        assertThatThrownBy(() -> DatasetLoader.parse(new StringReader("a,price\nfoo,2\n"), "price", "x"))
                .hasMessageContaining("line 2: column 'a' is not a number");
    }
}
