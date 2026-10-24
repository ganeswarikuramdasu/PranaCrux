export type UserRole = "PATIENT" | "DOCTOR" | "HOSPITAL_ADMIN" | "SUPER_ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
}

export interface PatientLifestyle {
  smoking?: string;
  alcohol?: string;
  exerciseDaysPerWeek?: number;
  diet?: string;
  sleepHours?: number;
}

export interface PatientProfile {
  id: string;
  userId: string;
  globalHealthId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  bloodGroup: string;
  dob: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  organDonor?: boolean;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  lifestyle?: PatientLifestyle;
  qrCodeData?: string;
  heightCm?: number;
  weightKg?: number;
  allergies?: string[];
  chronicConditions?: string[];
  latitude?: number;
  longitude?: number;
  city?: string;
  locationUpdatedAt?: string;
}













export interface NotificationPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsappNotifications: boolean;
  emergencyAlerts: boolean;
}

export interface SecuritySettings {
  twoFactorAuth: boolean;
  autoLogoutMins: number;
  lastPasswordChange: string;
}

export type DoctorAvailabilityStatus = 
  | "AVAILABLE" 
  | "UNAVAILABLE" 
  | "ON_LEAVE" 
  | "EMERGENCY_UNAVAILABLE" 
  | "HOSPITAL_SUSPENDED" 
  | "ACCOUNT_INACTIVE";

export interface DoctorProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  dob?: string;
  gender?: string;
  profilePhoto?: string;
  bio?: string;
  specialization: string;
  qualification?: string;
  department?: string;
  designation?: string;
  consultationType?: "IN_PERSON";
  licenseNumber: string;
  experienceYears: number;
  age?: number;
  hospitalId: string | null;
  hospitalName: string | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUSPENDED";
  isActive?: boolean;
  fee: number;
  rating: number;
  availabilityStatus?: DoctorAvailabilityStatus;
  notificationPreferences?: NotificationPreferences;
  securitySettings?: SecuritySettings;
  malpracticeCount?: number;
  malpracticeHistory?: Array<{
    count: number;
    reason?: string;
    actorName?: string;
    details?: string;
    at: string;
    deleted?: boolean;
  }>;
}



