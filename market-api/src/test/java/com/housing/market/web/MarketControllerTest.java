package com.housing.market.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.InvocationOnMock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.housing.market.ml.MlApiClient;
import com.housing.market.ml.MlApiUnavailableException;
import com.housing.market.ml.MlModels;

@SpringBootTest(properties = "market.dataset-path=../data/House_Price_Dataset.csv")
@AutoConfigureMockMvc
class MarketControllerTest {

    private static final List<String> NAMES = List.of("square_footage", "bedrooms", "bathrooms", "year_built",
            "lot_size", "distance_to_city_center", "school_rating");
    private static final String BASE = """
            {"square_footage":1550,"bedrooms":3,"bathrooms":2,"year_built":1997,
             "lot_size":6800,"distance_to_city_center":4.1,"school_rating":7.6}""";

    @Autowired
    MockMvc mvc;
    @Autowired
    CacheManager caches;
    @MockitoBean
    MlApiClient ml;

    @BeforeEach
    void setUp() {
        caches.getCacheNames().forEach(n -> caches.getCache(n).clear());
        reset(ml);
        when(ml.activeModelId()).thenReturn("mdl_a");
        when(ml.features()).thenReturn(new MlModels.Features("mdl_a", "price", List.of(
                new MlModels.FeatureSpec("square_footage", "float", 100.0, 20000.0, "", 1550.0),
                new MlModels.FeatureSpec("bedrooms", "int", 0.0, 20.0, "", 3.0),
                new MlModels.FeatureSpec("bathrooms", "float", 0.0, 20.0, "", 2.0),
                new MlModels.FeatureSpec("year_built", "int", 1800.0, 2100.0, "", 1997.0),
                new MlModels.FeatureSpec("lot_size", "float", 0.0, 1e6, "", 6800.0),
                new MlModels.FeatureSpec("distance_to_city_center", "float", 0.0, 500.0, "", 4.1),
                new MlModels.FeatureSpec("school_rating", "float", 0.0, 10.0, "", 7.6))));
        // Fake model: price = 100 * square_footage + 10000 * bedrooms
        when(ml.predict(anyList())).thenAnswer(MarketControllerTest::fakePredict);
    }

    @SuppressWarnings("unchecked")
    private static MlModels.Prediction fakePredict(InvocationOnMock inv) {
        List<Map<String, Double>> rows = inv.getArgument(0);
        assertThat(rows.getFirst().keySet()).containsExactlyElementsOf(NAMES); // model order
        return new MlModels.Prediction("mdl_a", rows.size(), rows.stream()
                .map(r -> 100 * r.get("square_footage") + 10000 * r.get("bedrooms")).toList());
    }

