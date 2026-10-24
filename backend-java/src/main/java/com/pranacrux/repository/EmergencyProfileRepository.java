package com.pranacrux.repository;

import com.pranacrux.entity.EmergencyProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EmergencyProfileRepository extends JpaRepository<EmergencyProfile, String> {
    Optional<EmergencyProfile> findFirstByPatientId(String patientId);
    Optional<EmergencyProfile> findFirstByPatientHealthId(String patientHealthId);
}
