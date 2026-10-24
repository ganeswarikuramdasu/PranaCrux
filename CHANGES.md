# PranaCrux changes

## Patient care workspace

- Proactive AI Care Analysis is a separate section. Patients choose vitals, lab reports or medical reports, select saved records, and run a check on that selection.
- Checks persist their category, source record IDs, time, result and source fingerprint in MySQL. The backend enforces ownership and category matching.
- Account & Profile contains the emergency-details editor for blood group, allergies, existing conditions, other medication notes, physician, emergency instructions and emergency contacts.
- Emergency Report combines those details, active medications and the latest saved check in each category. Missing checks, unreviewed records, and changed/deleted source records are marked explicitly.
- The same combined report is included in authorized doctor emergency sessions. Doctors retain read-only access.
- Patients can add, edit, track doses and update the taking status of their medications. Missing end dates stay unspecified. Doctor medication writes are blocked.
- General medical reports have a patient entry form with findings/summary, notes and an optional PDF/image attachment.

## Interface and access logs

- Redesigned landing page, shared top navigation, patient dashboard and patient care sections with sage, lavender, warm ivory and a responsive mobile menu.
- Removed patient Consent Vault.
- Removed the Denied Attempts & Emergency Audit tab from the patient audit screen. Emergency reasons and clinical justifications remain in the main log.
- Raise Complaint is available as a floating shortcut in the lower-left corner. Complaints can also be linked to an individual access event and doctor.

## Backend and retired features

- All API functionality uses Java / Spring Boot. The supplied archive had no Python backend source.
- Removed appointments, booking, queues, tokens, doctor schedules, consultation slots, working-day settings, leave management and appointment-based access grants.
- Record creation, uploads, vitals, updates and deletion require the authenticated patient session and ownership of the record. New patient records have patient attribution without fabricated doctor signatures or baseline readings.
- Attachments and report summaries are retained. Existing medical records and audit history are preserved. An optional script removes unused booking tables; it does not run automatically.

## Validation

- All backend Java sources compiled with Java 17 compatibility using the Eclipse compiler against the supplied backend dependencies.
- All 32 JUnit tests passed, including ownership, denied doctor writes, selected-category checks, saved-source comparisons, combined reports, ongoing medications and account-update restrictions.
- TypeScript checks and the Vite production build passed.
- Browser workflow tests passed for all three check categories, emergency-detail/contact saves, medication creation, general medical-report creation, combined reports, audit-linked complaints, the removed patient audit tab and responsive mobile navigation without horizontal overflow.
- Desktop/mobile screenshots were visually inspected. Browser API responses were mocked; the live MySQL database, configured Gemini service and production deployment were not exercised.

See README-java-setup.md for setup, sessions, the new care-check table and AI configuration. Sign in again after starting the updated backend.


## Professional interface refinement

Replaced the section sidebar with grouped top navigation for Records, Care & Insights, Access & Privacy and Account. Updated the dashboard with compact metrics, a records table and focused actions. Applied consistent borders, spacing, controls and typography throughout the workspace. Desktop complaints remain available as a floating lower-left shortcut; mobile places the complaint action in the header so it cannot cover forms or buttons. Mobile navigation wraps to show every section group. Existing patient and doctor workflows are preserved.


## Patient access-card section removal

Removed the Patient Access Card page, its navigation entry, the patient card view and the unused digital-card modal. Previously saved access-card tabs fall back to the patient dashboard.


### Doctor, hospital and super admin interface

All three portals now use grouped top navigation, light workspace headers, muted teal actions, consistent compact cards and forms, and responsive layouts. Doctor patient-care actions, hospital operations, and platform governance remain connected to their existing workflows. Hospital department counts and doctor settings synchronize when profiles finish loading.
