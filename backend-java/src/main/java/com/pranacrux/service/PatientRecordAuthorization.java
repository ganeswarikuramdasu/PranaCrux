package com.pranacrux.service;

import com.pranacrux.common.ApiException;
import com.pranacrux.entity.MedicalRecord;
import com.pranacrux.repository.MedicalRecordRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Service;

/** Uses the server-authenticated session, never a caller-supplied role or doctor ID. */
@Service
public class PatientRecordAuthorization {
    private final HttpServletRequest request;
    private final PatientResolver patientResolver;
    private final MedicalRecordRepository records;

    public PatientRecordAuthorization(HttpServletRequest request, PatientResolver patientResolver,
                                      MedicalRecordRepository records) {
        this.request = request;
        this.patientResolver = patientResolver;
        this.records = records;
    }

    public String requirePatient() {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("authenticatedUserId") == null) {
            throw ApiException.unauthorized("Please sign in again to manage your medical records.");
        }
        if (!"PATIENT".equals(session.getAttribute("authenticatedRole"))) {
            throw ApiException.forbidden("Only patients can add or change their own medical records. Doctor access is read-only.");
        }
        return (String) session.getAttribute("authenticatedUserId");
    }

    public PatientResolver.Resolved requireOwner(String identifier) {
        String userId = requirePatient();
        var patient = patientResolver.resolve(identifier).orElseThrow(() -> ApiException.notFound("Patient record not found."));
        if (!userId.equals(patient.userId)) {
            throw ApiException.forbidden("You can only manage your own medical records.");
        }
        return patient;
    }

    public MedicalRecord requireRecordOwner(String recordId) {
        String userId = requirePatient();
        if (recordId == null || recordId.isBlank()) throw ApiException.badRequest("recordId is required.");
        MedicalRecord record = records.findById(recordId).orElseThrow(() -> ApiException.notFound("Medical record not found."));
        if (!userId.equals(record.getPatientId())) throw ApiException.forbidden("You can only manage your own medical records.");
        return record;
    }
}
