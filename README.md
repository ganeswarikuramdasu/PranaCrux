<div align="center">

# 🏥 PranaCrux

### Global Health Identity & Emergency Access
_A Blockchain-Inspired Digital Health Identity & Smart Healthcare Platform_

**G = Global. Prana = "life-breath" (Sanskrit). One portable, lifelong Health Identity that travels with every person — and a fallback that lets a doctor save a life before asking for permission.**

A full-stack healthcare platform that gives every citizen a unique **Global Health ID** tied to a smart **Access Card** — putting the patient in charge of their own medical data, while doctors, hospitals and emergency responders can see exactly what they need, when they need it, with consent and with a full audit trace.

</div>

---

## 🌍 Why PranaCrux Matters

Health data today is **broken in exactly the wrong way**: it exists, but nobody can use it when it counts.

### The problem
- **Records are siloed.** Every hospital, clinic and lab keeps its own folder. Your history in one hospital is invisible — or a fax away — in the next. You are your own worst bridge between providers.
- **Patients don't own their data.** Institutions hold copies; the individual rarely has a complete, portable record of their own life.
- **Sensitive data leaks without consent.** Records move around by phone call, WhatsApp and USB stick. There is no patient-controlled permission, and no trace of who saw what.
- **Emergency care is a race against paper.** A person admitted unconscious has allergies, medications, blood group and chronic conditions locked inside records a doctor cannot reach. Minutes are lost to guesswork.
- **A system that fails you away from home.** Records that only live at "your" hospital are useless in an ambulance, in a new city, or far from the network you're registered with.

### Why this platform is important
PranaCrux attacks the *root cause*: **the identity of the patient**. Instead of scattering data at the place of treatment, PranaCrux binds the data to a portable **Global Health ID** that the patient controls, and couples it to a **consent-first authorization model** — designed around the two moments that actually matter:

1. **Everyday care** — a doctor you choose sees your records **because you consented**, and only what you consented to.
2. **Emergencies** — when the patient can't consent, a **break-glass** path lets a doctor act first and log the reason, and the justification is **audited** so the trust isn't free.

Everything — every scan, every access, every emergency override — is written to an **immutable-style audit ledger**. The result is a system engineered for **privacy by default and accountability by design**, which is exactly what real national digital-health initiatives (and any serious health-tech product) demand.

---

## 💡 The Design Philosophy

| Principle | What PranaCrux does |
|-----------|-------------------|
| **Identity first** | Every person gets one portable Global Health ID (`NH-IND-2026-…` style) that outlives any single hospital stay. |
| **Patient sovereignty** | The patient owns the record and controls consent. Access **without** consent is denied with a clear, honest message — not a silent 500. |
| **Emergency override, audited** | When consent is impossible, **Break-Glass Access** grants a *time-boxed, reason-required, fully logged* path so a life is never blocked by bureaucracy. |
| **Trust through audit** | Every access log, consent grant and override is recorded in an audit trail visible to patients and admins. |
| **AI as a helper, not a hurdle** | The clinical assistant reads the record and *helps* doctors explain, sanity-check and summarize — it never replaces the human decision. |
| **Works for everyone** | Physical card, digital card, QR, PIN, phone camera bridge — access that doesn't assume a smartphone or internet in the moment of care. |

---

## ✨ Core Capabilities

### 🪪 Global Health Identity
- Every patient registers once and receives a **unique Global Health ID** that persists across hospitals, cities and years.
- A single **Full Clinical Record** the patient carries and controls — symptoms, lab results, medications, diet and emergency profiles in one place.

### 💳 Smart Access Card
- A physical + digital **Access Card** with a unique card token and an offline-verifiable PIN.
- Scan a card (QR or 4-digit PIN) to instantly load a **consent-gated** record at any desk.
- Works everywhere — a doctor, a receptionist or a roadside clinic can verify identity with zero dependency on the patient's phone or internet.

### 🔐 Consent-First Access Control
- No consent → **no records**, and the request is rejected with a clear, friendly "access permission is not given" message (never a crash, never a 500).
- Patients can see and manage exactly which doctors/hospitals may view their data.
- Card-only identifiers are strictly enforced: a raw health ID or patient ID can never be used as a card credential.

