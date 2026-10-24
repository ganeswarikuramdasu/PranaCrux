-- Optional MySQL 8 cleanup for a database upgraded from the booking version.
-- Run only against the intended database. Medical records and audit rows remain.
-- All incoming foreign keys are removed before the retired tables are dropped.
DELIMITER //
CREATE PROCEDURE pranacrux_remove_booking_tables()
BEGIN
    DECLARE finished INT DEFAULT 0;
    DECLARE child_table VARCHAR(64);
    DECLARE fk_name VARCHAR(64);
    DECLARE foreign_keys CURSOR FOR
        SELECT DISTINCT TABLE_NAME, CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND REFERENCED_TABLE_SCHEMA = DATABASE()
          AND REFERENCED_TABLE_NAME IN ('appointments', 'doctor_schedules', 'doctor_leaves', 'date_overrides');
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished = 1;
    OPEN foreign_keys;
    remove_foreign_keys: LOOP
        FETCH foreign_keys INTO child_table, fk_name;
        IF finished = 1 THEN LEAVE remove_foreign_keys; END IF;
        SET @booking_cleanup_sql = CONCAT('ALTER TABLE `', REPLACE(child_table, '`', '``'), '` DROP FOREIGN KEY `', REPLACE(fk_name, '`', '``'), '`');
        PREPARE booking_cleanup_stmt FROM @booking_cleanup_sql;
        EXECUTE booking_cleanup_stmt;
        DEALLOCATE PREPARE booking_cleanup_stmt;
    END LOOP;
    CLOSE foreign_keys;
    DROP TABLE IF EXISTS appointments;
    DROP TABLE IF EXISTS doctor_schedules;
    DROP TABLE IF EXISTS doctor_leaves;
    DROP TABLE IF EXISTS date_overrides;
END //
CALL pranacrux_remove_booking_tables() //
DROP PROCEDURE pranacrux_remove_booking_tables //
DELIMITER ;
