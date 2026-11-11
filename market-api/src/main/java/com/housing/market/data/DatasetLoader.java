package com.housing.market.data;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.housing.market.config.MarketProperties;

/** Loads the housing CSV once at startup and exposes it as a {@link Dataset} bean. */
@Configuration
public class DatasetLoader {

    private static final Logger log = LoggerFactory.getLogger(DatasetLoader.class);
    private static final char BOM = '﻿';

    @Bean
    public Dataset dataset(MarketProperties props) throws IOException {
        // Bound as a String: Spring's String-to-Path conversion goes through resource loading and
        // rejects relative paths such as ../data/... when running from a jar.
        Path path = Path.of(props.datasetPath()).toAbsolutePath().normalize();
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            Dataset dataset = parse(reader, props.targetColumn(), path.toString());
            log.info("loaded {} properties with features {} from {}",
                    dataset.properties().size(), dataset.featureNames(), dataset.source());
            return dataset;
        }
    }

    /** Parses a CSV with an optional "id" column, a target column and numeric feature columns. */
    public static Dataset parse(Reader reader, String target, String source) throws IOException {
        CSVFormat format = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setTrim(true).get();
        try (CSVParser parser = CSVParser.parse(reader, format)) {
            List<String> header = parser.getHeaderNames().stream().map(DatasetLoader::cleanHeader).toList();
            if (!header.contains(target)) {
                throw new IllegalStateException(source + ": missing target column '" + target + "'");
            }
            List<String> features = header.stream().filter(h -> !h.equals(target) && !h.equals("id")).toList();
            List<String> rawHeader = parser.getHeaderNames();

            List<Property> rows = new ArrayList<>();
            for (CSVRecord rec : parser) {
                Map<String, Double> values = new LinkedHashMap<>();
                Double price = null;
                Integer id = null;
                for (int i = 0; i < header.size(); i++) {
                    String name = header.get(i);
                    double value = number(rec.get(rawHeader.get(i)), name, rec.getRecordNumber() + 1, source);
                    if (name.equals(target)) {
                        price = value;
                    } else if (name.equals("id")) {
                        id = (int) value;
                    } else {
                        values.put(name, value);
                    }
                }
                rows.add(new Property(id != null ? id : rows.size() + 1, values, price));
            }
            if (rows.isEmpty()) {
                throw new IllegalStateException(source + ": no data rows");
            }
            return new Dataset(rows, features, source);
        }
    }

    /** Excel-exported CSVs start with a byte-order mark that would otherwise end up in the first header. */
    private static String cleanHeader(String h) {
        String s = h.trim();
        return !s.isEmpty() && s.charAt(0) == BOM ? s.substring(1).trim() : s;
    }

    private static double number(String raw, String column, long line, String source) {
        try {
            return Double.parseDouble(raw);
        } catch (NumberFormatException e) {
            throw new IllegalStateException(
                    "%s line %d: column '%s' is not a number: '%s'".formatted(source, line, column, raw), e);
        }
    }
}
