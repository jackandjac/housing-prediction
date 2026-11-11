package com.housing.market.whatif;

import java.util.Map;
import java.util.TreeMap;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/**
 * "What if feature X ranged from A to B, everything else fixed?" The base property is a free-form
 * map, validated against the active model's features, so new model inputs need no code changes.
 */
public record WhatIfRequest(
        @Schema(example = """
                {"square_footage":1550,"bedrooms":3,"bathrooms":2,"year_built":1997,
                 "lot_size":6800,"distance_to_city_center":4.1,"school_rating":7.6}""")
        @NotEmpty Map<String, Double> base,
        @Schema(example = "square_footage") @NotBlank String vary,
        @Schema(example = "1000") @NotNull Double from,
        @Schema(example = "2500") @NotNull Double to,
        @Schema(example = "11", defaultValue = "11") @Min(2) @Max(50) Integer steps) {

    public WhatIfRequest {
        base = base == null ? null : new TreeMap<>(base);
        steps = steps == null ? 11 : steps;
    }
}
