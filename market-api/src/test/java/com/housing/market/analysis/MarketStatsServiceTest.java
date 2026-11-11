package com.housing.market.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.util.LinkedMultiValueMap;

import com.housing.market.TestData;
import com.housing.market.data.Dataset;

/** Expected numbers were computed independently with pandas. */
class MarketStatsServiceTest {

    private final Dataset dataset = TestData.dataset();
    private final MarketStatsService stats = new MarketStatsService(dataset);

    private PropertyFilter filter(String... kv) {
        var params = new LinkedMultiValueMap<String, String>();
        for (int i = 0; i < kv.length; i += 2) {
            params.add(kv[i], kv[i + 1]);
        }
        return PropertyFilter.from(params, dataset);
    }

    @Test
    void summaryMatchesPandas() {
        var s = stats.summary(PropertyFilter.NONE);
        assertThat(s.count()).isEqualTo(50);
        assertThat(s.price().mean()).isEqualTo(264600.0);
        assertThat(s.price().median()).isEqualTo(245000.0);
        assertThat(s.price().p25()).isEqualTo(195000.0);
        assertThat(s.price().p75()).isEqualTo(345000.0);
        assertThat(s.price().min()).isEqualTo(160000.0);
        assertThat(s.price().max()).isEqualTo(410000.0);
        assertThat(s.pricePerSqft().median()).isEqualTo(149.8);
    }

    @Test
    void filtersNarrowTheMarket() {
        var s = stats.summary(filter("bedrooms.min", "3"));
        assertThat(s.count()).isEqualTo(37);
        assertThat(s.price().median()).isEqualTo(275000.0);
        assertThat(stats.summary(filter("price.min", "999999")).count()).isZero();
    }

    @Test
    void segmentsByBedrooms() {
        var seg = stats.segments(SegmentType.BEDROOMS, PropertyFilter.NONE).segments();
        assertThat(seg).extracting(MarketStatsService.Segment::label).containsExactly("2 bed", "3 bed", "4 bed");
        assertThat(seg).extracting(MarketStatsService.Segment::count).containsExactly(13, 22, 15);
        assertThat(seg).extracting(MarketStatsService.Segment::medianPrice)
                .containsExactly(175000.0, 235000.0, 375000.0);
    }

    @Test
    void decadesSortNumerically() {
        var seg = stats.segments(SegmentType.DECADE, PropertyFilter.NONE).segments();
        assertThat(seg).extracting(MarketStatsService.Segment::label).containsExactly("1970s", "1980s", "1990s",
                "2000s", "2010s");
    }

    @Test
    void distributionCountsEveryProperty() {
        var bins = stats.distribution("price", 5, PropertyFilter.NONE).bins();
        assertThat(bins).hasSize(5);
        assertThat(bins.stream().mapToInt(MarketStatsService.Bin::count).sum()).isEqualTo(50);
        assertThat(bins.getFirst().from()).isEqualTo(160000.0);
        assertThat(bins.getLast().to()).isEqualTo(410000.0);
    }

    @Test
    void correlationsStrongestFirst() {
        List<MarketStatsService.Correlation> c = stats.correlations(PropertyFilter.NONE);
        assertThat(c.getFirst().feature()).isEqualTo("lot_size");
        assertThat(c.getFirst().r()).isEqualTo(0.99);
        assertThat(c.getLast().feature()).isEqualTo("bedrooms");
    }

    @Test
    void propertiesSortAndPage() {
        var page = stats.properties(PropertyFilter.NONE, "price", "desc", 0, 3);
        assertThat(page.total()).isEqualTo(50);
        assertThat(page.items()).extracting(MarketStatsService.PropertyRow::price)
                .containsExactly(410000.0, 405000.0, 400000.0);
        var last = stats.properties(PropertyFilter.NONE, "square_footage", "asc", 16, 3);
        assertThat(last.items()).hasSize(2); // 50 rows, pages of 3: page 16 holds rows 49-50
    }

    @Test
    void rejectsUnknownColumnsAndBadFilters() {
        assertThatThrownBy(() -> stats.properties(PropertyFilter.NONE, "colour", "asc", 0, 10))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("Unknown column 'colour'");
        assertThatThrownBy(() -> filter("garage.min", "1"))
                .isInstanceOf(InvalidRequestException.class)
                .satisfies(e -> assertThat(((InvalidRequestException) e).errors())
                        .containsExactly("unknown filter column 'garage'"));
        assertThatThrownBy(() -> filter("price.min", "5", "price.max", "1"))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> filter("price.min", "cheap")).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void equalFiltersAreEqualCacheKeys() {
        assertThat(filter("bedrooms.min", "3", "price.max", "300000"))
                .isEqualTo(filter("price.max", "300000", "bedrooms.min", "3"));
    }
}
