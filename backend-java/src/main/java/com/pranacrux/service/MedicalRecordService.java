package com.pranacrux.service;

import com.pranacrux.common.ApiException;
import com.pranacrux.common.ApiResponse;
import com.pranacrux.dto.medicalRecord.MedicalRecordRequests.CreateLabRequest;
import com.pranacrux.dto.medicalRecord.MedicalRecordRequests.CreateRecordRequest;
import com.pranacrux.dto.medicalRecord.MedicalRecordRequests.CreateVitalsRequest;
import com.pranacrux.dto.medicalRecord.MedicalRecordRequests.UpdateRecordRequest;
import com.pranacrux.entity.Doctor;
import com.pranacrux.entity.MedicalRecord;
import com.pranacrux.entity.PatientMedication;
import com.pranacrux.repository.DoctorRepository;
import com.pranacrux.repository.MedicalRecordRepository;
import com.pranacrux.repository.PatientMedicationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MedicalRecordService {

    private final MedicalRecordRepository medicalRecordRepository;
    private final PatientRecordAuthorization authorization;
    private final PatientResolver patientResolver;
    private final AuditLogService auditLogService;

    private static final Map<String, double[]> VITAL_RANGES = Map.ofEntries(
            Map.entry("bpSystolic", new double[]{50, 260}),
            Map.entry("bpDiastolic", new double[]{30, 170}),
            Map.entry("glucose", new double[]{20, 800}),
            Map.entry("heartRate", new double[]{30, 220}),
            Map.entry("spo2", new double[]{50, 100}),
            Map.entry("weight", new double[]{2, 300}),
            Map.entry("height", new double[]{60, 250}),
            Map.entry("temp", new double[]{88, 112}),
            Map.entry("respRate", new double[]{6, 60}));

    private static final Map<String, String> VITAL_LABELS = Map.ofEntries(
            Map.entry("bpSystolic", "Systolic BP"),
            Map.entry("bpDiastolic", "Diastolic BP"),
            Map.entry("glucose", "Fasting Glucose"),
            Map.entry("heartRate", "Heart Rate"),
            Map.entry("spo2", "SpO2"),
            Map.entry("weight", "Weight"),
            Map.entry("height", "Height"),
            Map.entry("temp", "Temperature"),
            Map.entry("respRate", "Respiratory Rate"));

    public MedicalRecordService(MedicalRecordRepository medicalRecordRepository,
                                PatientResolver patientResolver,
                                AuditLogService auditLogService,
                                PatientRecordAuthorization authorization) {
        this.authorization = authorization;
        this.medicalRecordRepository = medicalRecordRepository;
        this.patientResolver = patientResolver;
        this.auditLogService = auditLogService;
    }









    private String ts() {
        return String.valueOf(System.currentTimeMillis());
    }

    private LocalDate today() {
        return LocalDate.now();
    }

    private LocalDate parseIsoDate(String dateStr, String fieldName) {
        if (dateStr == null || dateStr.isBlank()) return today();
        try {
            return LocalDate.parse(dateStr.trim());
        } catch (Exception e) {
            throw ApiException.badRequest(fieldName + " has an invalid date. Use YYYY-MM-DD format.");
        }
    }

    private String todayStr() {
        return today().toString();
    }












    @Transactional
    public ApiResponse createRecord(CreateRecordRequest req) {
        var patient = authorization.requireOwner(req.getPatientHealthId());
        MedicalRecord record = newPatientRecord(patient, "PRESCRIPTION", req.getTitle(), today());
        record.setDiagnosis(req.getDiagnosis());
        record.setClinicalNotes(req.getDoctorNotes());
        Map<String, Object> extra = new LinkedHashMap<>(record.getExtra());
        extra.put("symptoms", req.getSymptoms() != null ? req.getSymptoms() : List.of());
        extra.put("medicines", req.getMedicines() != null ? req.getMedicines() : List.of());
        if (req.getVitals() != null && !req.getVitals().isEmpty()) {
            validateVitals(req.getVitals());
            extra.put("vitals", req.getVitals());
        }
        record.setExtra(extra);
        return savePatientRecord(record, patient.name);
    }

    @Transactional
    public ApiResponse createLabRecord(CreateLabRequest req) {
        var patient = authorization.requireOwner(req.getPatientHealthId());
        String type = req.getRecordType() != null ? req.getRecordType() : "LAB_REPORT";
        MedicalRecord record = newPatientRecord(patient, type,
                req.getTitle() != null ? req.getTitle() : req.getTestName(), parseIsoDate(req.getTestDate(), "Test date"));
        record.setDiagnosis(req.getDiagnosis());
        record.setClinicalNotes(req.getDoctorNotes());
        record.setFileUrl(req.getAttachmentUrl());
        Map<String, Object> extra = new LinkedHashMap<>(record.getExtra());
        extra.put("category", type);
        extra.put("hospitalName", req.getLaboratoryName());
        extra.put("testName", req.getTestName());
        extra.put("testCategory", req.getTestCategory());
        extra.put("labResults", req.getLabResults() != null ? req.getLabResults() : List.of());
        extra.put("referenceRange", req.getReferenceRange());
        extra.put("attachmentUrl", req.getAttachmentUrl());
        extra.put("attachmentDataUrl", req.getAttachmentDataUrl());
        extra.put("fileName", req.getFileName());
        extra.put("fileSize", req.getFileSize());
        extra.put("imagingCategory", req.getImagingCategory());
        extra.put("doctorNotes", req.getDoctorNotes());
        extra.put("aiSummary", req.getAiSummary());
        extra.put("flaggedValues", req.getFlaggedValues() != null ? req.getFlaggedValues() : List.of());
        record.setExtra(extra);
        return savePatientRecord(record, patient.name);
    }

    @Transactional
    public ApiResponse createVitals(CreateVitalsRequest req) {
        var patient = authorization.requireOwner(req.getPatientHealthId());
        Map<String, Object> vitals = req.getVitals();
        if (vitals == null || vitals.isEmpty()) throw ApiException.badRequest("Enter at least one vital sign.");
        validateVitals(vitals);
        MedicalRecord record = newPatientRecord(patient, "VITALS", "Vital Signs Measurement",
                parseIsoDate(vitals.get("date") != null ? String.valueOf(vitals.get("date")) : null, "Vitals date"));
        record.setClinicalNotes(vitals.get("notes") != null ? String.valueOf(vitals.get("notes")) : null);
        record.getExtra().put("category", "VITALS");
        record.getExtra().put("vitals", vitals);
        return savePatientRecord(record, patient.name);
    }

    private MedicalRecord newPatientRecord(PatientResolver.Resolved patient, String type, String title, LocalDate date) {
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("uploadedBy", "Self");
        extra.put("source", "PATIENT_UPLOAD");
        return MedicalRecord.builder().id("rec_" + UUID.randomUUID())
                .patientId(patient.userId).patientHealthId(patient.globalHealthId)
                .recordType(type).title(title != null && !title.isBlank() ? title : "Patient medical record")
                .recordDate(date).extra(extra).build();
    }

    private ApiResponse savePatientRecord(MedicalRecord record, String patientName) {
        medicalRecordRepository.save(record);
        auditLogService.log(patientName, "PATIENT", "MEDICAL_RECORD_ADDED", record.getPatientHealthId(),
                "Patient added " + record.getRecordType() + ": " + record.getTitle());
        return ApiResponse.ok().with("record", mapRecord(record));
    }

    private void validateVitals(Map<String, Object> vitals) {
        if (vitals == null || vitals.isEmpty()) return;

        Object bpRaw = vitals.get("bp");
        if (bpRaw != null && !String.valueOf(bpRaw).isBlank()) {
            parseAndCheckBp(String.valueOf(bpRaw));
        }

        for (Map.Entry<String, double[]> entry : VITAL_RANGES.entrySet()) {
            Object raw = vitals.get(entry.getKey());
            if (raw == null) continue;
            checkVitalNumber(entry.getKey(), raw, entry.getValue()[0], entry.getValue()[1]);
        }

        Object sysRaw = vitals.get("bpSystolic");
        Object diaRaw = vitals.get("bpDiastolic");
        if (sysRaw != null && diaRaw != null) {
            double sys = parseVitalDouble("Systolic BP", sysRaw);
            double dia = parseVitalDouble("Diastolic BP", diaRaw);
            if (sys > 0 && dia > 0 && dia >= sys) {
                throw ApiException.badRequest(
                        "Diastolic BP must be lower than Systolic BP. Please re-check the reading.");
            }
        }
    }

    private void parseAndCheckBp(String bp) {
        String[] parts = bp.split("/");
        if (parts.length < 2) {
            throw ApiException.badRequest(
                    "Blood Pressure must be in SYSTOLIC/DIASTOLIC format, e.g. 120/80.");
        }
        double sys = parseVitalDouble("Systolic BP", parts[0]);
        double dia = parseVitalDouble("Diastolic BP", parts[1]);
        checkVitalNumber("bpSystolic", sys, 50, 260);
        checkVitalNumber("bpDiastolic", dia, 30, 170);
        if (dia >= sys) {
            throw ApiException.badRequest(
                    "Diastolic BP must be lower than Systolic BP. Please re-check the reading.");
        }
    }

    private double parseVitalDouble(String label, Object raw) {
        try {
            return Double.parseDouble(String.valueOf(raw).trim());
        } catch (NumberFormatException ex) {
            throw ApiException.badRequest(label + " must be a number.");
        }
    }

    private void checkVitalNumber(String key, Object raw, double min, double max) {
        double val = parseVitalDouble(VITAL_LABELS.get(key), raw);
        if (val < min || val > max) {
            double rounded = Math.round(val * 10.0) / 10.0;
            String display = rounded == Math.rint(rounded)
                    ? String.valueOf((long) rounded)
                    : String.valueOf(rounded);
            throw ApiException.badRequest(
                    VITAL_LABELS.get(key) + " " + display
                            + " is outside the plausible human range ("
                            + (long) min + "–" + (long) max
                            + "). Please re-check the reading.");
        }
    }

    public ApiResponse getPatientRecords(String patientHealthId) {
        PatientResolver.Resolved resolved = patientResolver.resolve(patientHealthId).orElse(null);
        String targetUserId = resolved != null ? resolved.userId : patientHealthId;

        List<MedicalRecord> records = medicalRecordRepository.findForPatient(targetUserId);

        List<Map<String, Object>> shaped = records.stream().map(this::mapRecord).collect(Collectors.toList());

        return ApiResponse.ok().with("records", shaped);
    }

    public Map<String, Object> mapRecord(MedicalRecord r) {
        Map<String, Object> extra = r.getExtra() != null ? r.getExtra() : new LinkedHashMap<>();
        Map<String, Object> shape = new LinkedHashMap<>();
        shape.put("id", r.getId());
        shape.put("patientId", r.getPatientId());
        shape.put("patientHealthId", r.getPatientHealthId());
        shape.put("doctorId", r.getDoctorId());
        shape.put("date", r.getRecordDate() != null ? r.getRecordDate().toString() : null);
        shape.put("recordType", r.getRecordType());
        shape.put("title", r.getTitle());
        shape.put("diagnosis", r.getDiagnosis());
        shape.put("clinicalNotes", r.getClinicalNotes());
        shape.put("description", r.getDescription());

        shape.put("doctorName", extra.get("doctorName"));
        shape.put("hospitalName", extra.get("hospitalName"));
        shape.put("uploadedBy", extra.getOrDefault("uploadedBy", r.getDoctorId() == null ? "Self" : "Legacy record"));
        shape.put("category", extra.get("category"));
        shape.put("symptoms", extra.get("symptoms"));
        shape.put("vitals", extra.get("vitals"));
        shape.put("medicines", extra.get("medicines"));
        shape.put("labResults", extra.get("labResults"));
        shape.put("doctorNotes", extra.get("doctorNotes"));
        shape.put("doctorSignature", extra.get("doctorSignature"));
        shape.put("testName", extra.get("testName"));
        shape.put("testCategory", extra.get("testCategory"));
        shape.put("referenceRange", extra.get("referenceRange"));
        shape.put("attachmentUrl", extra.get("attachmentUrl"));
        shape.put("fileName", extra.get("fileName"));
        shape.put("fileSize", extra.get("fileSize"));
        shape.put("imagingCategory", extra.get("imagingCategory"));
        shape.put("aiSummary", extra.get("aiSummary"));
        shape.put("flaggedValues", extra.get("flaggedValues") != null ? extra.get("flaggedValues") : new ArrayList<>());
        shape.put("attachmentDataUrl", extra.get("attachmentDataUrl"));
        shape.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);

        return shape;
    }



    @Transactional
    public ApiResponse updateRecord(UpdateRecordRequest req) {
        if (req.getRecordId() == null || req.getRecordId().isBlank()) {
            throw ApiException.badRequest("recordId is required.");
        }
        MedicalRecord record = authorization.requireRecordOwner(req.getRecordId());
        if (record == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Medical record not found.");
        }

        if (req.getTitle() != null) record.setTitle(req.getTitle());
        if (req.getDiagnosis() != null) record.setDiagnosis(req.getDiagnosis());
        if (req.getRecordType() != null) record.setRecordType(req.getRecordType());
        if (req.getDate() != null && !req.getDate().isBlank()) {
            record.setRecordDate(parseIsoDate(req.getDate(), "date"));
        }
        if (req.getClinicalNotes() != null) record.setClinicalNotes(req.getClinicalNotes());

        Map<String, Object> extra = record.getExtra() != null ? record.getExtra() : new LinkedHashMap<>();
        if (req.getDoctorNotes() != null) extra.put("doctorNotes", req.getDoctorNotes());
        if (req.getHospitalName() != null) extra.put("hospitalName", req.getHospitalName());
        if (req.getTestName() != null) extra.put("testName", req.getTestName());
        if (req.getTestCategory() != null) extra.put("testCategory", req.getTestCategory());
        if (req.getReferenceRange() != null) extra.put("referenceRange", req.getReferenceRange());
        if (req.getLabResults() != null) extra.put("labResults", req.getLabResults());
        if (req.getSymptoms() != null) extra.put("symptoms", req.getSymptoms());
        if (req.getAiSummary() != null) extra.put("aiSummary", req.getAiSummary());
        if (req.getFlaggedValues() != null) extra.put("flaggedValues", req.getFlaggedValues());
        if (req.getFileName() != null) extra.put("fileName", req.getFileName());
        if (req.getFileSize() != null) extra.put("fileSize", req.getFileSize());
        if (req.getAttachmentUrl() != null) extra.put("attachmentUrl", req.getAttachmentUrl());
        if (req.getAttachmentDataUrl() != null) extra.put("attachmentDataUrl", req.getAttachmentDataUrl());
        record.setExtra(extra);

        medicalRecordRepository.save(record);

        auditLogService.log("Patient", "PATIENT", "MEDICAL_RECORD_UPDATED", record.getPatientHealthId(),
                "Updated " + record.getRecordType() + " record '" + record.getTitle() + "'.");

        return ApiResponse.ok().with("record", mapRecord(record));
    }

    @Transactional
    public ApiResponse deleteRecord(String recordId) {
        if (recordId == null || recordId.isBlank()) {
            throw ApiException.badRequest("recordId is required.");
        }
        MedicalRecord record = authorization.requireRecordOwner(recordId);
        if (record == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Medical record not found.");
        }
        String patientHealthId = record.getPatientHealthId();
        String title = record.getTitle();
        String recordType = record.getRecordType();

        medicalRecordRepository.delete(record);

        auditLogService.log("Patient", "PATIENT", "MEDICAL_RECORD_DELETED", patientHealthId,
                "Deleted " + recordType + " record '" + title + "'.");

        return ApiResponse.ok("Medical record deleted.");
    }
}
