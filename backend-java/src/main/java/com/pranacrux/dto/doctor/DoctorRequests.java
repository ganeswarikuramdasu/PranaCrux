package com.pranacrux.dto.doctor;

import java.util.Map;

public class DoctorRequests {

    public static class RegisterDoctorRequest {
        private String name;
        private String email;
        private String password;
        private String specialization;
        private String licenseNumber;
        private Integer experienceYears;
        private String hospitalId;
        private Double fee;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getSpecialization() { return specialization; }
        public void setSpecialization(String specialization) { this.specialization = specialization; }
        public String getLicenseNumber() { return licenseNumber; }
        public void setLicenseNumber(String licenseNumber) { this.licenseNumber = licenseNumber; }
        public Integer getExperienceYears() { return experienceYears; }
        public void setExperienceYears(Integer experienceYears) { this.experienceYears = experienceYears; }
        public String getHospitalId() { return hospitalId; }
        public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }
        public Double getFee() { return fee; }
        public void setFee(Double fee) { this.fee = fee; }
    }

    /** Loose bag of editable profile fields - mirrors the Node route, which accepts any subset. */
    public static class UpdateDoctorProfileRequest extends java.util.HashMap<String, Object> {
    }



    public static class AccessRecordsRequest {
        private String doctorId;
        private String doctorName;
        private String targetHealthId;
        private String patientHealthId;
        private String accessMethod;
        private String accessCardId;
        private Boolean emergencyBreakGlass;
        private String breakGlassReason;
        private String emergencyReason;

        public String getDoctorId() { return doctorId; }
        public void setDoctorId(String doctorId) { this.doctorId = doctorId; }
        public String getDoctorName() { return doctorName; }
        public void setDoctorName(String doctorName) { this.doctorName = doctorName; }
        public String getTargetHealthId() { return targetHealthId; }
        public void setTargetHealthId(String targetHealthId) { this.targetHealthId = targetHealthId; }
        public String getPatientHealthId() { return patientHealthId; }
        public void setPatientHealthId(String patientHealthId) { this.patientHealthId = patientHealthId; }
        public String getAccessMethod() { return accessMethod; }
        public void setAccessMethod(String accessMethod) { this.accessMethod = accessMethod; }
        public String getAccessCardId() { return accessCardId; }
        public void setAccessCardId(String accessCardId) { this.accessCardId = accessCardId; }
        public Boolean getEmergencyBreakGlass() { return emergencyBreakGlass; }
        public void setEmergencyBreakGlass(Boolean emergencyBreakGlass) { this.emergencyBreakGlass = emergencyBreakGlass; }
        public String getBreakGlassReason() { return breakGlassReason; }
        public void setBreakGlassReason(String breakGlassReason) { this.breakGlassReason = breakGlassReason; }
        public String getEmergencyReason() { return emergencyReason; }
        public void setEmergencyReason(String emergencyReason) { this.emergencyReason = emergencyReason; }
    }

    public static class AccessSessionsRequest {
        private String doctorId;
        private String patientHealthId;
        private String accessMethod;
        private String reason;
        private String justification;
        private String accessCardId;

        public String getDoctorId() { return doctorId; }
        public void setDoctorId(String doctorId) { this.doctorId = doctorId; }
        public String getPatientHealthId() { return patientHealthId; }
        public void setPatientHealthId(String patientHealthId) { this.patientHealthId = patientHealthId; }
        public String getAccessMethod() { return accessMethod; }
        public void setAccessMethod(String accessMethod) { this.accessMethod = accessMethod; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public String getJustification() { return justification; }
        public void setJustification(String justification) { this.justification = justification; }
        public String getAccessCardId() { return accessCardId; }
        public void setAccessCardId(String accessCardId) { this.accessCardId = accessCardId; }
    }

    public static class SessionActionRequest {
        private String actionName;
        private String recordType;

        public String getActionName() { return actionName; }
        public void setActionName(String actionName) { this.actionName = actionName; }
        public String getRecordType() { return recordType; }
        public void setRecordType(String recordType) { this.recordType = recordType; }
    }







    public static class ToggleActiveRequest {
        private String doctorId;
        private Boolean isActive;
        private String activeStatus;
        private String targetScope;
        private String specificDate;
        private String actionType;
        private String reason;

        public String getDoctorId() { return doctorId; }
        public void setDoctorId(String doctorId) { this.doctorId = doctorId; }
        public Boolean getIsActive() { return isActive; }
        public void setIsActive(Boolean isActive) { this.isActive = isActive; }
        public String getActiveStatus() { return activeStatus; }
        public void setActiveStatus(String activeStatus) { this.activeStatus = activeStatus; }
        public String getTargetScope() { return targetScope; }
        public void setTargetScope(String targetScope) { this.targetScope = targetScope; }
        public String getSpecificDate() { return specificDate; }
        public void setSpecificDate(String specificDate) { this.specificDate = specificDate; }
        public String getActionType() { return actionType; }
        public void setActionType(String actionType) { this.actionType = actionType; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }


}
