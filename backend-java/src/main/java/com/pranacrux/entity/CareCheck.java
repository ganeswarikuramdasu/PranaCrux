package com.pranacrux.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.*;

@Entity
@Table(name = "patient_care_checks", indexes = @Index(name="idx_care_patient_category", columnList="patient_id,category"))
public class CareCheck {
    @Id @Column(length=64) private String id;
    @Column(name="patient_id", nullable=false, length=64) private String patientId;
    @Column(nullable=false, length=24) private String category;
    @Column(name="checked_at", nullable=false) private LocalDateTime checkedAt;
    @Column(name="source_fingerprint", nullable=false, length=64) private String sourceFingerprint;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="record_ids", columnDefinition="JSON") private List<String> recordIds = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="JSON") private Map<String,Object> result = new LinkedHashMap<>();
    public String getId(){return id;} public void setId(String v){id=v;}
    public String getPatientId(){return patientId;} public void setPatientId(String v){patientId=v;}
    public String getCategory(){return category;} public void setCategory(String v){category=v;}
    public LocalDateTime getCheckedAt(){return checkedAt;} public void setCheckedAt(LocalDateTime v){checkedAt=v;}
    public String getSourceFingerprint(){return sourceFingerprint;} public void setSourceFingerprint(String v){sourceFingerprint=v;}
    public List<String> getRecordIds(){return recordIds;} public void setRecordIds(List<String> v){recordIds=v;}
    public Map<String,Object> getResult(){return result;} public void setResult(Map<String,Object> v){result=v;}
}
