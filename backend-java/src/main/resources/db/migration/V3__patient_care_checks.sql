-- Hibernate ddl-auto:update also creates this table when Flyway is disabled.
CREATE TABLE IF NOT EXISTS patient_care_checks (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL,
    category VARCHAR(24) NOT NULL,
    checked_at DATETIME(6) NOT NULL,
    source_fingerprint VARCHAR(64) NOT NULL,
    record_ids JSON,
    result JSON,
    INDEX idx_care_patient_category (patient_id, category)
);
