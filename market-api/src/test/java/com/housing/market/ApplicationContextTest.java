package com.housing.market;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.housing.market.ml.MlApiClient;

/** Starts the full context with the real beans (no mocks), as the packaged jar does. */
@SpringBootTest(properties = "market.dataset-path=../data/House_Price_Dataset.csv")
class ApplicationContextTest {

    @Autowired
    MlApiClient ml;

    @Test
    void contextStartsWithRealMlClient() {
        assertThat(ml).isNotNull();
    }
}
