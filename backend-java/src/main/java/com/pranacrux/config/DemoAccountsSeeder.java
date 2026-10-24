package com.pranacrux.config;

import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.pranacrux.entity.User;
import com.pranacrux.entity.PatientProfile;
import com.pranacrux.entity.Doctor;
import com.pranacrux.entity.Hospital;
import com.pranacrux.repository.DoctorRepository;
import com.pranacrux.repository.HospitalRepository;
import com.pranacrux.repository.PatientProfileRepository;
import com.pranacrux.repository.UserRepository;

@Component
public class DemoAccountsSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoAccountsSeeder.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PatientProfileRepository patientProfileRepository;
    private final DoctorRepository doctorRepository;
    private final HospitalRepository hospitalRepository;

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
    @Value("${SUPER_ADMIN_EMAIL:}")
    private String adminEmail;
    @Value("${SUPER_ADMIN_PASSWORD:}")
    private String adminPassword;

    public DemoAccountsSeeder(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            PatientProfileRepository patientProfileRepository,
            DoctorRepository doctorRepository,
            HospitalRepository hospitalRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.patientProfileRepository = patientProfileRepository;
        this.doctorRepository = doctorRepository;
        this.hospitalRepository = hospitalRepository;
    }

    @Override
    public void run(String... args) {
        if (!seedEnabled) {
            log.info("[demo-seed] disabled; no demo account passwords changed");
            return;
        }

        User patient = ensureAccount("PATIENT", "Demo Patient", patientEmail, patientPassword, "demo_patient");
        if (patient != null) {
            patientProfileRepository.findById(patient.getId()).orElseGet(() -> patientProfileRepository.save(
                    PatientProfile.builder()
                            .userId(patient.getId())
                            .patientHealthId("NH-DEMO-00000001")
                            .bloodGroup("O+")
                            .build()));
        }

        User doctor = ensureAccount("DOCTOR", "Demo Doctor", doctorEmail, doctorPassword, "demo_doctor");
        if (doctor != null && doctorRepository.findByUserId(doctor.getId()).isEmpty()) {
            doctorRepository.save(Doctor.builder()
                    .id("demo_doctor_profile")
                    .user(doctor)
                    .name(doctor.getName())
                    .email(doctor.getEmail())
                    .specialization("General Medicine")
                    .licenseNumber("DEMO-LICENSE-001")
                    .status("APPROVED")
                    .isActive(true)
                    .build());
        }

        User hospitalAdmin = ensureAccount(
                "HOSPITAL_ADMIN", "Demo Hospital Admin", hospitalEmail, hospitalPassword, "demo_hospital_admin");
        if (hospitalAdmin != null && hospitalRepository.findByAdminUserId(hospitalAdmin.getId()).isEmpty()) {
            hospitalRepository.save(Hospital.builder()
                    .id("demo_hospital")
                    .adminUser(hospitalAdmin)
                    .name("PranaCrux Demo Hospital")
                    .email(hospitalAdmin.getEmail())
                    .licenseNumber("DEMO-HOSPITAL-001")
                    .status("APPROVED")
                    .build());
        }

        if (adminEmail == null || adminEmail.isBlank() || adminPassword == null || adminPassword.isBlank()) {
            log.warn("[demo-seed] super-admin demo credentials are not configured");
        }
    }

    private User ensureAccount(String role, String name, String email, String password, String id) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            log.warn("[demo-seed] missing configuration for role {}; skipped", role);
            return null;
        }

        User user = userRepository.findByEmailIgnoreCaseAndRole(email.trim(), role).orElseGet(() ->
                User.builder()
                        .id(id)
                        .name(name)
                        .email(email.trim())
                        .role(role)
                        .status("ACTIVE")
                        .build());
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);
        log.info("[demo-seed] ensured local demo account for role {}", role);
        return saved;
    }
}
