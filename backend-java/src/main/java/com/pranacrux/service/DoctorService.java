package com.pranacrux.service;

import com.pranacrux.common.ApiException;
import com.pranacrux.common.ApiResponse;
import com.pranacrux.common.PasswordValidator;
import com.pranacrux.dto.doctor.DoctorRequests.*;
import com.pranacrux.dto.hospital.HospitalRequests.AddDoctorRequest;
import com.pranacrux.entity.*;
import com.pranacrux.repository.*;
import com.pranacrux.service.store.FeedbackStore;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DoctorService {

    private static final Set<String> REMOVED_BOOKING_KEYS = Set.of("workingDays", "slotDurationMin", "slotBufferMin", "tokensPerSlot", "dailyMaxAppointments", "bookingHorizonDays", "bookingCutoffMins", "weeklySchedule", "scheduleEffectiveDate", "dateOverrides", "leaves", "emergencyAbsence", "shiftSchedules", "morningShiftCapacity", "afternoonShiftCapacity", "customPreferredSlots");

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final List<String> FIXED_PROFILE_KEYS = List.of(
            "name", "email", "specialization", "fee");

    private static final Set<String> CORE_PUBLIC_KEYS = Set.of(
            "id", "userId", "name", "email", "specialization", "licenseNumber",
            "hospitalId", "hospitalName", "status", "fee", "isActive", "malpracticeCount");

    private final DoctorRepository doctorRepository;
    private final HospitalRepository hospitalRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final RecordAccessLogService recordAccessLogService;
    private final RecordAccessLogRepository recordAccessLogRepository;

    private final MedicalRecordRepository medicalRecordRepository;
    private final PatientProfileRepository patientProfileRepository;
    private final ConsentRepository consentRepository;
    private final AccessCardRepository accessCardRepository;
    private final PatientResolver patientResolver;
    private final FeedbackStore feedbackStore;
    private final PatientCareService patientCareService;

    public DoctorService(DoctorRepository doctorRepository, HospitalRepository hospitalRepository,
                          UserRepository userRepository, PasswordEncoder passwordEncoder,
                          AuditLogService auditLogService,
                          RecordAccessLogService recordAccessLogService,
                          RecordAccessLogRepository recordAccessLogRepository,

                          MedicalRecordRepository medicalRecordRepository,
                          PatientProfileRepository patientProfileRepository,
                          ConsentRepository consentRepository,
                          AccessCardRepository accessCardRepository,
                          PatientResolver patientResolver,
                          FeedbackStore feedbackStore, PatientCareService patientCareService) {
        this.doctorRepository = doctorRepository;
        this.hospitalRepository = hospitalRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
        this.recordAccessLogService = recordAccessLogService;
        this.recordAccessLogRepository = recordAccessLogRepository;

        this.medicalRecordRepository = medicalRecordRepository;
        this.patientProfileRepository = patientProfileRepository;
        this.consentRepository = consentRepository;
        this.accessCardRepository = accessCardRepository;
        this.patientResolver = patientResolver;
        this.feedbackStore = feedbackStore;
        this.patientCareService = patientCareService;
    }

    /** GET /api/doctors - frontend expects a raw array. */
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Doctor d : doctorRepository.findAllByOrderByCreatedAtDesc()) {
            out.add(toPublic(d));
        }
        return out;
    }

    @Transactional
    public ApiResponse register(RegisterDoctorRequest req) {
        if (isBlank(req.getName()) || isBlank(req.getEmail())) {
            throw ApiException.badRequest("Doctor Name and Email are required.");
        }
        if (isBlank(req.getPassword())) {
            throw ApiException.badRequest("Doctor Name, Email, and Initial Password are required.");
        }
        if (!isBlank(req.getPassword())) {
            PasswordValidator.Result pwdCheck = PasswordValidator.validate(req.getPassword());
            if (!pwdCheck.valid()) {
                throw ApiException.badRequest("Weak Password: " + pwdCheck.message());
            }
        }

        String cleanEmail = req.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCaseAndRole(cleanEmail, "DOCTOR")) {
            throw ApiException.badRequest("A DOCTOR account with email '" + req.getEmail() + "' is already registered. Please login.");
        }

        Hospital hospital = !isBlank(req.getHospitalId())
                ? hospitalRepository.findById(req.getHospitalId()).orElse(null)
                : null;

        long now = System.currentTimeMillis();
        String doctorId = "doc_" + now;
        String userId = "u_doc_" + now;
        String password = req.getPassword();
        String licenseNumber = req.getLicenseNumber() != null ? req.getLicenseNumber()
                : "MCI-2026-" + (10000 + RANDOM.nextInt(90000));
        String hospitalName = hospital != null ? hospital.getName() : "Unattached Independent Practice";
        String status = !isBlank(req.getHospitalId()) ? "PENDING_APPROVAL" : "APPROVED";

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("experienceYears", req.getExperienceYears() != null ? req.getExperienceYears() : 5);
        extra.put("rating", 5.0);

        User user = User.builder()
                .id(userId)
                .name(req.getName())
                .email(cleanEmail)
                .passwordHash(passwordEncoder.encode(password))
                .role("DOCTOR")
                .status("ACTIVE")
                .build();
        userRepository.save(user);

        Doctor.Builder doctorBuilder = Doctor.builder()
                .id(doctorId)
                .user(user)
                .hospitalId(req.getHospitalId())
                .hospitalName(hospitalName)
                .name(req.getName())
                .email(cleanEmail)
                .specialization(req.getSpecialization() != null ? req.getSpecialization() : "General Medicine")
                .licenseNumber(licenseNumber)
                .fee(BigDecimal.valueOf(req.getFee() != null ? req.getFee() : 1000))
                .status(status)
                .isActive(true)
                .extra(extra);
        if (hospital != null) doctorBuilder.hospital(hospital);
        Doctor doctor = doctorBuilder.build();
        doctorRepository.save(doctor);

        auditLogService.log(req.getName(), "DOCTOR", "DOCTOR_REGISTER", null,
                "Registered as " + doctor.getSpecialization() + ". Affiliated Hospital: " + hospitalName +
                        ". Status: " + status);

        return ApiResponse.ok().with("doctor", toPublic(doctor));
    }

    public ApiResponse getProfile(String doctorId) {
        Doctor doctor = findByIdOrUserId(doctorId);
        return ApiResponse.ok().with("doctor", toPublic(doctor));
    }

    @Transactional
    public ApiResponse updateProfile(String doctorId, UpdateDoctorProfileRequest req) {
        Doctor doctor = findByIdOrUserId(doctorId);

        if (req.containsKey("name") && req.get("name") != null) doctor.setName(String.valueOf(req.get("name")));
        if (req.containsKey("email") && req.get("email") != null) doctor.setEmail(String.valueOf(req.get("email")));
        if (req.containsKey("fee") && req.get("fee") != null) {
            doctor.setFee(new BigDecimal(String.valueOf(req.get("fee"))));
        }

        Map<String, Object> extra = new LinkedHashMap<>(doctor.getExtra());
        for (Map.Entry<String, Object> entry : req.entrySet()) {
            if (FIXED_PROFILE_KEYS.contains(entry.getKey()) || !Set.of("phone", "age", "gender", "qualification", "experienceYears", "department", "bio", "notificationPreferences", "securitySettings").contains(entry.getKey())) continue;
            if ("notificationPreferences".equals(entry.getKey()) || "securitySettings".equals(entry.getKey())) {
                Map<String, Object> merged = new LinkedHashMap<>();
                Object existing = extra.get(entry.getKey());
                if (existing instanceof Map<?, ?> m) {
                    for (Map.Entry<?, ?> e : m.entrySet()) merged.put(String.valueOf(e.getKey()), e.getValue());
                }
                if (entry.getValue() instanceof Map<?, ?> incoming) {
                    for (Map.Entry<?, ?> e : incoming.entrySet()) merged.put(String.valueOf(e.getKey()), e.getValue());
                }
                extra.put(entry.getKey(), merged);
            } else if (entry.getValue() != null) {
                extra.put(entry.getKey(), entry.getValue());
            }
        }
        doctor.setExtra(extra);
        doctorRepository.save(doctor);

        auditLogService.log(doctor.getName(), "DOCTOR", "PROFILE_UPDATE", null,
                "Updated personal and professional profile settings.");

        return ApiResponse.ok("Profile updated successfully.").with("doctor", toPublic(doctor));
    }





    /**
     * POST /api/hospital/add-doctor - hospital admin directly provisions a
     * doctor account under their own hospital. Immediately APPROVED (no
     * pending step) - different from {@link #register}, which is the
     * doctor-initiated "apply to a hospital" flow and starts PENDING_APPROVAL.
     */
    @Transactional
    public ApiResponse addDoctorByHospitalAdmin(AddDoctorRequest req) {
        if (isBlank(req.getName()) || isBlank(req.getEmail()) || isBlank(req.getPassword())) {
            throw ApiException.badRequest("Doctor Name, Official Email, and Initial Password are required.");
        }
        PasswordValidator.Result pwdCheck = PasswordValidator.validate(req.getPassword());
        if (!pwdCheck.valid()) {
            throw ApiException.badRequest("Weak Password: " + pwdCheck.message());
        }
        if (isBlank(req.getLicenseNumber())) {
            throw ApiException.badRequest("Doctor MCI License Number is required.");
        }
        if (isBlank(req.getPhone())) {
            throw ApiException.badRequest("Doctor Phone Number is required.");
        }

        String cleanEmail = req.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCaseAndRole(cleanEmail, "DOCTOR")) {
            throw ApiException.badRequest("A DOCTOR account with email '" + req.getEmail() + "' is already registered.");
        }

        Hospital hospital = !isBlank(req.getHospitalId()) ? hospitalRepository.findById(req.getHospitalId()).orElse(null) : null;
        String resolvedHospitalId = hospital != null ? hospital.getId() : req.getHospitalId();
        String resolvedHospitalName = hospital != null ? hospital.getName()
                : (req.getHospitalName() != null ? req.getHospitalName() : "Affiliated Medical Center");
        boolean hospitalActive = hospital == null || !"INACTIVE".equals(hospital.getStatus());

        long now = System.currentTimeMillis();
        String doctorId = "doc_" + now;
        String userId = "u_doc_" + now;
        String licenseNumber = req.getLicenseNumber().trim();
        String specialization = req.getSpecialization() != null ? req.getSpecialization() : "General Medicine";

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("department", req.getDepartment() != null ? req.getDepartment() : specialization);
        extra.put("experienceYears", req.getExperienceYears() != null ? req.getExperienceYears() : 5);
        extra.put("phone", req.getPhone().trim());
        extra.put("qualification", req.getQualification() != null ? req.getQualification() : "MBBS, MD");
        if (req.getAge() != null) extra.put("age", req.getAge());
        if (!isBlank(req.getGender())) extra.put("gender", req.getGender().trim());
        extra.put("rating", 5.0);

        User user = User.builder()
                .id(userId)
                .name(req.getName().trim())
                .email(cleanEmail)
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .role("DOCTOR")
                .status("ACTIVE")
                .build();
        userRepository.save(user);

        Doctor.Builder doctorBuilder = Doctor.builder()
                .id(doctorId)
                .user(user)
                .hospitalId(resolvedHospitalId)
                .hospitalName(resolvedHospitalName)
                .name(req.getName().trim())
                .email(cleanEmail)
                .specialization(specialization)
                .licenseNumber(licenseNumber)
                .fee(BigDecimal.valueOf(req.getFee() != null ? req.getFee() : 800))
                .status("APPROVED")
                .isActive(hospitalActive)
                .extra(extra);
        if (hospital != null) doctorBuilder.hospital(hospital);
        Doctor doctor = doctorBuilder.build();

        doctorRepository.save(doctor);

        auditLogService.log("Hospital Admin", "HOSPITAL_ADMIN", "DOCTOR_PROVISIONED", null,
                "Hospital " + resolvedHospitalName + " provisioned doctor account for " + doctor.getName() +
                        " (" + cleanEmail + ")");

        return ApiResponse.ok("Physician Dr. " + doctor.getName() + " added and provisioned successfully! " +
                        "The doctor can now log in using email '" + cleanEmail + "'.")
                .with("doctor", toPublic(doctor));
    }

    @Transactional
    public ApiResponse updateDoctorByHospital(com.pranacrux.dto.hospital.HospitalRequests.UpdateDoctorByHospitalRequest req) {
        Doctor doctor = doctorRepository.findById(req.getDoctorId())
                .orElseThrow(() -> ApiException.notFound("Doctor record not found."));

        if (!isBlank(req.getName())) doctor.setName(req.getName().trim());
        if (!isBlank(req.getSpecialization())) doctor.setSpecialization(req.getSpecialization().trim());
        if (!isBlank(req.getLicenseNumber())) doctor.setLicenseNumber(req.getLicenseNumber().trim());
        if (req.getFee() != null) doctor.setFee(BigDecimal.valueOf(req.getFee()));
        if (!isBlank(req.getStatus())) doctor.setStatus(req.getStatus());

        Map<String, Object> extra = new LinkedHashMap<>(doctor.getExtra());
        if (!isBlank(req.getDepartment())) extra.put("department", req.getDepartment().trim());
        if (req.getExperienceYears() != null) extra.put("experienceYears", req.getExperienceYears());
        if (!isBlank(req.getPhone())) extra.put("phone", req.getPhone().trim());
        if (!isBlank(req.getQualification())) extra.put("qualification", req.getQualification().trim());
        if (req.getAge() != null) extra.put("age", req.getAge());
        if (!isBlank(req.getGender())) extra.put("gender", req.getGender().trim());
        doctor.setExtra(extra);
        doctorRepository.save(doctor);

        if (doctor.getUserId() != null && !isBlank(req.getName())) {
            userRepository.findById(doctor.getUserId()).ifPresent(u -> {
                u.setName(req.getName().trim());
                userRepository.save(u);
            });
        }

        auditLogService.log("Hospital Admin", "HOSPITAL_ADMIN", "DOCTOR_UPDATED", null,
                "Updated details for physician " + doctor.getName() + " (" + doctor.getEmail() + ")");

        return ApiResponse.ok("Updated details for " + doctor.getName() + " successfully!").with("doctor", toPublic(doctor));
    }

    @Transactional
    public ApiResponse deleteDoctor(String doctorId, String actorName, String actorRole) {
        Doctor doctor = doctorRepository.findById(doctorId).orElse(null);
        if (doctor != null) {
            doctorRepository.delete(doctor);
            if (doctor.getUserId() != null) userRepository.deleteById(doctor.getUserId());
            auditLogService.log(actorName, actorRole,
                    "SUPER_ADMIN".equals(actorRole) ? "DOCTOR_DELETE" : "DOCTOR_DELETED", null,
                    (actorRole.equals("SUPER_ADMIN") ? "Deleted doctor profile for " : "Decommissioned and deleted doctor account ")
                            + doctor.getName() + (actorRole.equals("SUPER_ADMIN") ? "" : " (" + doctor.getEmail() + ")"));
            return ApiResponse.ok("Physician " + doctor.getName() + " decommissioned and deleted successfully.");
        }
        return ApiResponse.fail("Doctor not found.");
    }

    @Transactional
    public ApiResponse approveDoctorAffiliation(com.pranacrux.dto.hospital.HospitalRequests.ApproveDoctorRequest req) {
        Doctor doctor = doctorRepository.findById(req.getDoctorId()).orElse(null);
        if (doctor != null) {
            if ("APPROVE".equals(req.getAction())) {
                doctor.setStatus("APPROVED");
                auditLogService.log("Hospital Admin", "HOSPITAL_ADMIN", "DOCTOR_APPROVAL", null,
                        "Approved doctor " + doctor.getName());
            } else if ("REJECT".equals(req.getAction()) || "REMOVE".equals(req.getAction())) {
                doctor.setHospitalId(null);
                doctor.setHospitalName("Unattached Independent Practice");
                doctor.setStatus("PENDING_APPROVAL");
                auditLogService.log("Hospital Admin", "HOSPITAL_ADMIN", "DOCTOR_REMOVAL", null,
                        "Removed/Rejected doctor " + doctor.getName() + " affiliation.");
            }
            doctorRepository.save(doctor);
        }
        return ApiResponse.ok().with("doctor", doctor != null ? toPublic(doctor) : null);
    }

    // ========================================================================
    // NEW ENDPOINTS - Phase 6
    // ========================================================================

    /** GET /access-history, /access-logs */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getAccessHistory(String doctorId, String accessType,
                                                      String accessMethod, String patientId, String search) {
        List<RecordAccessLog> allLogs = recordAccessLogRepository.findAllByOrderByTimestampDesc();
        List<RecordAccessLog> history = new ArrayList<>(allLogs);

        if (!isBlank(doctorId)) {
            String dLower = doctorId.toLowerCase();
            history = history.stream()
                    .filter(l -> doctorId.equals(l.getDoctorId())
                            || (l.getDoctorName() != null && l.getDoctorName().toLowerCase().contains(dLower)))
                    .collect(Collectors.toCollection(ArrayList::new));
        }

        if (!isBlank(accessType) && !"ALL".equalsIgnoreCase(accessType)) {
            boolean isEmergReq = "EMERGENCY".equalsIgnoreCase(accessType);
            history = history.stream().filter(l -> {
                boolean isLogEmergency = Boolean.TRUE.equals(l.getEmergencyFlag())
                        || "EMERGENCY".equals(l.getAccessType())
                        || "EMERGENCY".equals(l.getAccessMethod())
                        || "EMERGENCY_BREAK_GLASS".equals(l.getAccessMethod())
                        || (l.getReason() != null && l.getReason().toLowerCase().contains("emergency"));
                return isEmergReq == isLogEmergency;
            }).collect(Collectors.toCollection(ArrayList::new));
        }

        if (!isBlank(accessMethod) && !"ALL".equalsIgnoreCase(accessMethod)) {
            String mUp = accessMethod.toUpperCase();
            history = history.stream().filter(l -> {
                String lMethod = (l.getAccessMethod() != null ? l.getAccessMethod() : "").toUpperCase();
                if ("QR".equals(mUp)) {
                    return "QR".equals(lMethod) || "PATIENT_ACCESS_CARD".equals(lMethod) || "ACCESS_CARD".equals(lMethod);
                }
                return lMethod.equals(mUp)
                        || ("ACCESS_CARD".equals(mUp) && ("PATIENT_ACCESS_CARD".equals(lMethod) || "QR".equals(lMethod)));
            }).collect(Collectors.toCollection(ArrayList::new));
        }

        if (!isBlank(patientId) && !"ALL".equalsIgnoreCase(patientId)) {
            String pLower = patientId.toLowerCase();
            history = history.stream().filter(l ->
                    (l.getPatientId() != null && l.getPatientId().toLowerCase().contains(pLower))
                            || (l.getPatientHealthId() != null && l.getPatientHealthId().toLowerCase().contains(pLower))
            ).collect(Collectors.toCollection(ArrayList::new));
        }

        if (!isBlank(search) && !search.trim().isEmpty()) {
            String q = search.trim().toLowerCase();
            history = history.stream().filter(l ->
                    (l.getPatientName() != null && l.getPatientName().toLowerCase().contains(q))
                            || (l.getPatientHealthId() != null && l.getPatientHealthId().toLowerCase().contains(q))
                            || (l.getReason() != null && l.getReason().toLowerCase().contains(q))
                            || (l.getAccessMethod() != null && l.getAccessMethod().toLowerCase().contains(q))
            ).collect(Collectors.toCollection(ArrayList::new));
        }

        return history.stream().map(this::mapAccessLogToResponse).collect(Collectors.toList());
    }

    /** POST /access-records, /access-patient-records */
    @Transactional
    @SuppressWarnings("unchecked")
    public ApiResponse accessPatientRecords(AccessRecordsRequest req) {
        String doctorId = req.getDoctorId();
        String doctorName = req.getDoctorName();
        String effectiveHealthId = req.getTargetHealthId() != null ? req.getTargetHealthId() : req.getPatientHealthId();
        String effectiveReason = req.getBreakGlassReason() != null ? req.getBreakGlassReason() : req.getEmergencyReason();
        boolean effectiveEmergency = Boolean.TRUE.equals(req.getEmergencyBreakGlass())
                || !isBlank(req.getEmergencyReason());

        if (isBlank(doctorId)) {
            throw ApiException.badRequest("doctorId is required to look up patient records.");
        }

        Doctor doctor = resolveDoctor(doctorId).orElse(null);
        String effectiveDoctorId = doctor != null ? doctor.getId() : doctorId;

        if (doctor != null && !"APPROVED".equals(doctor.getStatus())) {
            recordAccessLogService.add(
                    doctor != null ? doctor.getId() : doctorId,
                    doctorName != null ? doctorName : (doctor != null ? doctor.getName() : null),
                    null, effectiveHealthId, null,
                    doctor != null ? doctor.getHospitalId() : null,
                    doctor != null ? doctor.getHospitalName() : null,
                    effectiveEmergency ? "EMERGENCY" : "PATIENT_ID",
                    "DENIED",
                    "Attempted record access while hospital approval status is " + doctor.getStatus(),
                    null, false, null, null, null, null,
                    "HOSPITAL_APPROVAL_PENDING"
            );
            String hospName = doctor.getHospitalName() != null ? doctor.getHospitalName() : "your hospital";
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Hospital Approval Required: Your doctor affiliation request to " + hospName
                            + " is currently PENDING APPROVAL. You cannot search patient records or consult patients until your hospital administrator approves your request.");
        }

        if (doctor != null) {
            User doctorUser = doctor.getUserId() != null
                    ? userRepository.findById(doctor.getUserId()).orElse(null) : null;
            if (doctorUser != null && doctorUser.getMalpracticeCount() >= 3) {
                recordAccessLogService.add(
                        doctor.getId(), doctorName != null ? doctorName : doctor.getName(),
                        null, effectiveHealthId, null, doctor.getHospitalId(), doctor.getHospitalName(),
                        effectiveEmergency ? "EMERGENCY" : "PATIENT_ID", "DENIED",
                        "Blocked: Account deleted due to 3+ malpractice records.",
                        null, false, null, null, null, null, "MALPRACTICE_BLOCK");
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Access Denied: Your account has been deleted due to repeated malpractice violations (3+ confirmed complaints). Contact the Super Admin for assistance.");
            }
        }

        // Resolve card credential if provided via accessCardId or when the method is PATIENT_ACCESS_CARD.
        // Cards are resolved ONLY by card identifiers (card id / cardIdentifier / secureToken) -
        // a raw patient ID or Global Health ID is never accepted as a card credential.
        if (isBlank(effectiveHealthId) && isBlank(req.getAccessCardId())) {
            throw ApiException.badRequest("A patient health ID, card ID, or scannable identifier is required to access records.");
        }
        boolean cardRequested = !isBlank(req.getAccessCardId()) || "PATIENT_ACCESS_CARD".equals(req.getAccessMethod());
        boolean cardAuthorized = false;
        String resolvedHealthId = effectiveHealthId;
        if (cardRequested) {
            String cardToken = !isBlank(req.getAccessCardId()) ? req.getAccessCardId().trim() : effectiveHealthId.trim();
            List<AccessCard> cardHits = accessCardRepository.findAllByCardIdentifier(cardToken);
            if (!cardHits.isEmpty()) {
                AccessCard card = cardHits.get(0);
                resolvedHealthId = card.getPatientHealthId();
                cardAuthorized = "ACTIVE".equals(card.getStatus());
            }
        }
        effectiveHealthId = resolvedHealthId;

        // A card credential that does not resolve to an ACTIVE card is rejected
        // here, BEFORE the token can be reinterpreted as a raw patient ID /
        // health ID (which would turn the rejection into a misleading 404).
        if (cardRequested && !cardAuthorized) {
            recordAccessLogService.add(
                    doctor != null ? doctor.getId() : doctorId,
                    doctorName != null ? doctorName : (doctor != null ? doctor.getName() : null),
                    cardRequested ? resolvedHealthId : effectiveHealthId, effectiveHealthId, null,
                    doctor != null ? doctor.getHospitalId() : null,
                    doctor != null ? doctor.getHospitalName() : null,
                    "ACCESS_CARD", "DENIED",
                    "Attempted record access with a token that is not an active patient access card.",
                    List.of(), false, "ACCESS_CARD_SCAN", "FAILED", null, null,
                    "INVALID_OR_INACTIVE_ACCESS_CARD");
            throw ApiException.forbidden("Access permission is not given. The provided token is not an active patient access card. Scan a valid PranaCrux Patient Access Card to open this patient's record.");
        }

        // Resolve patient
        String patientUserId = resolvedHealthId;
        String patientName = "Patient Citizen";
        PatientProfile patientProf = null;

        Optional<PatientResolver.Resolved> resolvedOpt = patientResolver.resolve(resolvedHealthId);
        if (resolvedOpt.isPresent()) {
            PatientResolver.Resolved resolved = resolvedOpt.get();
            patientUserId = resolved.userId;
            patientProf = resolved.profile;
            patientName = resolved.name;
        }
        if (resolvedOpt.isEmpty()) {
            throw ApiException.notFound("Patient record not found. The provided Global Health ID, card, or name does not belong to a registered patient.");
        }

        // Check consent - try by patientUserId first, then effectiveHealthId
        boolean hasConsent = false;
        Consent activeConsent = null;
        Optional<Consent> consentOpt = consentRepository.findFirstByPatientIdAndDoctorIdOrderByGrantedAtDesc(patientUserId, effectiveDoctorId);
        if (consentOpt.isEmpty() && !patientUserId.equals(effectiveHealthId)) {
            consentOpt = consentRepository.findFirstByPatientIdAndDoctorIdOrderByGrantedAtDesc(effectiveHealthId, effectiveDoctorId);
        }
        if (consentOpt.isPresent()) {
            Consent c = consentOpt.get();
            if (!"REVOKED".equals(c.getStatus())
                    && (c.getExpiresAt() == null || !LocalDate.now().isAfter(c.getExpiresAt()))) {
                hasConsent = true;
                activeConsent = c;
            }
        }

        // Fetch patient records - check by both userId and healthId
        List<MedicalRecord> patientRecords = medicalRecordRepository.findForPatient(patientUserId);
        if (patientRecords.isEmpty() && !patientUserId.equals(effectiveHealthId)) {
            patientRecords = medicalRecordRepository.findForPatient(effectiveHealthId);
        }
        List<Map<String, Object>> recordsList = patientRecords.stream()
                .map(this::mapMedicalRecordToResponse)
                .collect(Collectors.toList());

        Map<String, Object> profileMap = resolvedOpt.isPresent()
                ? patientResolver.toPublicProfile(resolvedOpt.get())
                : Map.of("id", patientUserId, "name", patientName, "globalHealthId", effectiveHealthId);
        List<Map<String, Object>> consentsList = consentRepository.findActiveForPatient(patientUserId)
                .stream().map(this::mapConsentToPublic).collect(Collectors.toList());

        // Emergency break-glass
        if (effectiveEmergency) {
            RecordAccessLog accessLog = recordAccessLogService.add(
                    doctor != null ? doctor.getId() : doctorId,
                    doctorName != null ? doctorName : (doctor != null ? doctor.getName() : null),
                    patientUserId, effectiveHealthId, patientName,
                    doctor != null ? doctor.getHospitalId() : null,
                    doctor != null ? doctor.getHospitalName() : null,
                    "EMERGENCY", "SUCCESS",
                    "\uD83D\uDEA8 ER Emergency Break-Glass: " + (effectiveReason != null ? effectiveReason : "Immediate Unconscious Medical Emergency"),
                    List.of("EMERGENCY_PROFILE", "CRITICAL_ALLERGIES", "FULL_EHR"),
                    true, "EMERGENCY_OVERRIDE", "BYPASSED", null, null, null
            );
            Map<String, Object> logResp = mapAccessLogToResponse(accessLog);
            return ApiResponse.ok()
                    .with("granted", true)
                    .with("reason", "EMERGENCY_BREAK_GLASS")
                    .with("patient", profileMap)
                    .with("consents", consentsList)
                    .with("records", recordsList)
                    .with("accessLog", logResp)
                    .with("message", "Emergency access logged. Patient and hospital privacy board notified.");
        }

        // Consent or access card authorized
        if (hasConsent || cardAuthorized) {
            String method = cardAuthorized ? "ACCESS_CARD" : "PATIENT_ID";
            RecordAccessLog accessLog = recordAccessLogService.add(
                    doctor != null ? doctor.getId() : doctorId,
                    doctorName != null ? doctorName : (doctor != null ? doctor.getName() : null),
                    patientUserId, effectiveHealthId, patientName,
                    doctor != null ? doctor.getHospitalId() : null,
                    doctor != null ? doctor.getHospitalName() : null,
                    method, "SUCCESS",
                    cardAuthorized ? "Patient Access Card Presented & Verified - Automatic Access Granted"
                            : "Authorized Patient Consent Record Access",
                    List.of("MEDICAL_HISTORY", "LAB_REPORTS", "PRESCRIPTIONS"),
                    false,
                    cardAuthorized ? "ACCESS_CARD_SCAN" : "DIRECT_LOOKUP",
                    cardAuthorized ? "CARD_VERIFIED" : "VERIFIED",
                    null, null, null
            );
            Map<String, Object> logResp = mapAccessLogToResponse(accessLog);
            return ApiResponse.ok()
                    .with("granted", true)
                    .with("reason", cardAuthorized ? "ACCESS_CARD_AUTO_GRANTED" : "EXPLICIT_CONSENT")
                    .with("patient", profileMap)
                    .with("consents", consentsList)
                    .with("records", recordsList)
                    .with("accessLog", logResp);
        }

        // Denied - no authorization
        recordAccessLogService.add(
                doctor != null ? doctor.getId() : doctorId,
                doctorName != null ? doctorName : (doctor != null ? doctor.getName() : null),
                patientUserId, effectiveHealthId, null,
                doctor != null ? doctor.getHospitalId() : null,
                doctor != null ? doctor.getHospitalName() : null,
                cardRequested ? "PATIENT_ACCESS_CARD" : "PATIENT_ID", "DENIED",
                "Attempted unconsented lookup without active consent or break-glass authorization.",
                List.of(), false, "DIRECT_LOOKUP", "FAILED", null, null,
                cardRequested ? "INVALID_OR_INACTIVE_ACCESS_CARD" : "NO_ACTIVE_CONSENT"
        );
        throw ApiException.forbidden(cardRequested
                ? "Access permission is not given. The provided token is not an active patient access card. Scan a valid PranaCrux Patient Access Card to open this patient's record."
                : "Access permission is not given. Patient records can only be viewed with active patient consent, Emergency Break-Glass authorization.");
    }

    /** POST /access-sessions */
    @Transactional
    @SuppressWarnings("unchecked")
    public ApiResponse createAccessSession(AccessSessionsRequest req) {
        String doctorId = req.getDoctorId();
        String patientHealthId = req.getPatientHealthId();
        String accessMethod = req.getAccessMethod();

        if (isBlank(doctorId)) {
            throw ApiException.badRequest("doctorId is required to start a patient access session.");
        }
        if (isBlank(patientHealthId)) {
            throw ApiException.badRequest("patientHealthId is required to start a patient access session.");
        }

        Doctor doctor = resolveDoctor(doctorId).orElse(null);
        String effectiveDoctorId = doctor != null ? doctor.getId() : doctorId;

        if (doctor != null && !"APPROVED".equals(doctor.getStatus())) {
            recordAccessLogService.add(
                    doctor != null ? doctor.getId() : doctorId,
                    doctor != null ? doctor.getName() : "Doctor",
                    null, patientHealthId, null,
                    doctor != null ? doctor.getHospitalId() : null,
                    doctor != null ? doctor.getHospitalName() : null,
                    accessMethod != null ? accessMethod : "PATIENT_HEALTH_ID",
                    "DENIED",
                    "Attempted record access while hospital approval status is " + doctor.getStatus(),
                    null, false, null, null, null, null,
                    "HOSPITAL_APPROVAL_PENDING"
            );
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Hospital Approval Required: Your doctor affiliation request to "
                            + (doctor.getHospitalName() != null ? doctor.getHospitalName() : "your hospital")
                            + " is currently PENDING APPROVAL. You cannot access patient records until approved.");
        }

        if (doctor != null) {
            User doctorUser = doctor.getUserId() != null
                    ? userRepository.findById(doctor.getUserId()).orElse(null) : null;
            if (doctorUser != null && doctorUser.getMalpracticeCount() >= 3) {
                recordAccessLogService.add(
                        doctor.getId(), doctor.getName(),
                        null, patientHealthId, null, doctor.getHospitalId(), doctor.getHospitalName(),
                        accessMethod != null ? accessMethod : "PATIENT_HEALTH_ID", "DENIED",
                        "Blocked: Account deleted due to 3+ malpractice records.",
                        null, false, null, null, null, null, "MALPRACTICE_BLOCK");
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Access Denied: Your account has been deleted due to repeated malpractice violations (3+ confirmed complaints). Contact the Super Admin for assistance.");
            }
        }

        // Resolve card credential if provided via accessCardId or patientHealthId.
        // Cards are resolved ONLY by card identifiers (card id / cardIdentifier /
        // secureToken) - a raw patient ID or Global Health ID is never accepted
        // as a card credential.
        boolean isCardMethod = "PATIENT_ACCESS_CARD".equals(accessMethod);
        boolean cardAuthorized = false;
        AccessCard matchedCard = null;
        String effectivePatientHealthId = patientHealthId;
        String cardToken = !isBlank(req.getAccessCardId())
                ? req.getAccessCardId().trim()
                : (isCardMethod ? (patientHealthId != null ? patientHealthId.trim() : null) : null);
        if (cardToken != null && !cardToken.isEmpty()) {
            List<AccessCard> cardHits = accessCardRepository.findAllByCardIdentifier(cardToken);
            if (!cardHits.isEmpty()) {
                matchedCard = cardHits.get(0);
                effectivePatientHealthId = matchedCard.getPatientHealthId();
                cardAuthorized = "ACTIVE".equals(matchedCard.getStatus());
            }
        }

        boolean isEmergency = "EMERGENCY_BREAK_GLASS".equals(accessMethod) || "EMERGENCY".equals(accessMethod);
        if (isEmergency) emergencyAccessReason(req.getReason(), req.getJustification());

        // A card credential that does not resolve to an ACTIVE card is rejected
        // here, BEFORE the token can be reinterpreted as a raw patient ID /
        // health ID (which would turn the rejection into a misleading 404).
        if (isCardMethod && !cardAuthorized) {
            recordAccessLogService.add(
                    doctor != null ? doctor.getId() : doctorId,
                    doctor != null ? doctor.getName() : "Doctor",
                    matchedCard != null ? matchedCard.getPatientId() : null,
                    matchedCard != null ? matchedCard.getPatientHealthId() : patientHealthId,
                    matchedCard != null && matchedCard.getPatientName() != null ? matchedCard.getPatientName() : "Patient",
                    doctor != null ? doctor.getHospitalId() : null,
                    doctor != null ? doctor.getHospitalName() : null,
                    "PATIENT_ACCESS_CARD", "DENIED",
                    matchedCard == null
                            ? "Scanned token is not a recognized PranaCrux Patient Access Card."
                            : "Card is " + matchedCard.getStatus() + ".",
                    List.of(), false, "ACCESS_CARD_SCAN", "FAILED", null, null,
                    "INVALID_OR_INACTIVE_ACCESS_CARD");
            throw ApiException.forbidden("Access permission is not given. The provided token is not an active patient access card. Scan a valid PranaCrux Patient Access Card to open this patient's record.");
        }

        // Resolve patient using PatientResolver
        PatientResolver.Resolved patientResolved = patientResolver.resolve(effectivePatientHealthId).orElse(null);
        if (patientResolved == null) {
            throw ApiException.notFound("Patient record not found. The provided Global Health ID, card, or name does not belong to a registered patient.");
        }

        String patientUserId = patientResolved.userId;
        String patientGlobalId = patientResolved.globalHealthId;
        String patientName = patientResolved.name != null && !patientResolved.name.isBlank()
                ? patientResolved.name : "Patient Citizen";
        PatientProfile patientProf = patientResolved.profile;

        // Authorization gate: Emergency Break-Glass overrides consent; every other
        // method requires an ACTIVE access card or active consent. Never opens a session without permission.
        boolean hasConsent = false;
        Optional<Consent> consentOpt = consentRepository.findFirstByPatientIdAndDoctorIdOrderByGrantedAtDesc(patientUserId, effectiveDoctorId);
        if (consentOpt.isEmpty() && !patientUserId.equals(patientGlobalId)) {
            consentOpt = consentRepository.findFirstByPatientIdAndDoctorIdOrderByGrantedAtDesc(patientGlobalId, effectiveDoctorId);
        }
        if (consentOpt.isPresent()) {
            Consent c = consentOpt.get();
            if (!"REVOKED".equals(c.getStatus())
                    && (c.getExpiresAt() == null || !LocalDate.now().isAfter(c.getExpiresAt()))) {
                hasConsent = true;
            }
        }

        if (!isEmergency && !cardAuthorized && !hasConsent) {
            recordAccessLogService.add(
                    doctor != null ? doctor.getId() : doctorId,
                    doctor != null ? doctor.getName() : "Doctor",
                    patientUserId, patientGlobalId, patientName,
                    doctor != null ? doctor.getHospitalId() : null,
                    doctor != null ? doctor.getHospitalName() : null,
                    accessMethod != null ? accessMethod : "PATIENT_ID", "DENIED",
                    "Access permission is not given: no active consent or break-glass authorization.",
                    List.of(), false, "DIRECT_SESSION_TOKEN", "FAILED", null, null,
                    "NO_ACTIVE_CONSENT");
            throw ApiException.forbidden("Access permission is not given. You can only open a patient record with active patient consent, Emergency Break-Glass authorization.");
        }

        // Fetch patient records
        List<MedicalRecord> patientRecords = medicalRecordRepository.findForPatient(patientUserId);
        List<Map<String, Object>> recordsList = patientRecords.stream()
                .map(this::mapMedicalRecordToResponse)
                .collect(Collectors.toList());

        // Build session
        String sessionId = "sess_" + System.currentTimeMillis();
        String sessionDoctorId = doctor != null ? doctor.getId() : doctorId;
        String sessionDoctorName = doctor != null ? doctor.getName() : "Attending Physician";
        String sessionHospitalId = doctor != null && doctor.getHospitalId() != null ? doctor.getHospitalId() : "hosp_1";
        String sessionHospitalName = doctor != null && doctor.getHospitalName() != null ? doctor.getHospitalName() : "Apollo Multi-Specialty Hospital";
        Map<String, Object> accessSession = new LinkedHashMap<>();
        accessSession.put("id", sessionId);
        accessSession.put("doctorId", sessionDoctorId);
        accessSession.put("doctorName", sessionDoctorName);
        accessSession.put("hospitalId", sessionHospitalId);
        accessSession.put("hospitalName", sessionHospitalName);
        accessSession.put("patientId", patientUserId);
        accessSession.put("patientHealthId", patientGlobalId);
        accessSession.put("patientName", patientName);
        accessSession.put("accessMethod", accessMethod != null ? accessMethod : "PATIENT_HEALTH_ID");
        accessSession.put("reason", req.getReason() != null ? req.getReason() : "Direct Patient Consultation");
        accessSession.put("justification", req.getJustification() != null ? req.getJustification() : "");
        accessSession.put("accessCardId", req.getAccessCardId());
        accessSession.put("status", "ACTIVE");
        if (isEmergency) accessSession.put("emergencyReport", patientCareService.buildReport(patientUserId));
        accessSession.put("openedAt", LocalDateTime.now().toString());
        accessSession.put("expiresAt", LocalDateTime.now().plusHours(1).toString());

        // Create access log
        RecordAccessLog accessLog = recordAccessLogService.add(
                sessionDoctorId,
                sessionDoctorName,
                patientUserId, patientGlobalId, patientName,
                sessionHospitalId,
                sessionHospitalName,
                isEmergency ? "EMERGENCY" : (accessMethod != null ? accessMethod : "PATIENT_ID"),
                "SUCCESS",
                isEmergency
                        ? emergencyAccessReason(req.getReason(), req.getJustification())
                        : "Authorized Patient Session (" + accessMethod + ")",
                List.of("FULL_EHR", "LAB_REPORTS", "MEDICATIONS", "VITALS"),
                isEmergency,
                isEmergency ? "EMERGENCY_OVERRIDE" : "DIRECT_SESSION_TOKEN",
                "VERIFIED",
                null, null, null
        );

        // Audit log
        auditLogService.log(
                accessSession.get("doctorName").toString(),
                "DOCTOR",
                "PATIENT_ACCESS_SESSION_STARTED",
                patientGlobalId,
                "Started patient access session via " + accessMethod + " for " + patientName
        );

        // Build patient profile response
        Map<String, Object> patientProfileResp = new LinkedHashMap<>();
        patientProfileResp.put("userId", patientUserId);
        patientProfileResp.put("globalHealthId", patientGlobalId);
        patientProfileResp.put("name", patientName);
        if (patientProf != null) {
            patientProfileResp.put("bloodGroup", patientProf.getBloodGroup());
            patientProfileResp.put("heightCm", patientProf.getHeightCm());
            patientProfileResp.put("weightKg", patientProf.getWeightKg());
        }

        return ApiResponse.ok()
                .with("granted", true)
                .with("accessSession", accessSession)
                .with("patientProfile", patientProfileResp)
                .with("records", recordsList)
                .with("accessLog", mapAccessLogToResponse(accessLog));
    }

    /** POST /access-sessions/{id}/action */
    public ApiResponse sessionAction(String sessionId, SessionActionRequest req) {
        String actionName = req.getActionName() != null ? req.getActionName() : "WRITE";
        String recordType = req.getRecordType() != null ? req.getRecordType() : "CLINICAL";

        auditLogService.log("Doctor Clinician", "DOCTOR",
                "SESSION_ACTION_" + actionName, "N/A",
                "Action '" + actionName + "' performed in session " + sessionId + " for record type " + recordType);

        return ApiResponse.ok("Session action " + actionName + " logged.");
    }

    /** POST /access-sessions/{id}/end */
    public ApiResponse endAccessSession(String sessionId) {
        auditLogService.log("Doctor Clinician", "DOCTOR",
                "ACCESS_SESSION_ENDED", "N/A",
                "Access session " + sessionId + " closed.");
        return ApiResponse.ok("Access session " + sessionId + " closed.");
    }











    /** POST /toggle-active (global) */
    @Transactional
    public ApiResponse toggleActiveGlobal(ToggleActiveRequest req) {
        String doctorId = req.getDoctorId();
        Doctor doctor = resolveDoctor(doctorId).orElse(null);
        if (doctor == null) {
            throw ApiException.notFound("Doctor not found.");
        }

        if (doctor.getHospitalId() != null) {
            Hospital hosp = hospitalRepository.findById(doctor.getHospitalId()).orElse(null);
            boolean isActive = req.getIsActive() != null ? req.getIsActive() : !Boolean.TRUE.equals(doctor.getIsActive());
            if (hosp != null && "INACTIVE".equals(hosp.getStatus()) && isActive) {
                throw ApiException.badRequest("Cannot activate doctor while affiliated hospital '"
                        + hosp.getName() + "' is set to INACTIVE. Please contact your Hospital Administrator.");
            }
        }

        boolean newActive = req.getIsActive() != null ? req.getIsActive() : !Boolean.TRUE.equals(doctor.getIsActive());
        doctor.setIsActive(newActive);

        Map<String, Object> extra = new LinkedHashMap<>(doctor.getExtra());
        extra.put("availabilityStatus", newActive ? "AVAILABLE" : "INACTIVE");
        extra.put("activeStatus", newActive ? "ACTIVE" : "INACTIVE");
        doctor.setExtra(extra);
        doctorRepository.save(doctor);

        auditLogService.log(doctor.getName(), "DOCTOR", "DOCTOR_ACTIVE_TOGGLE", null,
                "Doctor active status set to " + newActive);

        String msg = "Status updated to " + (newActive ? "ACTIVE" : "INACTIVE");
        return ApiResponse.ok(msg)
                .with("doctor", toPublic(doctor));
    }













    /** GET /feedback/{doctorId} */
    public List<Map<String, Object>> getFeedback(String doctorId) {
        return feedbackStore.forDoctor(doctorId);
    }

    /** GET /{doctorId}/records, GET /records - doctor-scoped records with isolation */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getDoctorRecords(String callerDocId, String targetDocId, String search) {
        // Resolve doctor
        Doctor doctor = resolveDoctor(targetDocId).orElse(null);

        // FEARLESS isolation check
        if (!isBlank(callerDocId) && !"SUPER_ADMIN".equals(callerDocId)) {
            Doctor callerDoc = resolveDoctor(callerDocId).orElse(null);
            if (callerDoc == null || doctor == null || !callerDoc.getId().equals(doctor.getId())) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Forbidden: Doctor is strictly restricted to accessing records of their own authorized patients.");
            }
        }

        String docId = doctor != null ? doctor.getId() : targetDocId;
        String docUserId = doctor != null ? doctor.getUserId() : targetDocId;

        // Get all medical records and filter by doctorId/userId
        List<MedicalRecord> allRecords = medicalRecordRepository.findAll();
        List<MedicalRecord> records = allRecords.stream()
                .filter(r -> docId.equals(r.getDoctorId()) || docUserId.equals(r.getDoctorId()))
                .collect(Collectors.toCollection(ArrayList::new));

        // Apply search filter
        if (!isBlank(search) && !search.trim().isEmpty()) {
            String sLower = search.trim().toLowerCase();
            records = records.stream().filter(r ->
                    (r.getTitle() != null && r.getTitle().toLowerCase().contains(sLower))
                            || (r.getDiagnosis() != null && r.getDiagnosis().toLowerCase().contains(sLower))
                            || (r.getPatientHealthId() != null && r.getPatientHealthId().toLowerCase().contains(sLower))
                            || (r.getPatientId() != null && r.getPatientId().toLowerCase().contains(sLower))
            ).collect(Collectors.toCollection(ArrayList::new));
        }

        return records.stream()
                .map(this::mapMedicalRecordToResponse)
                .collect(Collectors.toList());
    }

    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================

    /**
     * Resolves a Doctor using any identifier the caller has on hand:
     * the Doctor entity id (doc_...), the linked User id (u_doc_...),
     * or the linked User's email as a final fallback. Returns empty when
     * no doctor can be linked to the given identifier.
     */
    private Optional<Doctor> resolveDoctor(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        Doctor doctor = doctorRepository.findById(id).orElse(null);
        if (doctor == null) doctor = doctorRepository.findByUserId(id).orElse(null);
        if (doctor == null) {
            User user = userRepository.findById(id).orElse(null);
            if (user != null && !isBlank(user.getEmail())) {
                doctor = doctorRepository.findFirstByEmailIgnoreCase(user.getEmail()).orElse(null);
            }
        }
        return Optional.ofNullable(doctor);
    }

    private Doctor findByIdOrUserId(String id) {
        Doctor doctor = resolveDoctor(id).orElse(null);
        if (doctor == null) {
            throw ApiException.notFound("Doctor profile not found for the given account. Please contact support if the problem persists.");
        }
        return doctor;
    }

    public Map<String, Object> toPublic(Doctor d) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", d.getId());
        out.put("userId", d.getUserId());
        out.put("name", d.getName());
        out.put("email", d.getEmail());
        out.put("specialization", d.getSpecialization());
        out.put("licenseNumber", d.getLicenseNumber());
        out.put("hospitalId", d.getHospitalId());
        out.put("hospitalName", d.getHospitalName());
        out.put("status", d.getStatus());
        out.put("fee", d.getFee());
        out.put("isActive", d.getIsActive());
        if (d.getUserId() != null) {
            User doctorUser = userRepository.findById(d.getUserId()).orElse(null);
            out.put("malpracticeCount", doctorUser != null ? doctorUser.getMalpracticeCount() : 0);
        } else {
            out.put("malpracticeCount", 0);
        }
        if (d.getExtra() != null) {
            for (Map.Entry<String, Object> e : d.getExtra().entrySet()) {
                if (CORE_PUBLIC_KEYS.contains(e.getKey()) || REMOVED_BOOKING_KEYS.contains(e.getKey())) continue;
                out.put(e.getKey(), e.getValue());
            }
        }
        if (!out.containsKey("availabilityStatus")) {
            out.put("availabilityStatus", Boolean.TRUE.equals(d.getIsActive()) ? "AVAILABLE" : "INACTIVE");
        }
        if (!out.containsKey("activeStatus")) {
            out.put("activeStatus", Boolean.TRUE.equals(d.getIsActive()) ? "ACTIVE" : "INACTIVE");
        }

        return out;
    }





    /** Map a RecordAccessLog entity to a response map using Node field names. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> mapAccessLogToResponse(RecordAccessLog l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("doctorId", l.getDoctorId());
        m.put("doctorName", l.getDoctorName());
        m.put("patientId", l.getPatientId());
        m.put("patientHealthId", l.getPatientHealthId());
        m.put("patientName", l.getPatientName());
        m.put("hospitalId", l.getHospitalId());
        m.put("hospitalName", l.getHospitalName());
        m.put("accessMethod", l.getAccessMethod());
        m.put("accessStatus", l.getAccessStatus());
        m.put("accessType", l.getAccessType());
        m.put("emergencyFlag", l.getEmergencyFlag());
        m.put("reason", l.getReason());
        m.put("denialReason", l.getDenialReason());
        m.put("recordsAccessed", l.getRecordsAccessed() != null ? l.getRecordsAccessed() : List.of());
        m.put("verificationMethod", l.getVerificationMethod());
        m.put("verificationStatus", l.getVerificationStatus());
        m.put("sessionId", l.getSessionId());
        m.put("accessCardId", null);
        m.put("timestamp", l.getTimestamp() != null ? l.getTimestamp().toString() : null);
        m.put("ipAddress", l.getIpAddress());
        return m;
    }

    /** Map a MedicalRecord entity to a response map. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> mapConsentToPublic(Consent c) {
        Doctor doctor = c.getDoctorId() != null ? doctorRepository.findById(c.getDoctorId()).orElse(null) : null;
        Hospital hospital = c.getHospitalId() != null ? hospitalRepository.findById(c.getHospitalId()).orElse(null) : null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", c.getId());
        out.put("patientId", c.getPatientId());
        out.put("doctorId", c.getDoctorId());
        out.put("doctorName", doctor != null ? doctor.getName() : "Attending Physician");
        out.put("hospitalName", hospital != null ? hospital.getName() : (doctor != null ? doctor.getHospitalName() : "Medical Center"));
        out.put("consentType", c.getConsentType());
        out.put("allowedCategories", c.getScope());
        out.put("validUntil", c.getExpiresAt() != null ? c.getExpiresAt().toString() : null);
        out.put("status", "GRANTED".equals(c.getStatus()) ? "ACTIVE" : c.getStatus());
        out.put("grantedAt", c.getGrantedAt() != null ? c.getGrantedAt().toString() : null);
        return out;
    }

    private Map<String, Object> mapMedicalRecordToResponse(MedicalRecord r) {
        Doctor doctor = r.getDoctorId() != null ? doctorRepository.findById(r.getDoctorId()).orElse(null) : null;
        Hospital hospital = r.getHospitalId() != null ? hospitalRepository.findById(r.getHospitalId()).orElse(null) : null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("patientId", r.getPatientId());
        m.put("patientHealthId", r.getPatientHealthId());
        m.put("doctorId", r.getDoctorId());
        m.put("hospitalId", r.getHospitalId());
        m.put("recordType", r.getRecordType());
        m.put("title", r.getTitle());
        m.put("diagnosis", r.getDiagnosis());
        m.put("clinicalNotes", r.getClinicalNotes());
        m.put("description", r.getDescription());
        m.put("recordDate", r.getRecordDate() != null ? r.getRecordDate().toString() : null);
        m.put("fileUrl", r.getFileUrl());
        m.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
        if (r.getExtra() != null) m.putAll(r.getExtra());
        m.put("doctorName", doctor != null ? doctor.getName() : "Self / External Facility");
        m.put("hospitalName", hospital != null ? hospital.getName() : "Independent Diagnostic Care");
        m.put("date", r.getRecordDate() != null ? r.getRecordDate().toString() : null);
        return m;
    }







    static String emergencyAccessReason(String reason, String justification) {
        if (isBlank(reason) && isBlank(justification)) throw ApiException.badRequest("An emergency access reason is required.");
        String result = "Emergency reason: " + (!isBlank(reason) ? reason.trim() : "Provided in clinical justification");
        if (!isBlank(justification)) result += "\nClinical justification: " + justification.trim();
        return result;
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static LocalDate parseIsoDate(String dateStr, String fieldName) {
        if (isBlank(dateStr)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, fieldName + " is mandatory.");
        }
        try {
            return LocalDate.parse(dateStr.trim());
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    fieldName + " has an invalid date. Use YYYY-MM-DD format.");
        }
    }
}
