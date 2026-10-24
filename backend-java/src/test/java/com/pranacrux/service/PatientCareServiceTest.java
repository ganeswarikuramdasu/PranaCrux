package com.pranacrux.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pranacrux.common.*;
import com.pranacrux.dto.ai.AIRequests.CareAnalysisRequest;
import com.pranacrux.entity.*;
import com.pranacrux.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.http.HttpStatus;
import java.lang.reflect.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class PatientCareServiceTest {
    private List<MedicalRecord> records;
    private List<CareCheck> saved;
    private PatientCareService service;
    private TestAI ai;
    private EmergencyProfile emergency;
    private PatientMedication medication;
    private PatientRecordAuthorization authorization;
    private MedicalRecordService recordService;
    private PatientResolver resolver;
    private PatientResolver.Resolved patient;

    @SuppressWarnings("unchecked") static <T> T proxy(Class<T> type, InvocationHandler handler) {
        return (T)Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},handler);
    }
    static class TestAI extends AIService {
        List<Map<String,Object>> input; CareAnalysisRequest vitals;
        TestAI(){super(null,new ObjectMapper());}
        @Override public ApiResponse careAnalysis(CareAnalysisRequest request) {
            vitals=request; return ApiResponse.ok().with("status","REVIEW").with("source","SIMULATED").with("assessment","Saved vital values reviewed.");
        }
        @Override public Map<String,Object> reviewSelectedPatientReports(String category,List<Map<String,Object>> reports) {
            input=reports; return new LinkedHashMap<>(Map.of("status","RECORDED","source","REPORT_SUMMARY","assessment","Selected reports summarized."));
        }
    }
    @BeforeEach void setup() {
        records=new ArrayList<>();saved=new ArrayList<>();
        patient=new PatientResolver.Resolved();patient.userId="owner";patient.globalHealthId="owner-health";patient.name="Test Patient";
        patient.profile=new PatientProfile();patient.profile.setBloodGroup("B+");
        resolver=new PatientResolver(null,null) {
            @Override public Optional<Resolved> resolve(String id){return "owner".equals(id)||"owner-health".equals(id)?Optional.of(patient):Optional.empty();}
            @Override public Map<String,Object> toPublicProfile(Resolved p){return Map.of("userId",p.userId,"globalHealthId",p.globalHealthId,"name",p.name);}
        };
        MedicalRecordRepository repository=proxy(MedicalRecordRepository.class,(p,m,a)->{
            if(m.getName().equals("findForPatient")) return records;
            throw new UnsupportedOperationException(m.getName());
        });
        authorization=new PatientRecordAuthorization(null,resolver,repository) {
            @Override public PatientResolver.Resolved requireOwner(String id) {
                if(!"owner".equals(id)&&!"owner-health".equals(id)) throw ApiException.forbidden("Another patient's identity");return patient;
            }
        };
        CareCheckRepository checks=proxy(CareCheckRepository.class,(p,m,a)->{
            if(m.getName().equals("save")){saved.add((CareCheck)a[0]);return a[0];}
            if(m.getName().equals("findByPatientIdOrderByCheckedAtDesc")) return saved.stream().filter(c->c.getPatientId().equals(a[0])).sorted(Comparator.comparing(CareCheck::getCheckedAt).reversed()).toList();
            throw new UnsupportedOperationException(m.getName());
        });
        emergency=new EmergencyProfile();emergency.setBloodGroup("AB+");emergency.setAllergies(List.of("Recorded allergy"));emergency.setCriticalConditions(List.of("Recorded condition"));emergency.setEmergencyNotes("Call emergency contact");
        EmergencyProfileRepository profiles=proxy(EmergencyProfileRepository.class,(p,m,a)->Optional.ofNullable(emergency));
        EmergencyContactRepository contacts=proxy(EmergencyContactRepository.class,(p,m,a)->List.of());
        medication=PatientMedication.builder().id("med").patientId("owner").medicationName("Patient medication").dosage("Recorded dose").frequency("Recorded frequency").status("ACTIVE").build();
        PatientMedicationRepository meds=proxy(PatientMedicationRepository.class,(p,m,a)->List.of(medication));
        recordService=new MedicalRecordService(repository,resolver,null,authorization);
        ai=new TestAI();
        service=new PatientCareService(authorization,resolver,repository,recordService,checks,profiles,contacts,meds,ai,new ObjectMapper());
    }
    MedicalRecord add(String id,String type) {
        MedicalRecord record=MedicalRecord.builder().id(id).patientId("owner").patientHealthId("owner-health").recordType(type).title(id).recordDate(LocalDate.now()).extra(new LinkedHashMap<>()).build();
        if(type.equals("VITALS"))record.getExtra().put("vitals",Map.of("bp","120/80", "heartRate",72));
        records.add(record);return record;
    }
    ApiResponse run(String category,String... ids){return service.run(new PatientCareService.RunCheckRequest("owner",category,List.of(ids)));}
    void denied(HttpStatus status,Runnable action){assertEquals(status,assertThrows(ApiException.class,action::run).getStatus());}
    @SuppressWarnings("unchecked") List<Map<String,Object>> sections(Map<String,Object> report){return (List<Map<String,Object>>)report.get("analysisSections");}

    @Test void recordCategoriesAreExclusive(){
        assertEquals("VITALS",PatientCareService.categoryOf(add("v","VITALS")));
        assertEquals("LAB_REPORTS",PatientCareService.categoryOf(add("l","LAB_REPORT")));
        assertEquals("LAB_REPORTS",PatientCareService.categoryOf(add("i","IMAGING_SCAN")));
        assertEquals("MEDICAL_REPORTS",PatientCareService.categoryOf(add("m","DIAGNOSIS")));
    }
    @Test void runChecksOnlySelectedRecordsAndPersistsSnapshot(){
        MedicalRecord l=add("selected","LAB_REPORT");l.getExtra().put("attachmentDataUrl","data:application/pdf;base64,TEST");
        add("unselected","LAB_REPORT");add("medical","DIAGNOSIS");
        assertEquals(true,run("LAB_REPORTS","selected").get("success"));
        assertEquals(1,ai.input.size());assertEquals("selected",ai.input.get(0).get("id"));assertFalse(ai.input.get(0).containsKey("attachmentDataUrl"));
        assertEquals(List.of("selected"),saved.get(0).getRecordIds());assertNotNull(saved.get(0).getCheckedAt());assertEquals(64,saved.get(0).getSourceFingerprint().length());
    }
    @Test void rejectsMissingRecordsAndMismatchedCategories(){
        add("lab","LAB_REPORT");
        denied(HttpStatus.FORBIDDEN,()->run("LAB_REPORTS","foreign-record"));
        denied(HttpStatus.BAD_REQUEST,()->run("MEDICAL_REPORTS","lab"));assertTrue(saved.isEmpty());
    }
    @Test void rejectsEmptyAndUnknownCategory(){
        denied(HttpStatus.BAD_REQUEST,()->run("LAB_REPORTS"));denied(HttpStatus.BAD_REQUEST,()->run("UNKNOWN","id"));
        denied(HttpStatus.BAD_REQUEST,()->run(null,"id"));
    }
    @Test void checksHistoryAndReportEnforcePatientOwnership(){
        denied(HttpStatus.FORBIDDEN,()->service.history("other"));denied(HttpStatus.FORBIDDEN,()->service.emergencyReport("other"));
        denied(HttpStatus.FORBIDDEN,()->service.run(new PatientCareService.RunCheckRequest("other","VITALS",List.of("v"))));
    }
    @Test void vitalCheckUsesSelectedReadingAndNormalizesRecordedBloodPressure(){
        add("v","VITALS");run("VITALS","v");assertEquals("120",ai.vitals.getVitals().get("bpSystolic"));assertEquals("80",ai.vitals.getVitals().get("bpDiastolic"));
        assertEquals("RULE_BASED",saved.get(0).getResult().get("source"));assertEquals("v",saved.get(0).getResult().get("latestReadingId"));
    }
    @Test void emptyVitalsAreNotTreatedAsNormal(){
        add("v","VITALS").getExtra().clear();denied(HttpStatus.BAD_REQUEST,()->run("VITALS","v"));assertTrue(saved.isEmpty());
    }
    @Test void emergencyReportCombinesSavedProfileMedicationAndAllThreeChecks(){
        add("v","VITALS");add("l","LAB_REPORT");add("m","DIAGNOSIS");
        run("VITALS","v");run("LAB_REPORTS","l");run("MEDICAL_REPORTS","m");
        Map<String,Object> report=service.buildReport("owner");
        assertEquals("AB+",((Map<?,?>)report.get("emergencyDetails")).get("bloodGroup"));
        assertEquals("Call emergency contact",((Map<?,?>)report.get("emergencyDetails")).get("emergencyNotes"));
        assertEquals(1,((List<?>)report.get("medications")).size());
        assertEquals(3,sections(report).size());assertTrue(sections(report).stream().allMatch(s->"CHECKED".equals(s.get("state"))));
    }
    @Test void reportMarksMissingAndUnrunChecks(){
        add("lab","LAB_REPORT");List<Map<String,Object>> result=sections(service.buildReport("owner"));
        assertEquals("NO_DATA",result.get(0).get("state"));assertEquals("NOT_CHECKED",result.get(1).get("state"));assertFalse(result.get(1).containsKey("check"));
    }
    @Test void changedRecordMakesSavedCheckOutdated(){
        MedicalRecord record=add("l","LAB_REPORT");run("LAB_REPORTS","l");record.setClinicalNotes("Updated report");
        assertEquals("OUTDATED",sections(service.buildReport("owner")).get(1).get("state"));
    }
    @Test void deletedRecordMakesSavedCheckOutdatedAndNewRecordsAreUnreviewed(){
        add("l","LAB_REPORT");run("LAB_REPORTS","l");add("new","LAB_REPORT");
        assertEquals(1L,sections(service.buildReport("owner")).get(1).get("unreviewedCount"));
        records.removeIf(r->r.getId().equals("l"));assertEquals("OUTDATED",sections(service.buildReport("owner")).get(1).get("state"));
    }
    @Test void fingerprintIncludesAttachmentChangesButDoesNotDependOnSelectionOrder(){
        MedicalRecord a=add("a","LAB_REPORT"),b=add("b","LAB_REPORT");String first=service.fingerprint(List.of(a,b));
        assertEquals(first,service.fingerprint(List.of(b,a)));a.getExtra().put("attachmentDataUrl","new-document");assertNotEquals(first,service.fingerprint(List.of(a,b)));
    }
    @Test void unavailableAiProducesHonestReportSummaryRatherThanNormalDiagnosis(){
        AIService real=new AIService(null,new ObjectMapper());
        Map<String,Object> result=real.reviewSelectedPatientReports("LAB_REPORTS",List.of(Map.of("title","Report")));
        assertEquals("REPORT_SUMMARY",result.get("source"));assertEquals("RECORDED",result.get("status"));
        assertTrue(result.get("assessment").toString().contains("does not establish"));
    }
}
