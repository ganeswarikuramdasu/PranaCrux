package com.pranacrux.config;

import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.pranacrux.entity.User;
import com.pranacrux.repository.UserRepository;

@Component
public class DemoAccountsSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoAccountsSeeder.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${DEMO_SEED_ENABLED:false}")
    private boolean seedEnabled;

    @Value("${DEMO_PATIENT_EMAIL:}")
    private String patientEmail;
    @Value("${DEMO_PATIENT_PASSWORD:}")
    private String patientPassword;
    @Value("${DEMO_DOCTOR_EMAIL:}")
    private String doctorEmail;
    @Value("${DEMO_DOCTOR_PASSWORD:}")
    private String doctorPassword;
    @Value("${DEMO_HOSPITAL_EMAIL:}")
    private String hospitalEmail;
    @Value("${DEMO_HOSPITAL_PASSWORD:}")
    private String hospitalPassword;

    public DemoAccountsSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (!seedEnabled) {
            log.info("[demo-seed] disabled; no demo account passwords changed");
            return;
        }

        resetPassword("PATIENT", patientEmail, patientPassword);
        resetPassword("DOCTOR", doctorEmail, doctorPassword);
        resetPassword("HOSPITAL_ADMIN", hospitalEmail, hospitalPassword);
    }

    private void resetPassword(String role, String email, String password) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            log.warn("[demo-seed] missing configuration for role {}; skipped", role);
            return;
        }

        userRepository.findByEmailIgnoreCase(email.trim()).ifPresentOrElse(user -> {
            if (!role.equals(user.getRole())) {
                log.warn("[demo-seed] configured account role mismatch for {}; skipped", role);
                return;
            }
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
            log.info("[demo-seed] reset configured local demo account for role {}", role);
        }, () -> log.warn("[demo-seed] configured account not found for role {}; skipped", role));
    }
}
