package com.pranacrux.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pranacrux.common.*;
import com.pranacrux.dto.ai.AIRequests.CareAnalysisRequest;
import com.pranacrux.entity.*;
import com.pranacrux.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class PatientCareService {
    public static final List<String> CATEGORIES = List.of("VITALS", "LAB_REPORTS", "MEDICAL_REPORTS");
    private final PatientRecordAuthorization authorization;
    private final PatientResolver resolver;
    private final MedicalRecordRepository records;
    private final MedicalRecordService recordService;
    private final CareCheckRepository checks;
    private final EmergencyProfileRepository emergencyProfiles;
    private final EmergencyContactRepository contacts;
    private final PatientMedicationRepository medications;
    private final AIService ai;
    private final ObjectMapper json;

    public PatientCareService(PatientRecordAuthorization authorization, PatientResolver resolver,
            MedicalRecordRepository records, MedicalRecordService recordService, CareCheckRepository checks,
            EmergencyProfileRepository emergencyProfiles, EmergencyContactRepository contacts,
            PatientMedicationRepository medications, AIService ai, ObjectMapper json) {
        this.authorization=authorization; this.resolver=resolver; this.records=records; this.recordService=recordService;
        this.checks=checks; this.emergencyProfiles=emergencyProfiles; this.contacts=contacts;
        this.medications=medications; this.ai=ai; this.json=json;
    }
    public record RunCheckRequest(String patientId, String category, List<String> recordIds) {}

    public static String categoryOf(MedicalRecord record) {
        String type=record.getRecordType()==null ? "" : record.getRecordType().toUpperCase(Locale.ROOT);
        if ("VITALS".equals(type)) return "VITALS";
        if (Set.of("LAB_REPORT", "IMAGING_SCAN").contains(type)) return "LAB_REPORTS";
        return "MEDICAL_REPORTS";
    }
    public ApiResponse history(String patientId) {
        var patient=authorization.requireOwner(patientId);
        return ApiResponse.ok().with("checks", checks.findByPatientIdOrderByCheckedAtDesc(patient.userId).stream().map(this::publicCheck).toList());
    }
    @Transactional
    public ApiResponse run(RunCheckRequest request) {
        var patient=authorization.requireOwner(request.patientId());
        if (request.category()==null || !CATEGORIES.contains(request.category())) throw ApiException.badRequest("Select vitals, lab reports or medical reports.");
        if (request.recordIds()==null || request.recordIds().isEmpty() || request.recordIds().size()>50)
            throw ApiException.badRequest("Select between 1 and 50 records for this check.");
        if (request.recordIds().stream().anyMatch(id -> id==null || id.isBlank())) throw ApiException.badRequest("Select valid source records.");
        Set<String> ids=new LinkedHashSet<>(request.recordIds());
        List<MedicalRecord> selected=records.findForPatient(patient.userId).stream().filter(r -> ids.contains(r.getId())).toList();
        if (selected.size()!=ids.size()) throw ApiException.forbidden("One or more selected records do not belong to you or are no longer available.");
        if (selected.stream().anyMatch(r -> !request.category().equals(categoryOf(r)))) throw ApiException.badRequest("All selected records must belong to the selected category.");
        List<Map<String,Object>> input=selected.stream().map(this::analysisRecord).toList();
        Map<String,Object> result;
        if ("VITALS".equals(request.category())) {
            MedicalRecord latest=selected.stream().max(Comparator.comparing(r -> r.getRecordDate()==null ? java.time.LocalDate.MIN : r.getRecordDate())).orElseThrow();
            Map<String,Object> vitals=new LinkedHashMap<>();
            Object saved=latest.getExtra()!=null ? latest.getExtra().get("vitals") : null;
            if (saved instanceof Map<?,?> values) values.forEach((k,v)->vitals.put(String.valueOf(k),v));
            if (vitals.isEmpty()) throw ApiException.badRequest("The selected reading has no recorded vital values.");
            Object bp=vitals.get("bp");
            if (bp!=null && String.valueOf(bp).contains("/")) {
                String[] parts=String.valueOf(bp).split("/");
                vitals.putIfAbsent("bpSystolic",parts[0].replaceAll("[^0-9.]", ""));
                vitals.putIfAbsent("bpDiastolic",parts[1].replaceAll("[^0-9.]", ""));
            }
            CareAnalysisRequest analysis=new CareAnalysisRequest();
            analysis.setPatientHealthId(patient.globalHealthId); analysis.setPatientProfile(resolver.toPublicProfile(patient));
            analysis.setVitals(vitals); analysis.setMedicalRecords(input); analysis.setNearbyProviders(List.of());
            result=new LinkedHashMap<>(ai.careAnalysis(analysis));
            if ("SIMULATED".equals(result.get("source"))) result.put("source", "RULE_BASED");
            result.put("scope", "Latest selected vital reading; other selected readings are supplied as history.");
            result.put("latestReadingId",latest.getId());
        } else {
            result=ai.reviewSelectedPatientReports(request.category(),input);
        }
        result.put("notice", "Automated information support, not a diagnosis. Review significant symptoms and findings with a qualified clinician.");
        CareCheck check=new CareCheck(); check.setId("check_"+UUID.randomUUID()); check.setPatientId(patient.userId);
        check.setCategory(request.category()); check.setCheckedAt(LocalDateTime.now()); check.setRecordIds(new ArrayList<>(ids));
        check.setSourceFingerprint(fingerprint(selected)); check.setResult(result); checks.save(check);
        return ApiResponse.ok().with("check",publicCheck(check));
    }
    public ApiResponse emergencyReport(String patientId) {
        var patient=authorization.requireOwner(patientId);
        return ApiResponse.ok().with("report", buildReport(patient.userId));
    }
    /** Internal use only after the caller's existing patient or doctor access gate succeeds. */
    public Map<String,Object> buildReport(String patientId) {
        var patient=resolver.resolve(patientId).orElseThrow(()->ApiException.notFound("Patient not found."));
        Map<String,Object> report=new LinkedHashMap<>();
        report.put("generatedAt",LocalDateTime.now().toString()); report.put("patient",resolver.toPublicProfile(patient));
        EmergencyProfile ep=emergencyProfiles.findFirstByPatientId(patient.userId).orElse(null);
        Map<String,Object> details=new LinkedHashMap<>();
        details.put("bloodGroup",ep!=null ? ep.getBloodGroup() : patient.profile.getBloodGroup());
        details.put("allergies",ep!=null ? ep.getAllergies() : List.of());
        details.put("criticalConditions",ep!=null ? ep.getCriticalConditions() : List.of());
        details.put("additionalMedications",ep!=null ? ep.getCurrentMedications() : List.of());
        details.put("emergencyNotes",ep!=null ? ep.getEmergencyNotes() : "");
        details.put("primaryPhysician",ep!=null ? ep.getPrimaryPhysician() : "");
        details.put("updatedAt",ep!=null && ep.getUpdatedAt()!=null ? ep.getUpdatedAt().toString() : null);
        report.put("emergencyDetails",details);
        report.put("contacts",contacts.findByPatientIdOrderByPriorityAsc(patient.userId).stream().map(c->{
            Map<String,Object> m=new LinkedHashMap<>();m.put("name",c.getName());m.put("phone",c.getPhone());m.put("relationship",c.getRelationship());return m;
        }).toList());
        report.put("medications",medications.findForPatient(patient.userId).stream().filter(m->"ACTIVE".equals(m.getStatus())).map(m->{
            Map<String,Object> item=new LinkedHashMap<>();item.put("name",m.getMedicationName()); item.put("dosage",m.getDosage());
            item.put("frequency",m.getFrequency());item.put("instructions",m.getInstructions());return item;
        }).toList());
        List<MedicalRecord> current=records.findForPatient(patient.userId);
        List<CareCheck> saved=checks.findByPatientIdOrderByCheckedAtDesc(patient.userId);
        List<Map<String,Object>> sections=new ArrayList<>();
        for (String category:CATEGORIES) {
            Map<String,Object> section=new LinkedHashMap<>();section.put("category",category);
            List<MedicalRecord> available=current.stream().filter(r->category.equals(categoryOf(r))).toList();
            section.put("recordCount",available.size());
            CareCheck latest=saved.stream().filter(c->category.equals(c.getCategory())).findFirst().orElse(null);
            if (latest==null) {section.put("state",available.isEmpty()?"NO_DATA":"NOT_CHECKED");}
            else {
                section.put("check",publicCheck(latest));
                List<MedicalRecord> reviewed=available.stream().filter(r->latest.getRecordIds().contains(r.getId())).toList();
                boolean changed=reviewed.size()!=latest.getRecordIds().size() || !latest.getSourceFingerprint().equals(fingerprint(reviewed));
                section.put("state",changed?"OUTDATED":"CHECKED");
                section.put("unreviewedCount",available.stream().filter(r->!latest.getRecordIds().contains(r.getId())).count());
            }
            sections.add(section);
        }
        report.put("analysisSections",sections);
        report.put("notice","Patient-entered details and saved automated checks. Missing or outdated checks are explicitly marked; this report is not a clinical diagnosis.");
        return report;
    }
    Map<String,Object> analysisRecord(MedicalRecord record) {
        Map<String,Object> data=new LinkedHashMap<>(recordService.mapRecord(record));
        data.remove("attachmentDataUrl"); data.remove("attachmentUrl"); return data;
    }
    String fingerprint(List<MedicalRecord> selected) {
        try {
            List<Map<String,Object>> data=selected.stream().sorted(Comparator.comparing(MedicalRecord::getId)).map(recordService::mapRecord).toList();
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            try (var stream=new java.security.DigestOutputStream(java.io.OutputStream.nullOutputStream(),digest)) {
                json.writeValue(stream,data);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (Exception e) {throw new IllegalStateException("Unable to compare saved care-check source records",e);}
    }
    private Map<String,Object> publicCheck(CareCheck check) {
        Map<String,Object> result=new LinkedHashMap<>();result.put("id",check.getId());result.put("category",check.getCategory());
        result.put("checkedAt",check.getCheckedAt().toString());result.put("recordIds",check.getRecordIds());result.put("result",check.getResult());return result;
    }
}
