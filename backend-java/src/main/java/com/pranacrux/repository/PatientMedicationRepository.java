package com.pranacrux.repository;

import com.pranacrux.entity.PatientMedication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PatientMedicationRepository extends JpaRepository<PatientMedication, String> {
    @Query("SELECT m FROM PatientMedication m WHERE m.patientId = :patientId OR m.patientHealthId = :patientId " +
            "ORDER BY m.createdAt DESC")
    List<PatientMedication> findForPatient(@Param("patientId") String patientId);
}
