package com.housing.market.web;

import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import com.housing.market.analysis.InvalidRequestException;
import com.housing.market.ml.MlApiUnavailableException;

/** Maps errors to RFC 9457 problem details with an {@code errors} list the portal can show. */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(InvalidRequestException.class)
    public ProblemDetail invalid(InvalidRequestException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
        pd.setTitle("Invalid request");
        pd.setProperty("errors", e.errors());
        return pd;
    }

    @ExceptionHandler(MlApiUnavailableException.class)
    public ProblemDetail mlUnavailable(MlApiUnavailableException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "Model-based analysis is unavailable: " + e.getMessage() + ".");
        pd.setTitle("Prediction service unavailable");
        pd.setProperty("errors", List.of(e.getMessage()));
        return pd;
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<String> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + " " + f.getDefaultMessage()).toList();
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Invalid what-if request");
        pd.setTitle("Invalid request");
        pd.setProperty("errors", errors);
        return ResponseEntity.badRequest().body(pd);
    }
}
