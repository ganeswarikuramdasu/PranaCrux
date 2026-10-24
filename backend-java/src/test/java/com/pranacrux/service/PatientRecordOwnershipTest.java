package com.pranacrux.service;

import com.pranacrux.common.*;
import com.pranacrux.controller.*;
import com.pranacrux.dto.medicalRecord.MedicalRecordRequests.*;
import com.pranacrux.dto.patient.PatientRequests.AddManualRecordRequest;
import com.pranacrux.dto.medication.MedicationRequests.AddMedicationRequest;
import com.pranacrux.entity.MedicalRecord;
import com.pranacrux.repository.MedicalRecordRepository;
import jakarta.servlet.http.*;
import org.junit.jupiter.api.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.lang.reflect.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class PatientRecordOwnershipTest {
    private Map<String, Object> sessionAttributes;
    private HttpSession session;
    private HttpServletRequest request;
    private Map<String, MedicalRecord> stored;
    private PatientRecordAuthorization authorization;
    private PatientResolver resolver;
    private MedicalRecordService service;
    private MedicalRecordRepository repository;
    private AuditLogService audit;

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
    }

    @BeforeEach void setup() {
        sessionAttributes = new HashMap<>();
        session = proxy(HttpSession.class, (p, method, args) -> {
            switch (method.getName()) {
                case "getAttribute": return sessionAttributes.get(args[0]);
                case "setAttribute": sessionAttributes.put((String) args[0], args[1]); return null;
                case "invalidate": sessionAttributes.clear(); session = null; return null;
                default: return null;
            }
        });
        HttpSession existingSession = session;
        request = proxy(HttpServletRequest.class, (p, method, args) -> {
            if (method.getName().equals("getSession")) {
                if (session == null && (args == null || Boolean.TRUE.equals(args[0]))) session = existingSession;
                return session;
            }
            return null;
        });
        resolver = new PatientResolver(null, null) {
            @Override public Optional<Resolved> resolve(String id) {
                if (id == null || id.isBlank()) return Optional.empty();
                Resolved patient = new Resolved();
                patient.userId = id.startsWith("other") ? "other" : "owner";
                patient.globalHealthId = patient.userId + "-health";
                patient.name = "Test Patient";
                return Optional.of(patient);
            }
        };
        stored = new HashMap<>();
        repository = proxy(MedicalRecordRepository.class, (p, method, args) -> {
            switch (method.getName()) {
                case "findById": return Optional.ofNullable(stored.get(args[0]));
                case "save": MedicalRecord r = (MedicalRecord) args[0]; stored.put(r.getId(), r); return r;
                case "delete": stored.remove(((MedicalRecord) args[0]).getId()); return null;
                default: throw new UnsupportedOperationException(method.getName());
            }
        });
        authorization = new PatientRecordAuthorization(request, resolver, repository);
        audit = new AuditLogService(null, null) {
            @Override public void log(String actor, String role, String action, String patient, String details) { }
        };
        service = new MedicalRecordService(repository, resolver, audit, authorization);
    }

    private void login(String id, String role) {
        sessionAttributes.put("authenticatedUserId", id);
        sessionAttributes.put("authenticatedRole", role);
    }
    private void denied(HttpStatus status, Runnable action) {
        assertEquals(status, assertThrows(ApiException.class, action::run).getStatus());
    }
    private MedicalRecord record(String id, String owner) {
        MedicalRecord r = MedicalRecord.builder().id(id).patientId(owner).patientHealthId(owner + "-health")
                .recordType("LAB_REPORT").title("Original report").extra(new LinkedHashMap<>()).build();
        stored.put(id, r); return r;
    }
    private CreateRecordRequest create() {
        CreateRecordRequest r = new CreateRecordRequest(); r.setPatientHealthId("owner-health"); r.setTitle("My report"); return r;
    }

    @Test void anonymousWritesRequireLogin() {
        session = null;
        denied(HttpStatus.UNAUTHORIZED, () -> service.createRecord(create()));
        denied(HttpStatus.UNAUTHORIZED, () -> authorization.requireRecordOwner("r"));
    }
    @Test void doctorCannotCreatePrescriptionLabOrVitals() {
        login("doc", "DOCTOR");
        denied(HttpStatus.FORBIDDEN, () -> service.createRecord(create()));
        denied(HttpStatus.FORBIDDEN, () -> service.createLabRecord(new CreateLabRequest()));
        denied(HttpStatus.FORBIDDEN, () -> service.createVitals(new CreateVitalsRequest()));
        assertTrue(stored.isEmpty());
    }
    @Test void doctorCannotEditOrDeleteEvenIfTheyPreviouslyAuthoredRecord() {
        login("doc", "DOCTOR"); record("r", "owner").setDoctorId("doc");
        UpdateRecordRequest req = new UpdateRecordRequest(); req.setRecordId("r"); req.setTitle("Changed");
        denied(HttpStatus.FORBIDDEN, () -> service.updateRecord(req));
        denied(HttpStatus.FORBIDDEN, () -> service.deleteRecord("r"));
        assertEquals("Original report", stored.get("r").getTitle());
    }
    @Test void patientCannotCreateForAnotherPatient() {
        login("owner", "PATIENT"); CreateRecordRequest req = create(); req.setPatientHealthId("other-health");
        denied(HttpStatus.FORBIDDEN, () -> service.createRecord(req)); assertTrue(stored.isEmpty());
    }
    @Test void patientCanCreateWithoutFabricatedDoctorSignatureOrVitals() {
        login("owner", "PATIENT"); CreateRecordRequest req = create(); req.setDoctorId("spoofed-doctor");
        ApiResponse response = service.createRecord(req);
        assertEquals(true, response.get("success"));
        MedicalRecord r = stored.values().iterator().next();
        assertEquals("owner", r.getPatientId()); assertNull(r.getDoctorId());
        assertEquals("Self", r.getExtra().get("uploadedBy"));
        assertFalse(r.getExtra().containsKey("doctorSignature")); assertFalse(r.getExtra().containsKey("vitals"));
    }
    @Test void patientCanCreateLabAndAttachment() {
        login("owner", "PATIENT"); CreateLabRequest req = new CreateLabRequest();
        req.setPatientHealthId("owner-health"); req.setTestName("Blood test"); req.setAttachmentDataUrl("data:application/pdf;base64,dGVzdA==");
        service.createLabRecord(req); MedicalRecord r = stored.values().iterator().next();
        assertEquals("LAB_REPORT", r.getRecordType()); assertEquals(req.getAttachmentDataUrl(), r.getExtra().get("attachmentDataUrl"));
    }
    @Test void patientCanRecordVitalsButInvalidValuesAreRejected() {
        login("owner", "PATIENT"); CreateVitalsRequest req = new CreateVitalsRequest(); req.setPatientHealthId("owner-health");
        req.setVitals(Map.of("heartRate", "72")); service.createVitals(req); assertEquals(1, stored.size());
        req.setVitals(Map.of("heartRate", "999")); denied(HttpStatus.BAD_REQUEST, () -> service.createVitals(req));
        assertEquals(1, stored.size());
    }
    @Test void patientCanEditAndDeleteOwnRecord() {
        login("owner", "PATIENT"); record("r", "owner");
        UpdateRecordRequest req = new UpdateRecordRequest(); req.setRecordId("r"); req.setTitle("Updated report");
        service.updateRecord(req); assertEquals("Updated report", stored.get("r").getTitle());
        service.deleteRecord("r"); assertTrue(stored.isEmpty());
    }
    @Test void patientCannotEditOrDeleteSomeoneElsesRecord() {
        login("owner", "PATIENT"); record("r", "other");
        UpdateRecordRequest req = new UpdateRecordRequest(); req.setRecordId("r"); req.setTitle("Changed");
        denied(HttpStatus.FORBIDDEN, () -> service.updateRecord(req)); denied(HttpStatus.FORBIDDEN, () -> service.deleteRecord("r"));
        assertEquals("Original report", stored.get("r").getTitle());
    }
    @Test void manualUploadUsesSameOwnershipCheck() {
        PatientService manual = new PatientService(resolver, repository, null, null, null, audit, null, null, null, null, null, authorization);
        AddManualRecordRequest req = new AddManualRecordRequest(); req.setPatientId("owner"); req.setTitle("Uploaded report");
        login("doc", "DOCTOR"); denied(HttpStatus.FORBIDDEN, () -> manual.addManualRecord(req));
        login("other", "PATIENT"); denied(HttpStatus.FORBIDDEN, () -> manual.addManualRecord(req));
        login("owner", "PATIENT"); manual.addManualRecord(req);
        assertEquals("Self", stored.values().iterator().next().getExtra().get("uploadedBy"));
    }
    @Test void doctorCannotUseMedicationWriteApiAsLoophole() {
        login("doc", "DOCTOR");
        MedicationService medications = new MedicationService(null, null, null, resolver, audit, null, authorization);
        denied(HttpStatus.FORBIDDEN, () -> medications.addMedication(new AddMedicationRequest()));
    }
    @Test void authenticatedLoginRotatesSessionAndLogoutClearsIt() throws Exception {
        login("old", "DOCTOR");
        AuthController controller = new AuthController(null);
        Method authenticate = AuthController.class.getDeclaredMethod("authenticateSession", ApiResponse.class, HttpServletRequest.class);
        authenticate.setAccessible(true);
        ApiResponse response = ApiResponse.ok().with("user", Map.of("id", "owner", "role", "PATIENT"));
        authenticate.invoke(controller, response, request);
        assertEquals("owner", authorization.requirePatient());
        controller.logout(request); denied(HttpStatus.UNAUTHORIZED, () -> authorization.requirePatient());
    }
    @Test void emergencyDetailsCannotBeEditedByDoctor() {
        login("doc", "DOCTOR");
        EmergencyController controller = new EmergencyController(null, authorization);
        denied(HttpStatus.FORBIDDEN, () -> controller.updatePatientProfile("owner", new com.pranacrux.dto.emergency.EmergencyRequests.UpdateProfileRequest()));
    }
    @Test void accountUpdateRejectsAnotherUsersIdentity() {
        login("owner", "PATIENT");
        var req = new com.pranacrux.dto.auth.AuthRequests.UpdateProfilePasswordRequest(); req.setUserId("other");
        denied(HttpStatus.FORBIDDEN, () -> new AuthController(null).updateProfilePassword(req, request));
    }
    @Test void medicationWithoutEndDateStaysOngoingAndEndDateCanBeCleared() {
        login("owner", "PATIENT");
        java.util.concurrent.atomic.AtomicReference<com.pranacrux.entity.PatientMedication> saved = new java.util.concurrent.atomic.AtomicReference<>();
        var medRepo = proxy(com.pranacrux.repository.PatientMedicationRepository.class, (p,m,a) -> {
            if (m.getName().equals("save")) { saved.set((com.pranacrux.entity.PatientMedication)a[0]); return a[0]; }
            if (m.getName().equals("findById")) return Optional.of(saved.get());
            throw new UnsupportedOperationException(m.getName());
        });
        MedicationService medications = new MedicationService(medRepo, null, null, resolver, audit, null, authorization);
        var req = new AddMedicationRequest(); req.setPatientId("owner"); req.setMedicationName("Recorded medication"); req.setDosage("Recorded dose"); req.setFrequency("As prescribed"); req.setStartDate("2026-10-01");
        medications.addMedication(req); assertNull(saved.get().getEndDate()); assertNull(saved.get().getDoctorId());
        saved.get().setEndDate(java.time.LocalDate.of(2026,11,1));
        var update = new com.pranacrux.dto.medication.MedicationRequests.UpdateMedicationRequest(); update.setEndDate("");
        medications.updateMedication(saved.get().getId(),update);assertNull(saved.get().getEndDate());
        login("other", "PATIENT"); denied(HttpStatus.FORBIDDEN, () -> medications.updateMedication(saved.get().getId(),update));
    }
    @Test void emergencyAuditReasonIncludesReasonAndFullJustification() {
        String justification = "Patient requires immediate care. ".repeat(40);
        String saved = DoctorService.emergencyAccessReason("Unconscious patient", justification);
        assertTrue(saved.contains("Unconscious patient"));
        assertTrue(saved.contains(justification.trim()));
        assertTrue(saved.length() > 500);
    }
    @Test void emergencyAuditReasonRejectsBlankInput() {
        denied(HttpStatus.BAD_REQUEST, () -> DoctorService.emergencyAccessReason(" ", " "));
        assertTrue(DoctorService.emergencyAccessReason("Emergency", "").contains("Emergency"));
    }
    @Test void patientAuditHistoryRejectsAnotherPatientsIdentity() {
        PatientService patient = new PatientService(resolver, repository, null, null, null, audit, null, null, null, null, null, authorization);
        login("owner", "PATIENT");
        denied(HttpStatus.FORBIDDEN, () -> patient.accessHistory("other-health"));
        denied(HttpStatus.FORBIDDEN, () -> patient.grantedAccess("other-health"));
    }
    @Test void retiredDoctorRoutesAreAbsent() {
        for (Method method : DoctorController.class.getDeclaredMethods()) {
            assertFalse(method.getName().toLowerCase().matches(".*(schedule|leave|customslot|dateoverride|availabilitysummary|analytics).*"), method.getName());
        }
        assertThrows(ClassNotFoundException.class, () -> Class.forName("com.pranacrux.controller.AppointmentController"));
    }
}
