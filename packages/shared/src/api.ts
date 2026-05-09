import type { IcdMatch, BulkJob } from "./icd";
import type { Tier } from "./tiers";

export interface ApiError {
  error: string;
  message: string;
}

export interface SearchResponse {
  query: string;
  matches: IcdMatch[];
  cached: boolean;
}

export interface CreateBulkJobResponse {
  job: BulkJob;
  uploadInstructions?: string;
}

export interface BulkJobResponse {
  job: BulkJob;
  downloadUrl: string | null;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface CreateApiKeyResponse {
  key: ApiKey;
  /** Plain-text key — returned ONCE on creation. */
  secret: string;
}

export interface UsageStats {
  tier: Tier;
  dailyLimit: number;
  usedToday: number;
  byDay: Array<{ date: string; count: number }>;
}