### 🚨 Emergency Access & Break Glass
- Dedicated emergency flow: identify a patient by **health ID, card, or even name**, review a pre-defined **Emergency Profile**, and open a **time-boxed break-glass** session when consent is impossible.
- Every emergency session records **who** acted, **why** (justification), **when**, and **what was viewed** — logged straight to the audit ledger.

### 📜 Immutable-Style Audit Trail
- Every record access, card scan and consent change is logged (best-effort logging that can **never** break the main flow).
- **Hierarchical audit viewer** for hospital admins and the super admin — full visibility over the whole network's access history.

### 🤖 AI Clinical Assistant
- **Contraindication & prescription safety checks** — catch risky medication interactions before they happen.
- **Lab report & scan explanation** — the AI reads a PDF/report and returns a plain-language explanation, then the clinician reviews and saves.
- **AI Summary** of a patient's record and **AI-generated diet plans** tailored to blood group and health profile.
- Synthetic patient-data viewer so demos and testing never risk real health data.

### 🧑‍⚕️ Role-Based Portals
| Role | What they can do |
|------|------------------|
| **Patient** | Own & manage your Full Clinical Record, consent controls, diet plans, AI assistant, medication tracker |
| **Doctor** | Scan/access patients with consent, view patient-managed medical records (read-only), review clinical information |
| **Hospital Admin** | Manage doctors, view all patient records, audit access logs |
| **Super Admin** | Platform-wide control, security audit, system overview |

### 📱 Mobile Camera Bridge
- Pair a phone to scan cards / use the mobile-camera flow when no physical scanner is attached.

### 🔑 Secure Sign-In
- Role-aware login with **OTP email verification** (Brevo) — an extra auth layer before a clinician enters the network.

---

## 🎯 Impact Summary

- **Patients** stop being a pile of paperwork and become an owner of one coherent health story across every provider.
- **Doctors** get context in seconds — allergies, meds, history — instead of guessing.
- **Emergency teams** get a life-saving path that doesn't wait for consent that can't be given.
- **Admins & regulators** get a complete, queryable audit of who accessed what — turning "trust me" into *"here's the ledger."*

This is not just a CRUD app: it is a working demonstration of the **privacy + portability + emergency-access** triad that every national digital-health program is trying to build.

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 · Vite · TypeScript · Tailwind CSS 4 |
| **Backend** | Java 17 · Spring Boot 3.3 · Spring Data JPA · Hibernate |
| **Database** | MySQL 8 (Aiven) |
| **AI** | Google Gemini API (optional) |
| **Deploy** | **Vercel** (frontend) · **Render** (backend) · **Aiven MySQL** (database) |

---

## 📁 Project Structure

```
pranacrux/
├── frontend/               # React + Vite + Tailwind UI
│   └── components/         # All feature views & modals
├── backend-java/           # Spring Boot backend (single backend)
│   └── src/main/java/com/pranacrux/
│       ├── config/         # Cors, DataSeeder, security constants
│       ├── controller/     # REST endpoints
│       ├── service/        # Business logic
│       ├── repository/     # Spring Data JPA repositories
│       ├── entity/         # JPA entities
│       ├── dto/            # Request/response objects
│       └── common/         # ApiResponse, exceptions, validation
├── Dockerfile              # Backend container image
├── render.yaml             # Render Blueprint (backend deploy config)
├── deploy/aws-frontend.sh  # (Optional) Publish frontend dist/ to S3 + CloudFront
├── vercel.json             # Vercel config (frontend + /api proxy to Render)
└── .env.example            # Sample environment variables
```

---

## 🚀 Run Locally

### Prerequisites
- **Node.js** 18+ (frontend)
- **JDK 17+** and **Maven** (backend)
- **MySQL 8** running locally

### 1. Database
Create a database (the backend creates tables automatically on first boot):

```sql
CREATE DATABASE IF NOT EXISTS pranacrux;
```

### 2. Backend (Spring Boot)

Copy `.env.example` to `.env` in the project root and set your local MySQL
credentials before starting the backend. The `.env` file is Git-ignored; do not
commit it or put real credentials in tracked configuration.

```bash
cd backend-java
mvn spring-boot:run
```

Starts on **http://localhost:8080** · Health check: `http://localhost:8080/api/health`

### 3. Frontend (React + Vite)

```bash
npm install
npm run dev
```

