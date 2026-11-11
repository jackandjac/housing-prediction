package com.housing.market.ml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServiceUnavailable;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.housing.market.analysis.InvalidRequestException;

class MlApiClientTest {

    private MockRestServiceServer server;
    private MlApiClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ml-api");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new MlApiClient(builder.build());
    }

    @Test
    void parsesFeatures() {
        server.expect(requestTo("http://ml-api/features")).andRespond(withSuccess("""
                {"model_id":"mdl_1","target":"price","features":[
                  {"name":"bedrooms","type":"int","min":0,"max":20,"description":"Bedrooms","example":3}]}""",
                MediaType.APPLICATION_JSON));
        MlModels.Features f = client.features();
        assertThat(f.modelId()).isEqualTo("mdl_1");
        assertThat(f.get("bedrooms").isInt()).isTrue();
        assertThat(f.get("bedrooms").max()).isEqualTo(20.0);
    }

    @Test
    void activeModelIdFromHealth() {
        server.expect(requestTo("http://ml-api/health")).andRespond(withSuccess("""
                {"status":"ok","model_loaded":true,"active_model_id":"mdl_9"}""", MediaType.APPLICATION_JSON));
        assertThat(client.activeModelId()).isEqualTo("mdl_9");
    }

    @Test
    void noModelLoadedIsUnavailable() {
        server.expect(requestTo("http://ml-api/health")).andRespond(withSuccess("""
                {"status":"ok","model_loaded":false,"active_model_id":null}""", MediaType.APPLICATION_JSON));
        assertThatThrownBy(client::activeModelId).isInstanceOf(MlApiUnavailableException.class)
                .hasMessage("the prediction service has no active model");
    }

    @Test
    void predictSendsBatch() {
        server.expect(requestTo("http://ml-api/predict"))
                .andExpect(content().json("[{\"bedrooms\":3.0}]"))
                .andRespond(withSuccess("""
                        {"model_id":"mdl_1","count":1,"predictions":[250000.5]}""", MediaType.APPLICATION_JSON));
        assertThat(client.predict(List.of(Map.of("bedrooms", 3.0))).predictions()).containsExactly(250000.5);
    }

    @Test
    void errorsAreMapped() {
        server.expect(requestTo("http://ml-api/predict")).andRespond(withServiceUnavailable());
        assertThatThrownBy(() -> client.predict(List.of())).isInstanceOf(MlApiUnavailableException.class);
        server.reset();

        server.expect(requestTo("http://ml-api/predict")).andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY)
                .body("{\"detail\":\"bad\"}"));
        assertThatThrownBy(() -> client.predict(List.of())).isInstanceOf(InvalidRequestException.class);
        server.reset();

        server.expect(requestTo("http://ml-api/predict")).andRespond(withException(new IOException("refused")));
        assertThatThrownBy(() -> client.predict(List.of())).isInstanceOf(MlApiUnavailableException.class)
                .hasMessage("the prediction service is unreachable or timed out");
    }
}
