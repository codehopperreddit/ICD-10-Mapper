export interface IcdCode {
  id: number;
  code: string;
  description: string;
  category: string | null;
  chapter: string | null;
}

export interface IcdMatch extends IcdCode {
  /** Confidence score in [0, 1] derived from FTS5 BM25 rank. */
  confidence: number;
}

export interface BulkRowResult {
  input: string;
  matches: IcdMatch[];
}

export type BulkJobStatus = "queued" | "processing" | "completed" | "failed";

export interface BulkJob {
  id: string;
  user_id: string;
  r2_input_key: string;
  r2_output_key: string | null;
  status: BulkJobStatus;
  row_count: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}
