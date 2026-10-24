package com.pranacrux.controller;

import com.pranacrux.common.ApiResponse;
import com.pranacrux.dto.doctor.DoctorRequests.*;
import com.pranacrux.service.DoctorService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/doctors", "/api/doctor"})
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    // ========================================================================
    // Global endpoints (no {id} path variable)
    // ========================================================================

    @GetMapping
    public List<Map<String, Object>> list() {
        return doctorService.list();
    }

    @PostMapping("/register")
    public ApiResponse register(@RequestBody RegisterDoctorRequest req) {
        return doctorService.register(req);
    }

    /** GET /access-history and /access-logs - both aliases. */
    @GetMapping({"/access-history", "/access-logs"})
    public List<Map<String, Object>> getAccessHistory(
            @RequestParam(required = false) String doctorId,
            @RequestParam(required = false) String accessType,
            @RequestParam(required = false) String accessMethod,
            @RequestParam(required = false) String patientId,
            @RequestParam(required = false) String search) {
        return doctorService.getAccessHistory(doctorId, accessType, accessMethod, patientId, search);
    }

    /** POST /access-records and /access-patient-records - both aliases. */
    @PostMapping({"/access-records", "/access-patient-records"})
    public ApiResponse accessPatientRecords(@RequestBody AccessRecordsRequest req) {
        return doctorService.accessPatientRecords(req);
    }

    @PostMapping("/access-sessions")
    public ApiResponse createAccessSession(@RequestBody AccessSessionsRequest req) {
        return doctorService.createAccessSession(req);
    }

    /** Global toggle-active (body has doctorId). */
    @PostMapping("/toggle-active")
    public ApiResponse toggleActiveGlobal(@RequestBody ToggleActiveRequest req) {
        return doctorService.toggleActiveGlobal(req);
    }

    /** GET /records - global doctor records listing. */
    @GetMapping("/records")
    public List<Map<String, Object>> getRecordsGlobal(
            @RequestParam(required = false) String doctorId,
            @RequestHeader(value = "x-doctor-id", required = false) String headerDocId,
            @RequestHeader(value = "x-caller-doctor-id", required = false) String callerHeaderDocId,
            @RequestParam(required = false) String search) {
        String callerDocId = callerHeaderDocId != null ? callerHeaderDocId : headerDocId;
        String targetDocId = doctorId != null ? doctorId : (headerDocId != null ? headerDocId : "doc_1");
        return doctorService.getDoctorRecords(callerDocId, targetDocId, search);
    }

    /** GET /feedback/{doctorId} */
    @GetMapping("/feedback/{doctorId}")
    public List<Map<String, Object>> getFeedback(@PathVariable String doctorId) {
        return doctorService.getFeedback(doctorId);
    }

    // ========================================================================
    // Doctor-scoped endpoints (/{id}/...)
    // ========================================================================

    @GetMapping("/{id}/profile")
    public ApiResponse getProfile(@PathVariable String id) {
        return doctorService.getProfile(id);
    }

    @PutMapping("/{id}/profile")
    public ApiResponse updateProfile(@PathVariable String id, @RequestBody UpdateDoctorProfileRequest req) {
        return doctorService.updateProfile(id, req);
    }





    /** GET /{doctorId}/records - doctor-scoped records listing. */
    @GetMapping("/{doctorId}/records")
    public List<Map<String, Object>> getDoctorRecords(
            @PathVariable String doctorId,
            @RequestHeader(value = "x-caller-doctor-id", required = false) String callerDocId,
            @RequestHeader(value = "x-doctor-id", required = false) String headerDocId,
            @RequestParam(required = false) String search) {
        String effectiveCaller = callerDocId != null ? callerDocId : headerDocId;
        return doctorService.getDoctorRecords(effectiveCaller, doctorId, search);
    }





















    @PostMapping("/access-sessions/{id}/action")
    public ApiResponse sessionAction(@PathVariable String id, @RequestBody SessionActionRequest req) {
        return doctorService.sessionAction(id, req);
    }

    @PostMapping("/access-sessions/{id}/end")
    public ApiResponse endAccessSession(@PathVariable String id) {
        return doctorService.endAccessSession(id);
    }
}
