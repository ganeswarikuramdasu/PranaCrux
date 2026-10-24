package com.pranacrux.config;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Self-healing schema repair that runs once at boot, BEFORE any request is served.
 *
 * <p>Flyway is disabled for this deployment (see application.yml) because Render's
 * {@code flyway_schema_history} carries a stale FAILED V1 row that newer Flyway 10
 * cannot repair declaratively ({@code ignore-migration-patterns: "*:failed"} is
 * rejected with "Invalid migration state 'failed'". Valid states are:
 * [*, missing, pending, ignored, future] — {@code failed} is not one of them), and
 * {@code ddl-auto: update} can never DROP a column.
 *
 * <p>That left the dead, multilingual-era {@code preferred_language} column in the
 * {@code users} table: NOT NULL with no default. The entity no longer maps it, so
 * every patient-registration INSERT omitted it and MySQL 8 rejected the row with
 * {@code SQL 1364: Field 'preferred_language' doesn't have a default value} — the
 * exact 500 behind "Registration failed." seen on Render.
 *
 * <p>This runner makes the boot idempotent and self-healing: it checks
 * {@code information_schema} / JDBC metadata for the column across ALL tables and
 * drops it only if present. Safe on the live Render DB (which still has the
 * column) and on any fresh/empty DB (no-op). Never throws, never marks the
 * transaction rollback-only, so it can never take the app down.
 */
@Component
@Order(1)
public class SchemaRepairRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaRepairRunner.class);

    private static final String DEAD_COLUMN = "preferred_language";

    private final DataSource dataSource;

    @Autowired
    public SchemaRepairRunner(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(String... args) {
        widenAccessReasonColumn();
        dropColumnIfPresent(DEAD_COLUMN);
        dropStaleUniqueIndex("users", "email");
    }

    /**
     * Idempotently drops {@code preferred_language} from every table that still
     * has it (guarded by JDBC metadata, so it never fails when the column is
     * already gone — required for the column never to return).
     */
    private void dropColumnIfPresent(String column) {
        String schema = schemaName();
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            String q = "SELECT CONCAT(table_schema, '.', table_name) AS tbl " +
                    "FROM information_schema.columns " +
                    "WHERE table_schema = '" + schema + "' AND column_name = '" + column + "'";
            try (ResultSet rs = stmt.executeQuery(q)) {
                while (rs.next()) {
                    String qualified = rs.getString("tbl");
                    String sql = "ALTER TABLE `" + qualified.replace(".", "`.`") + "` DROP COLUMN `" + column + "`";
                    log.warn("SchemaRepairRunner: dropping dead NOT NULL column `{}` from {} (was 500ing patient registration)", column, qualified);
                    stmt.executeUpdate(sql);
                }
            }
            log.info("SchemaRepairRunner: {} column check complete (no-op if already dropped)", column);
        } catch (Exception e) {
            log.warn("SchemaRepairRunner: could not inspect/drop `{}` — starting anyway (safe): {}", column, e.getMessage());
        }
    }

    /**
     * Idempotently drops a leftover single-column UNIQUE index on {@code table(column)}.
     *
     * <p>A dead multilingual-era {@code @Column(unique = true)} on {@code users.email}
     * left a global unique index behind. The current code scopes email uniqueness to
     * {@code (email, role)} (see {@code existsByEmailIgnoreCaseAndRole} and role-scoped
     * login), and fresh schemas carry no such index. On the live DB the stale index made
     * every cross-role registration fail at INSERT with a
     * {@code DataIntegrityViolationException} → the misleading 409 "This operation
     * conflicts with existing data...". Dropping it realigns the DB with the entity/app.
     */
    private void dropStaleUniqueIndex(String table, String column) {
        String schema = schemaName();
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            String q = "SELECT DISTINCT index_name FROM information_schema.statistics " +
                    "WHERE table_schema = '" + schema + "' AND table_name = '" + table + "' " +
                    "AND column_name = '" + column + "' AND non_unique = 0 AND index_name <> 'PRIMARY'";
            List<String> stale = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(q)) {
                while (rs.next()) {
                    stale.add(rs.getString("index_name"));
                }
            }
            for (String index : stale) {
                log.warn("SchemaRepairRunner: dropping stale UNIQUE index `{}` on {}({}) (blocked registration with a 409)", index, table, column);
                stmt.executeUpdate("ALTER TABLE `" + table + "` DROP INDEX `" + index + "`");
            }
            log.info("SchemaRepairRunner: {}({}) unique-index check complete (no-op if already dropped)", table, column);
        } catch (Exception e) {
            log.warn("SchemaRepairRunner: could not inspect/drop unique index on {}({}) — starting anyway (safe): {}", table, column, e.getMessage());
        }
    }

    /** Preserve complete clinical reasons in databases created by older releases. */
    private void widenAccessReasonColumn() {
        try (Connection conn = dataSource.getConnection()) {
            boolean needsUpgrade = false;
            try (var query = conn.prepareStatement(
                    "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?")) {
                query.setString(1, "record_access_logs");
                query.setString(2, "reason");
                try (ResultSet result = query.executeQuery()) {
                    if (result.next()) needsUpgrade = "varchar".equalsIgnoreCase(result.getString(1));
                }
            }
            if (needsUpgrade) {
                try (Statement statement = conn.createStatement()) {
                    statement.executeUpdate("ALTER TABLE record_access_logs MODIFY COLUMN reason TEXT");
                }
            }
        } catch (Exception e) {
            log.warn("Could not upgrade access-log reason column: {}", e.getMessage());
        }
    }

    private String schemaName() {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            String schema = conn.getCatalog();
            return (schema != null && !schema.isBlank()) ? schema
                    : (meta.getURL() != null && meta.getURL().toLowerCase().contains("mysql") ? "pranacrux" : "public");
        } catch (Exception e) {
            return "pranacrux";
        }
    }
}
