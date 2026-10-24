package com.pranacrux.repository;
import com.pranacrux.entity.CareCheck;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface CareCheckRepository extends JpaRepository<CareCheck,String> {
    List<CareCheck> findByPatientIdOrderByCheckedAtDesc(String patientId);
}