export interface DoctorFeedback {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface HospitalProfile {
  id: string;
  userId: string;
  name: string;
  licenseNumber: string;
  address: string;
  phone: string;
  email: string;
  departments: string[];
  departmentStatuses?: Record<string, "ACTIVE" | "INACTIVE">;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUSPENDED";
  location?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface ConsentGrant {
  id: string;
  patientId: string;
  patientHealthId?: string;
  doctorId: string;
  doctorName: string;
  hospitalName: string;
  consentType: "TEMPORARY" | "EMERGENCY" | "PERMANENT";
  allowedCategories: string[];
  validUntil: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  grantedAt: string;
}



export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
}

export interface LabResult {
  testName: string;
  resultValue: string;
  normalRange: string;
  status: "NORMAL" | "ELEVATED" | "HIGH" | "OPTIMAL" | "SLIGHTLY HIGH" | "CRITICAL";
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  patientHealthId: string;
  doctorId: string;
  doctorName: string;
  hospitalName: string;
  date: string;
  recordType: "PRESCRIPTION" | "LAB_REPORT" | "IMAGING_SCAN" | "DIAGNOSIS" | "SURGERY_NOTE" | "VACCINATION" | "VITALS" | "MANUAL_RECORD";
  title: string;
  diagnosis: string;
  symptoms: string[];
  patientName?: string;
  uploadedBy?: string;
  vitals?: {
    bp?: string;
    heartRate?: string;
    spo2?: string;
    temp?: string;
  };
  medicines?: Medicine[];
  labResults?: LabResult[];
  attachmentUrl?: string;
  imagingCategory?: string;
  doctorNotes: string;
  doctorSignature: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetPatientHealthId: string;
  details: string;
  ipAddress: string;
}

export interface BreakGlassLog {
  id: string;
  timestamp: string;
  doctorName: string;
  doctorLicense: string;
  patientHealthId: string;
  reason: string;
  status: string;
}

export interface DietPlan {
  id: string;
  patientId: string;
  patientHealthId: string;
  doctorId?: string;
  doctorName?: string;
  hospitalName?: string;
  title: string;
  category: string;
  createdDate: string;
  dailyCaloriesTarget: string;
  waterIntakeLiters: number;
  meals: {
    breakfast: string;
    lunch: string;
    eveningSnack: string;
    dinner: string;
  };
  restrictedFoods: string[];
  recommendedFoods: string[];
  doctorAdvice: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  status: "OPERATIONAL" | "MAINTENANCE" | "DEFECTIVE";
  quantity: number;
  location: string;
  lastMaintenance: string;
  serialNumber: string;
}

export interface DepartmentInfo {
  name: string;
  headOfDepartment: string;
  status: "ACTIVE" | "INACTIVE";
  doctorCount: number;
  bedCapacity: number;
  availableBeds: number;
  description: string;
  emergencyContact: string;
}

export interface JavaCodeFile {
  service: string;
  fileName: string;
  filePath: string;
  code: string;
  description: string;
}

export type CardStatus =
  | "NOT_ISSUED"
  | "ACTIVE"
  | "TEMP_BLOCKED"
  | "TEMPORARILY_BLOCKED"
  | "LOST"
  | "REPLACEMENT_REQUESTED"
  | "REVOKED"
  | "EXPIRED";

export interface AccessCard {
  id: string;
  patientId: string;
  patientHealthId: string;
  patientName: string;
  cardIdentifier: string;
  status: CardStatus;
  issuedAt: string;
  activatedAt?: string;
  revokedAt?: string;
  lostAt?: string;
  replacedBy?: string;
  pinCode?: string;
  qrCodeData: string;
}

export interface CardAccessLog {
  id: string;
  cardId: string;
  patientId: string;
  patientHealthId: string;
  patientName: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  hospitalId: string;
  hospitalName: string;
  timestamp: string;
  accessType: string;
  authorizationStatus: "AUTHORIZED" | "REQUIRES_PATIENT_CONSENT" | "DENIED_CARD_LOST" | "DENIED_CARD_BLOCKED" | "DENIED_UNAUTHORIZED";
  recordsAccessed: string[];
  reason: string;
  ipAddress?: string;
}

export interface CardScanResult {
  success: boolean;
  authorizationStatus?: "AUTHORIZED" | "REQUIRES_PATIENT_CONSENT" | "DENIED_CARD_LOST" | "DENIED_CARD_BLOCKED" | "DENIED_UNAUTHORIZED";
  card?: AccessCard;
  patient?: any;
  patientBasic?: {
    name: string;
    globalHealthId: string;
    bloodGroup: string;
    gender: string;
    emergencyContactPhone: string;
  };
  records?: MedicalRecord[];
  consents?: ConsentGrant[];
  message?: string;
  code?: string;
}

export type EmergencyIdentificationMethod =
  | "GLOBAL_HEALTH_ID"
  | "ACCESS_CARD"
  | "PATIENT_NAME"
  | "FINGERPRINT"
  | "FACE";

export type EmergencySessionStatus = "ACTIVE" | "EXPIRED" | "ENDED";

export interface EmergencyAccessSession {
  id: string;
  patientId: string;
  patientHealthId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  identificationMethod: EmergencyIdentificationMethod;
  emergencyReason: string;
  customReason?: string;
  startedAt: string;
  expiresAt: string;
  endedAt?: string | null;
  status: EmergencySessionStatus;
  recordsAccessed: string[];
  actionsPerformed: string[];
  ipAddress?: string;
}

export interface EmergencyContact {
  id: string;
  patientId: string;
  name: string;
  relationship: string;
  phone: string;
  priority: number;
}

export interface EmergencyProfile {
  userId: string;
  patientHealthId: string;
  bloodGroup: string;
  allergies: string[];
  criticalConditions: string[];
  currentMedications: string[];
  emergencyNotes: string;
  primaryPhysician: string;
  updatedAt: string;
}

export interface EmergencyNotification {
  id: string;
  patientId: string;
  sessionId: string;
  doctorName: string;
  hospitalName: string;
  reason: string;
  timestamp: string;
  status: "UNREAD" | "READ";
}

export type RecordAccessMethod = 
  | "PATIENT_ID" 
  | "PATIENT_HEALTH_ID" 
  | "ACCESS_CARD" 
  | "PATIENT_ACCESS_CARD" 
  | "QR"
  | "EMERGENCY" 
  | "BIOMETRIC" 
  | "FACE_SCAN";

export type RecordAccessStatus = "SUCCESS" | "DENIED";

export interface AccessSession {
  id: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  patientId: string;
  patientHealthId: string;
  patientName: string;
  accessMethod: RecordAccessMethod;
  accessType?: "EMERGENCY" | "DIRECT";
  reason?: string;
  justification?: string;
  accessCardId?: string | null;
  emergencySessionId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  status: "ACTIVE" | "EXPIRED" | "ENDED";
  recordsAccessed: string[];
  actionsPerformed: string[];
}

export interface PatientRecordAccessLog {
  id: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientHealthId: string;
  patientName: string;
  hospitalId: string;
  hospitalName: string;
  accessMethod: RecordAccessMethod | string;
  accessType?: "EMERGENCY" | "DIRECT" | string;
  accessStatus: RecordAccessStatus;
  timestamp: string;
  reason: string;
  justification?: string;
  accessCardId?: string | null;
  recordsAccessed: string[];
  emergencyFlag: boolean;
  verificationMethod?: string;
  verificationStatus?: string;
  ipAddress?: string;
  deviceId?: string;
  sessionId?: string;
  denialReason?: string;
}

// PRANACRUX CLINICAL MEDICATION SYSTEM
export type MedicationStatus = "ACTIVE" | "COMPLETED" | "DISCONTINUED";

export interface PatientMedication {
  id: string;
  patientId: string;
  patientHealthId?: string;
  patientName?: string;
  doctorId: string;
  doctorName: string;
  hospitalId?: string;
  hospitalName?: string;
  prescriptionId?: string | null;
  medicationName: string;
  genericName?: string;
  dosage: string;
  unit?: string;
  frequency: string;
  route?: string;
  timing?: string;
  startDate: string;
  endDate: string;
  duration?: string;
  indication?: string;
  instructions?: string;
  specialInstructions?: string;
  notes?: string;
  status: MedicationStatus;
  createdAt: string;
  updatedAt: string;
  discontinuedAt?: string | null;
  discontinuedBy?: string | null;
  discontinuationReason?: string | null;
}

export type DoseStatus = "TAKEN" | "MISSED" | "SKIPPED";

export interface MedicationDoseLog {
  id: string;
  medicationId: string;
  patientId: string;
  patientHealthId?: string;
  medicationName: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // e.g. "08:00 AM" or "Morning"
  actualTime?: string | null;
  status: DoseStatus;
  createdAt: string;
}

export interface MedicationAdherenceSummary {
  todayTaken: number;
  todayTotal: number;
  todayPercentage: number;
  last7DaysPercentage: number;
}


