package com.pranacrux.common;

import java.util.Locale;

/**
 * Canonicalizes blood-group input so it always fits the {@code varchar(8)}
 * {@code blood_group} columns and never triggers a MySQL data-truncation error
 * (SQL 1406) at registration.
 *
 * <p>The registration/account forms offer a human label such as
 * {@code "Don't Know / Not Tested"} (22 chars). Persisting that label verbatim
 * overflowed the column and surfaced as the misleading 409 "This operation
 * conflicts with existing data...". Anything that is not a real blood group is
 * stored as {@code "Unknown"}.
 */
public final class BloodGroupNormalizer {

    public static final String UNKNOWN = "Unknown";

    private BloodGroupNormalizer() {
    }

    /**
     * @return a canonical value ({@code A+}, {@code AB-}, {@code Unknown}, ...) that is
     *         always &le; 8 chars; {@code null} for {@code null}/blank input so callers
     *         can apply their own default.
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        String compact = trimmed.toUpperCase(Locale.ROOT);
        String letters = compact.replaceAll("[^A-Z]", "");

        String base = null;
        if (letters.startsWith("AB")) {
            base = "AB";
        } else if (letters.startsWith("A")) {
            base = "A";
        } else if (letters.startsWith("B")) {
            base = "B";
        } else if (letters.startsWith("O")) {
            base = "O";
        }

        boolean positive = compact.contains("+") || compact.contains("POS");
        boolean negative = compact.contains("-") || compact.contains("NEG");

        if (base != null && positive != negative) {
            return base + (positive ? "+" : "-");
        }
        return UNKNOWN;
    }
}