Opens on **http://localhost:5173**. Vite proxies `/api/*` to the backend on `:8080`.

> Run `npm run build` for a production build (`npx vite preview` to serve `dist/`).

### 🔑 Environment Variables
Copy `.env.example` to `.env` and fill in local database credentials and any
optional service keys. Super-admin credentials must be supplied through
`SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`; sign-in is unavailable until
both are configured. Never commit `.env`.

Local quick-demo buttons are disabled unless demo credentials are configured
through `VITE_DEMO_*` environment variables. Those values are exposed to the
local browser, so use only disposable demo accounts and never configure them
for a production build. The optional backend demo seeder only resets passwords
for matching, already-provisioned accounts when `DEMO_SEED_ENABLED=true`; it
does not create accounts.

---

## 📡 API Overview (base: `/api`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health & status |
| `POST` | `/auth/login` | Login (patient/doctor/hospital/super) |
| `GET` | `/patient/profile`, `/patient/records` | Patient data |
| `GET` | `/doctors` | Doctor directory |
| `POST` | `/doctor/access-records` | Consent-gated record lookup (dashboard) |
| `POST` | `/doctor/access-sessions` | Start an access session (consent / card / break-glass) |
| `POST` | `/emergency/identify` | Identify a patient in emergency mode |
| `POST` | `/card/mobile-bridge/create` | Pair a phone for card scanning |
| `GET` | `/admin/all-records` | All patient records (admin) |
| `POST` | `/access-sessions/{id}/end` | End an active access session |
| `GET` | `/audit` | Security / audit trail |

All responses are wrapped in the standard `ApiResponse` envelope. Business-rule failures (no consent, unknown patient, invalid card, bad input) return a clear `{ success: false, message }` with a proper HTTP status — never a generic 500.

---

## ☁️ Deployment — Vercel + Render + Aiven MySQL

The stack ships across **Vercel** (frontend), **Render** (backend), and **Aiven MySQL** (database) — all on free/cheap tiers:

| Piece | Service | Free tier |
|-------|---------|-----------|
| **Frontend** (React/Vite) | **Vercel** | ✅ (hobby) |
| **Backend** (Spring Boot) | **Render** web service (`render.yaml`) | ✅ (free, sleeps when idle) |
| **Database** (MySQL) | **Aiven MySQL** (Hobbyist) | ✅ (free, managed) |

HTTPS is automatic everywhere (Vercel + Render), so there's **no mixed-content problem** — the Vercel `/api` proxy can call Render directly over `https://`.

### 🗄️ 0. Database → Aiven MySQL (free)

1. Create a free account at **aiven.io** → **Create service** → **MySQL**.
   - Plan: **Hobbyist** (free). Cloud/region: any near you.
2. When it's ready, open **Service Settings** → **Advanced Configuration**:
   - Ensure **Public access** is **enabled** (so Render can reach it).
   - Copy the **Host**, **Port**, and the **service URI** (or user `avnadmin` + password).
3. Create the database (Hibernate auto-creates tables on first boot):
   ```bash
   mysql -h <AIVEN_HOST>.aivencloud.com -P <port> -u avnadmin -p
   CREATE DATABASE IF NOT EXISTS pranacrux;
   ```

> ⚠️ Render can't reach `localhost` — the DB must be the **Aiven public host**, and Aiven must allow connections from Render (public access on). if your Aiven plan requires an **allowlist** for IPs, Render free egress IPs are dynamic — enable public access without a strict allowlist, or add Render's IPs.

### ⚙️ 1. Backend → Render

1. Push this repo to GitHub (the `Dockerfile` + `render.yaml` are included).
2. In **Render** → **New** → **Blueprint** → connect your GitHub repo, or:
   **New → Web Service** → connect repo → **Dockerfile**, region `Singapore`.
3. Add the Render dashboard env vars (values from your Aiven MySQL + secrets):
   ```text
   SERVER_PORT          8080
   MYSQL_HOST           <AIVEN_HOST>.aivencloud.com
   MYSQL_PORT           <AIVEN_PORT>
   MYSQL_USER           avnadmin
   MYSQL_PASSWORD       <your-aiven-password>
   SUPER_ADMIN_EMAIL    <your-admin-email>
   SUPER_ADMIN_PASSWORD <your-super-admin-password>
   CORS_ORIGINS         https://pranacrux-eight.vercel.app,http://localhost:5173,http://localhost:3000
   APP_URL              https://<your-service>.onrender.com
   MYSQL_SSL_MODE       REQUIRED               # Aiven requires TLS
   MYSQL_DATABASE       defaultdb              # or your created DB name
   GEMINI_API_KEY       <optional>
   BREVO_API_KEY        <your-brevo-key>       # OTP emails over HTTPS (free: 300/day)
   EMAIL_FROM           "PranaCrux Identity <your-verified-sender@example.com>"   # must be a sender VERIFIED in Brevo
   ```
