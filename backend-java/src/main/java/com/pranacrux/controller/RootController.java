package com.pranacrux.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class RootController {

    @GetMapping("/")
    public Map<String, Object> root() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "PranaCrux Backend");
        body.put("status", "UP");
        body.put("api", "/api");
        body.put("health", "/api/health");
        body.put("timestamp", Instant.now().toString());
        return body;
    }
}