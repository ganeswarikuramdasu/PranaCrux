# Backend implementation

PranaCrux uses the Spring Boot application in this directory for every API route. There is no Python backend and no legacy backend runtime to start.

Appointments and doctor scheduling have been retired. Their controllers, services, repositories, entities, request DTOs and record-access grants are removed. Existing database tables are ignored; see the optional cleanup script in `deploy/sql` if those tables should be dropped.

Medical record creation, manual uploads, vitals, updates, deletion and medication changes require a server-authenticated patient session and ownership of the target patient. Doctor access is read-only. Login and patient registration establish the session; logout invalidates it.

Run `mvn clean test package` with JDK 17+ and Maven. See the root `README-java-setup.md` for frontend and database setup.

The patient care workflow uses `PatientCareController` and `PatientCareService`. It persists per-category selected-record checks in `patient_care_checks`, compares source fingerprints when building reports, and combines current emergency-profile details and medications with the latest saved results. The same report is returned within authorized doctor emergency sessions. `V3__patient_care_checks.sql` supports manual schema management; Hibernate also creates the table with the default configuration.
