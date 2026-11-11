package com.housing.market.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import io.swagger.v3.oas.annotations.Hidden;

@Controller
@Hidden
public class RootController {

    @GetMapping("/")
    public String root() {
        return "redirect:/swagger-ui.html";
    }
}
