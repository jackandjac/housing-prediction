package com.housing.market.analysis;

import java.util.List;

/** A client error (HTTP 400) carrying one message per problem. */
public class InvalidRequestException extends RuntimeException {

    private final List<String> errors;

    public InvalidRequestException(String message, List<String> errors) {
        super(message);
        this.errors = List.copyOf(errors);
    }

    public InvalidRequestException(String message) {
        this(message, List.of(message));
    }

    public List<String> errors() {
        return errors;
    }
}
