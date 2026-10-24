export interface PasswordRequirements {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

export function checkPasswordStrength(password: string): PasswordRequirements {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  return {
    minLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial,
  };
}

export interface VitalRange {
  min: number;
  max: number;
}

// Plausible human physiological ranges. Any reading outside these limits is a
// data-entry mistake (e.g. 10000000) and must be rejected before saving.
export const VITAL_LIMITS: Record<string, VitalRange> = {
  bpSystolic: { min: 50, max: 260 },
  bpDiastolic: { min: 30, max: 170 },
  glucose: { min: 20, max: 800 },
  heartRate: { min: 30, max: 220 },
  spo2: { min: 50, max: 100 },
  weight: { min: 2, max: 300 },
  height: { min: 60, max: 250 },
  temp: { min: 88, max: 112 },
  respRate: { min: 6, max: 60 },
};

export const VITAL_LABELS: Record<string, string> = {
  bpSystolic: "Systolic BP",
  bpDiastolic: "Diastolic BP",
  glucose: "Fasting Glucose",
  heartRate: "Heart Rate",
  spo2: "SpO2",
  weight: "Weight",
  height: "Height",
  temp: "Temperature",
  respRate: "Respiratory Rate",
};

export function validateVital(key: string, value: number | string): string | null {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  const limit = VITAL_LIMITS[key];
  if (!limit) return null;
  if (!Number.isFinite(num)) return `${VITAL_LABELS[key] || key} must be a number.`;
  if (num < limit.min || num > limit.max) {
    return `${VITAL_LABELS[key] || key} ${num} is outside the plausible human range (${limit.min}–${limit.max}). Please re-check the reading.`;
  }
  return null;
}

export function validateBpString(bp: string): string | null {
  const raw = String(bp ?? "").trim();
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.length < 2) {
    return "Blood Pressure must be in SYSTOLIC/DIASTOLIC format, e.g. 120/80.";
  }
  const sys = Number(parts[0].trim());
  const dia = Number(parts[1].trim());
  if (!Number.isFinite(sys) || !Number.isFinite(dia)) {
    return "Blood Pressure must be in SYSTOLIC/DIASTOLIC format, e.g. 120/80.";
  }
  const sysErr = validateVital("bpSystolic", sys);
  if (sysErr) return sysErr;
  const diaErr = validateVital("bpDiastolic", dia);
  if (diaErr) return diaErr;
  if (dia >= sys) {
    return "Diastolic BP must be lower than Systolic BP. Please re-check the reading.";
  }
  return null;
}

// Validates every known vitals field present in the object. Returns an error
// message (reject) or null (all readings are within human-plausible limits).
export function validateVitalsMap(vitals: Record<string, any>): string | null {
  if (!vitals) return null;
  for (const key of Object.keys(VITAL_LIMITS)) {
    const raw = vitals[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const err = validateVital(key, raw);
    if (err) return err;
  }
  if (vitals.bp !== undefined && vitals.bp !== null && String(vitals.bp).trim() !== "") {
    const err = validateBpString(String(vitals.bp));
    if (err) return err;
  }
  if (vitals.bpSystolic !== undefined && vitals.bpSystolic !== null && vitals.bpSystolic !== ""
      && vitals.bpDiastolic !== undefined && vitals.bpDiastolic !== null && vitals.bpDiastolic !== "") {
    const sys = Number(vitals.bpSystolic);
    const dia = Number(vitals.bpDiastolic);
    if (Number.isFinite(sys) && Number.isFinite(dia) && dia >= sys) {
      return "Diastolic BP must be lower than Systolic BP. Please re-check the reading.";
    }
  }
  return null;
}
