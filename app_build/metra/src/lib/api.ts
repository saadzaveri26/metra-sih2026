// Base URL for the FastAPI backend.
// Set NEXT_PUBLIC_API_BASE_URL in .env.local to override (e.g. a deployed Cloud Run URL).
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ---- Types mirroring the backend response shapes exactly ----
// See app_build/metra/backend/field_structuring.py and rules_engine.py

export type OcrBlock = {
  text: string;
  confidence: number;
  bounding_box: number[][];
};

export type StructuredField = {
  value: string | null;
  confidence: number | null;
  raw_match: string | null;
  source_block_index: number | null;
  bounding_box: number[][] | null;
};

export type StructuredFields = Record<string, StructuredField>;

export type ComplianceStatus = "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW";

export type ComplianceResult = {
  status: ComplianceStatus;
  rule_reference: string;
  rule_description: string;
  act_section: string;
  findings: string;
  penalty_clause: string;
  source_block_index: number | null;
  bounding_box: number[][] | null;
};

export type ComplianceResults = Record<string, ComplianceResult>;

export type ComplianceSummary = {
  overall_status: ComplianceStatus;
  total_fields_checked: number;
  compliant_count: number;
  violations_count: number;
  review_count: number;
};

export type ScanResponse = {
  blocks: OcrBlock[];
  structured_fields: StructuredFields;
  compliance_summary: ComplianceSummary;
  compliance_results: ComplianceResults;
};

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Uploads a product-label image to the backend /scan endpoint.
 * Runs OCR, field structuring, and rule evaluation server-side.
 */
export async function scanImage(
  file: File,
  isImported = false
): Promise<ScanResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE_URL}/scan?is_imported=${isImported}`;

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body: formData });
  } catch {
    throw new ApiError(
      `Could not reach the backend at ${API_BASE_URL}. Is it running (uvicorn main:app --reload --port 8000)?`
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore parse failure, fall back to statusText
    }
    throw new ApiError(detail, res.status);
  }

  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
