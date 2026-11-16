export type Role = "farmer" | "admin";
export type HealthStatus = "healthy" | "diseased" | "uncertain";
export type ResultStatus = "identified" | "low_confidence" | "unsupported" | "not_plant";

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface User {
  id: number;
  full_name: string;
  email: string;
  mobile: string | null;
  role: Role;
  preferred_language: "en" | "hi";
  is_active: boolean;
  created_at: string;
  scan_count?: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Disease {
  id: number;
  class_label: string | null;
  disease_name: string;
  disease_name_hi: string | null;
  crop_name: string;
  crop_name_hi: string | null;
  disease_type: string;
  is_healthy: boolean;
  pathogen: string | null;
  description: string | null;
  description_hi: string | null;
  symptoms: string[];
  symptoms_hi: string[];
  causes: string[];
  causes_hi: string[];
  environmental_conditions: string | null;
  environmental_conditions_hi: string | null;
  prevention: string[];
  prevention_hi: string[];
  treatment: string[];
  treatment_hi: string[];
  reference_image_url: string | null;
}

export type DiseaseInput = Omit<Disease, "id">;

export interface TopPrediction {
  label: string;
  crop: string;
  disease: string;
  confidence: number;
}

export interface Scan {
  id: number;
  user_id: number;
  disease_id: number | null;
  image_url: string;
  crop_name: string | null;
  disease_name: string | null;
  disease_name_hi: string | null;
  predicted_label: string | null;
  confidence: number;
  health_status: HealthStatus;
  result_status: ResultStatus;
  top_predictions: TopPrediction[];
  model_version: string;
  created_at: string;
}

export interface ScanDetail extends Scan {
  disease: Disease | null;
  message: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardStats {
  total_scans: number;
  healthy: number;
  diseased: number;
  uncertain: number;
  top_diseases: { disease: string; disease_hi: string | null; count: number }[];
  by_crop: { crop: string; count: number }[];
  daily: { date: string; count: number }[];
}

export interface ModelInfo {
  ready: boolean;
  version: string | null;
  architecture?: string | null;
  num_classes?: number;
  metrics?: Record<string, unknown> | null;
  error?: string | null;
}

export interface AdminDashboard {
  total_farmers: number;
  total_admins: number;
  total_scans: number;
  total_diseases: number;
  health_status: Record<HealthStatus, number>;
  result_status: Record<string, number>;
  most_detected_diseases: { disease: string; disease_hi: string | null; crop: string; count: number }[];
  by_crop: { crop: string; count: number }[];
  daily: { date: string; count: number }[];
  model: ModelInfo;
}
