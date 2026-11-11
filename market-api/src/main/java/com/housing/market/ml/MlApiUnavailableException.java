package com.housing.market.ml;

/** ml-api is unreachable, timed out, or has no active model (HTTP 503 to our clients). */
public class MlApiUnavailableException extends RuntimeException {

    public MlApiUnavailableException(String message) {
        super(message);
    }
}