4. Render gives you a public URL: `https://<your-service>.onrender.com`.
   - Health check: `https://<your-service>.onrender.com/api/health`.
   - Set Render's health check path to `/api/health`.

> Free Render services **spin down after 15 min idle**, so the first request after idle is slow (cold start) — fine for a demo/project.

### 🖥️ 2. Frontend → Vercel (proxy to Render)

The app calls relative `/api/...` which **Vercel rewrites** to your Render backend via `vercel.json`, so **no build-time env is needed** and there's no mixed-content issue (both are `https`).

1. Push this repo to GitHub and import it in **Vercel** (framework: **Vite**).
2. Build command `vite build`, output directory `dist`.
3. In `vercel.json`, replace `https://your-backend.onrender.com` with your **actual Render URL**:
   ```json
   "destination": "https://<your-service>.onrender.com/api/$1"
   ```
4. Redeploy and open your `https://pranacrux-eight.vercel.app`.

> **Alternative — build-time env:** instead of the proxy, bake the Render URL into the build with `VITE_API_BASE_URL=https://<your-service>.onrender.com npm run build`. See `frontend/utils/apiBase.ts`.

### 🔁 One-click Blueprint

A `render.yaml` is included so you can deploy the backend with **Render → New → Blueprint → select repo**. Set the `sync: false` values (`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_PASSWORD`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `GEMINI_API_KEY`, `BREVO_API_KEY`) in the Render dashboard after provisioning. Rotate credentials that were previously committed or shared before using them again.

---

## 🗄️ Where to Check Your Database

**Locally** — connect any MySQL client to `localhost:3306`, database `pranacrux`:
- CLI: `mysql -u root -p pranacrux`
- GUI: **MySQL Workbench**, **DataGrip**, or **DBeaver** (`localhost:3306`, user `root`)

Key tables the app creates:
| Table | Contents |
|-------|----------|
| `users` | All accounts (patients, doctors, hospital admins, super admin) |
| `patient_profiles` | Health IDs, personal & clinical profile data |
| `medical_records` | Patient records incl. symptoms & lab results (JSON) |
| `access_cards` | Smart access cards + tokens + PIN hashes |
| `consents` | Consent grants |
| `audit_logs` | Access / activity audit trail |
| `record_access_logs` | Per-record access history |

**In production on Aiven MySQL** — open the Aiven console → your MySQL service → **Overview** for host/port/user, and use the **Query Editor / CLI** (`mysql -h <host> -P <port> -u avnadmin -p`) to inspect the same tables. The connection details must match the `MYSQL_*` env vars you set on Render.

---

## 🛠️ Troubleshooting

- **CORS errors on deployment** → ensure your Vercel/CloudFront domain is in `CORS_ORIGINS` and redeploy/restart the backend.
- **Backend can't reach the DB** → verify `MYSQL_*` on Render, the Aiven host/port are correct, and **Public access** is enabled on the Aiven service. Render's free service runs outside your VPC, so it must connect via Aiven's public endpoint.
- **`mysql` client access denied** → make sure the Aiven `avnadmin` username/password on Render matches the one in the Aiven console; Hibernate creates/updates the schema automatically via `ddl-auto: update`.
- **Render gets a 502 on `api/health`** → check the Render logs; if it's a cold start, wait a few seconds and retry (free tier spins down after idle).
- **Vercel `/api` returns 404/125** → confirm `vercel.json` `destination` points at your real `https://<your-service>.onrender.com` URL, not the placeholder.

---

<div align="center">

**G = Global · Prana = Life.**
One identity, consent-first access, and an audited emergency path — so the right person gets the right care, at the right moment, without giving away their privacy.

Built with ❤️ as a final-year project — secure, consent-first healthcare data for the digital era.

</div>