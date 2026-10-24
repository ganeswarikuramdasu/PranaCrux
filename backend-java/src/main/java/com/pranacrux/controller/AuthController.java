package com.pranacrux.controller;

import com.pranacrux.common.ApiResponse;
import com.pranacrux.dto.auth.AuthRequests.*;
import com.pranacrux.service.AuthService;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/send-otp")
    public ApiResponse sendOtp(@RequestBody SendOtpRequest req) {
        return authService.sendOtp(req);
    }

    @PostMapping("/verify-otp")
    public ApiResponse verifyOtp(@RequestBody VerifyOtpRequest req) {
        return authService.verifyOtp(req);
    }

    @PostMapping("/login")
    public ApiResponse login(@RequestBody LoginRequest req, HttpServletRequest request) {
        return authenticateSession(authService.login(req), request);
    }

    @PostMapping("/register-patient")
    public ApiResponse registerPatient(@RequestBody RegisterPatientRequest req, HttpServletRequest request) {
        return authenticateSession(authService.registerPatient(req), request);
    }

    @PostMapping("/logout")
    public ApiResponse logout(HttpServletRequest request) {
        var session = request.getSession(false);
        if (session != null) session.invalidate();
        return ApiResponse.ok("Signed out.");
    }

    private ApiResponse authenticateSession(ApiResponse response, HttpServletRequest request) {
        if (Boolean.TRUE.equals(response.get("success")) && response.get("user") instanceof Map<?, ?> user) {
            var previous = request.getSession(false);
            if (previous != null) previous.invalidate();
            var session = request.getSession(true);
            session.setAttribute("authenticatedUserId", user.get("id"));
            session.setAttribute("authenticatedRole", user.get("role"));
            session.setMaxInactiveInterval(3600);
        }
        return response;
    }

    @PostMapping("/update-profile-password")
    public ApiResponse updateProfilePassword(@RequestBody UpdateProfilePasswordRequest req, HttpServletRequest request) {
        var session = request.getSession(false);
        if (session == null || session.getAttribute("authenticatedUserId") == null)
            throw com.pranacrux.common.ApiException.unauthorized("Please sign in to update your account.");
        String userId = String.valueOf(session.getAttribute("authenticatedUserId"));
        if (req.getUserId() != null && !req.getUserId().equals(userId))
            throw com.pranacrux.common.ApiException.forbidden("You can only update your own account.");
        req.setUserId(userId);
        return authService.updateProfilePassword(req);
    }
}