    @Test
    void summaryWithFilters() throws Exception {
        mvc.perform(get("/api/market/summary").param("bedrooms.min", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(37))
                .andExpect(jsonPath("$.totalProperties").value(50))
                .andExpect(jsonPath("$.price.median").value(275000.0));
    }

    @Test
    void unknownFilterColumnIsProblemDetail() throws Exception {
        mvc.perform(get("/api/market/summary").param("garage.min", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Invalid request"))
                .andExpect(jsonPath("$.errors[0]").value("unknown filter column 'garage'"));
    }

    @Test
    void segmentsAndUnknownGroupBy() throws Exception {
        mvc.perform(get("/api/market/segments").param("groupBy", "school_band"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.segments[0].label").value("Under 7"));
        mvc.perform(get("/api/market/segments").param("groupBy", "colour"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void metaDescribesColumns() throws Exception {
        mvc.perform(get("/api/market/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.features.length()").value(7))
                .andExpect(jsonPath("$.ranges.price[0]").value(160000.0))
                .andExpect(jsonPath("$.groupBy", hasItem("decade")));
    }

    @Test
    void whatIfIsComputedOnceThenServedFromCache() throws Exception {
        String body = """
                {"base": %s, "vary": "square_footage", "from": 1000, "to": 2000, "steps": 3}""".formatted(BASE);
        mvc.perform(post("/api/market/what-if").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cached").value(false))
                .andExpect(jsonPath("$.basePrice").value(185000.0))
                .andExpect(jsonPath("$.points[0].value").value(1000.0))
                .andExpect(jsonPath("$.points[0].delta").value(-55000.0))
                .andExpect(jsonPath("$.points.length()").value(3));
        mvc.perform(post("/api/market/what-if").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cached").value(true));
        verify(ml, times(1)).predict(anyList());

        // A different active model must not reuse the cached result.
        when(ml.activeModelId()).thenReturn("mdl_b");
        mvc.perform(post("/api/market/what-if").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(jsonPath("$.cached").value(false));
        verify(ml, times(2)).predict(anyList());

        mvc.perform(get("/api/market/cache-stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'whatIf')].hits").value(hasItem(1)));
    }

    @Test
    void whatIfRoundsIntegerFeatures() throws Exception {
        String body = """
                {"base": %s, "vary": "bedrooms", "from": 1, "to": 5, "steps": 9}""".formatted(BASE);
        mvc.perform(post("/api/market/what-if").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.points.length()").value(5)); // 1..5, duplicates removed
    }

    @Test
    void whatIfValidation() throws Exception {
        String missing = """
                {"base": {"square_footage": 1500}, "vary": "colour", "from": 5, "to": 1}""";
        mvc.perform(post("/api/market/what-if").contentType(MediaType.APPLICATION_JSON).content(missing))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasItem("base.bedrooms is required")))
                .andExpect(jsonPath("$.errors", hasItem(containsString("vary must be one of"))));
        String tooManySteps = """
                {"base": %s, "vary": "bedrooms", "from": 1, "to": 5, "steps": 500}""".formatted(BASE);
        mvc.perform(post("/api/market/what-if").contentType(MediaType.APPLICATION_JSON).content(tooManySteps))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value("steps must be less than or equal to 50"));
    }

    @Test
    void mlApiDownIs503() throws Exception {
        when(ml.activeModelId()).thenThrow(new MlApiUnavailableException("the prediction service is unreachable"));
        mvc.perform(get("/api/market/model-fit"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.detail").value(
                        "Model-based analysis is unavailable: the prediction service is unreachable."));
        // Statistics don't need the model and keep working.
        mvc.perform(get("/api/market/summary")).andExpect(status().isOk());
    }

    @Test
    void modelFitComparesEveryProperty() throws Exception {
        mvc.perform(get("/api/market/model-fit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(50))
                .andExpect(jsonPath("$.points[0].actual").value(185000.0))
                .andExpect(jsonPath("$.points[0].predicted").value(145000.0)); // 100*1250 + 10000*2
    }

    @Test
    void csvExportHonoursFiltersAndSort() throws Exception {
        String csv = mvc.perform(get("/api/market/export.csv").param("bedrooms.min", "4").param("sort", "price")
                        .param("dir", "asc"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("attachment; filename=\"property-market-")))
                .andExpect(header().string("Content-Type", containsString("text/csv")))
                .andReturn().getResponse().getContentAsString();
        List<String> lines = csv.lines().toList();
        assertThat(lines.getFirst()).isEqualTo("id,square_footage,bedrooms,bathrooms,year_built,lot_size,"
                + "distance_to_city_center,school_rating,price,price_per_sqft");
        assertThat(lines).hasSize(16); // header + 15 four-bedroom houses
        assertThat(lines.get(1)).contains(",335000,");
    }

    @Test
    void pdfExportIsAPdf() throws Exception {
        byte[] pdf = mvc.perform(get("/api/market/export.pdf").param("price.max", "250000"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        assertThat(pdf.length).isGreaterThan(1500);
    }

    @Test
    void statisticsAreCached() throws Exception {
        var summaryCache = ((org.springframework.cache.caffeine.CaffeineCache) caches.getCache("summary"))
                .getNativeCache();
        var before = summaryCache.stats();
        for (int i = 0; i < 3; i++) {
            mvc.perform(get("/api/market/summary").param("bedrooms.min", "4")).andExpect(status().isOk());
        }
        var delta = summaryCache.stats().minus(before);
        assertThat(delta.missCount()).isEqualTo(1); // computed once
        assertThat(delta.hitCount()).isEqualTo(2);  // then served from cache
    }
}
