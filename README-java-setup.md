# Run PranaCrux

The application uses a Java 17 / Spring Boot backend and a React / TypeScript frontend. All API routes are served by `backend-java/`. There is no Python backend or separate Node backend.

## Requirements

- JDK 17 or later and Maven
- Node.js 20 or later (frontend tooling)
- MySQL 8

## Database and environment

Copy `.env.example` to `.env` in the project root and set your MySQL connection and service credentials. Spring Boot reads the root `.env` when started from `backend-java`. The `.env` file is Git-ignored; never commit it or put real credentials in tracked configuration. Rotate any credentials previously committed or shared.

Set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_SSL_MODE` for your database. Hibernate creates the current application tables. No database reset is required.

For local demos, one-tap sign-in is shown only for accounts configured with
`VITE_DEMO_PATIENT_*`, `VITE_DEMO_DOCTOR_*`, or `VITE_DEMO_HOSPITAL_*` values.
These Vite values are visible to the local browser and must only contain
disposable demo credentials. Optionally set `DEMO_SEED_ENABLED=true` and the
matching `DEMO_*_EMAIL`/`DEMO_*_PASSWORD` backend values to reset passwords on
already-provisioned users of the matching role. The seeder never creates
accounts. Do not configure these values for production.

## Backend

```bash
cd backend-java
mvn clean test package
mvn spring-boot:run
```

The API starts at http://localhost:8080. The backend Dockerfile and Render configuration also build this Java application.

## Frontend

From the project root, in a second terminal:

```bash
npm ci
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to the Java backend. Keep browser requests on this frontend origin so the authenticated session cookie is forwarded automatically. Vercel uses the existing `/api` rewrite for the same purpose.

```bash
npm run lint
npm run build
```

## Patient-owned records

Sign in again after applying this update or restarting the backend. Record writes now require the authenticated server session, rather than trusting a role or patient ID in the request body. Sessions expire after one hour of inactivity. Signing out invalidates the server session.

Patients can add lab reports, documents and vitals, and update or delete their own records. Doctors can view records through existing authorized access methods. Doctor views, including card scanners and emergency records, do not provide add, edit, delete, prescription-writing or medication-writing controls.

## Patient access logs and complaints

The Consent Vault screen is removed. The Record Access Audit Log shows the doctor's emergency reason and clinical justification directly. Raise Complaint is available as a floating shortcut in the lower-left corner on desktop and a complaint icon in the header on mobile. Patients can also start a complaint from a specific access event; its doctor and log details are attached automatically.

## Removed features

Appointments, booking, tokens, live queues, doctor schedules, working-day settings, leave calendars, custom consultation slots and appointment-based access grants are removed. Retired API routes return 404. Medication dose reminders and diet plans remain available.

Existing booking tables and old audit rows are not used by the application. To remove the retired database tables as well, use `deploy/sql/remove_retired_booking_tables.sql` against your own database after taking any backup you want to keep. This optional cleanup is not run automatically. Existing medical records and audit history are retained.

The archive contains source and setup files. Install dependencies and build fresh rather than using an older backend JAR.

## Care analysis and the combined emergency report

- **Proactive AI Care Analysis** is a separate patient section. Choose Vitals, Lab reports or Medical reports, select one or more saved records, and click Run check. The server checks ownership and category before reviewing only that selection.
- **Medical reports** includes a patient entry form for general health reports, prescriptions, discharge notes and vaccination records. Include the report's findings or summary for analysis; an optional PDF/image attachment is retained with the record.
- **Account & Profile** contains the emergency details editor: blood group, allergies, existing conditions, medication notes, physician, emergency instructions and emergency contacts. This is the editable source for the emergency report.
- **Emergency Report** combines those details, active medications and the latest saved check for each of the three source categories. It identifies missing checks, records not included in a check, and checks whose source records changed or were deleted. Doctors receive the same combined information after the existing emergency-access gate succeeds.
- **Medications** allows the patient to add, edit, track doses and mark medication records as no longer taken. An unspecified end date stays unspecified. Doctor medication writes remain blocked.
- The patient audit view has a single main access-log view; the Denied Attempts & Emergency Audit tab is removed from the patient module. Emergency reasons remain visible in the main log.

Results are persisted in the new `patient_care_checks` MySQL table. Hibernate creates it with the existing `ddl-auto: update` setting. `V3__patient_care_checks.sql` is included for installations that manage schemas manually. No live database was changed during development.

Set `GEMINI_API_KEY` for AI-assisted interpretation. Without a working key, vitals use the existing screening rules and report checks return clearly labeled summaries of the provided data; the application does not pretend that an AI review ran. Empty report flags are not treated as a clinical all-clear. Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` locally to enable super-admin sign-in.

Local Vite and Vercel proxy deployments keep API requests on the frontend origin. If using a separate cross-site API URL, HTTPS cookie deployments may require `SESSION_COOKIE_SAME_SITE=none` and `SESSION_COOKIE_SECURE=true`, along with the exact frontend origin in `CORS_ORIGINS`. Browser third-party cookie restrictions can still apply; a same-origin API proxy is preferable.

The workspace uses grouped top navigation rather than a section sidebar. Records, Care & Insights, Access & Privacy and Account are available from the top bar.

The Patient Access Card section and its card display are removed from the patient workspace.


### Doctor, hospital and super admin interface

All three portals now use grouped top navigation, light workspace headers, muted teal actions, consistent compact cards and forms, and responsive layouts. Doctor patient-care actions, hospital operations, and platform governance remain connected to their existing workflows. Hospital department counts and doctor settings synchronize when profiles finish loading.
