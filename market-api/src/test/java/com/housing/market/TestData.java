package com.housing.market;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import com.housing.market.data.Dataset;
import com.housing.market.data.DatasetLoader;

public final class TestData {

    public static final Path DATASET = Path.of("..", "data", "House_Price_Dataset.csv");

    private TestData() {
    }

    public static Dataset dataset() {
        try (Reader r = Files.newBufferedReader(DATASET, StandardCharsets.UTF_8)) {
            return DatasetLoader.parse(r, "price", DATASET.toString());
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
