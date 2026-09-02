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

export type OfficerOverride = {
  value: string;
  original_ai_value?: string | null;
  updated_at: string;
  reason?: string;
  is_authoritative: boolean;
};

export type StructuredField = {
  value: string | null;
  confidence: number | null;
  raw_match: string | null;
  source_block_index: number | null;
  bounding_box: number[][] | null;
  officer_override?: OfficerOverride | null;
};

export type StructuredFields = Record<string, StructuredField>;

export type ComplianceStatus = "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW";

export type FontStatus = ComplianceStatus | "NOT_MEASURED";

export type OverlayKind = "matched" | "candidate" | "missing";

export type ComplianceResult = {
  status: ComplianceStatus;
  rule_reference: string;
  rule_description: string;
  act_section: string;
  findings: string;
  penalty_clause: string;
  source_block_index: number | null;
  bounding_box: number[][] | null;
  ai_value?: string | null;
  effective_value?: string | null;
  is_overridden?: boolean;
  officer_override?: OfficerOverride | null;
};

export type ComplianceResults = Record<string, ComplianceResult>;

export type ComplianceSummary = {
  overall_status: ComplianceStatus;
  total_fields_checked: number;
  compliant_count: number;
  violations_count: number;
  review_count: number;
};

export type RegionOverlay = {
  field: string;
  status: ComplianceStatus;
  kind: OverlayKind;
  bounding_box: number[][];
  rule_reference: string;
  findings: string;
};

export type FontFieldResult = {
  status: FontStatus;
  pixel_height: number | null;
  height_mm: number | null;
  min_required_mm: number;
  rule_reference: string;
  findings: string;
};

export type FontAnalysis = {
  dpi: number;
  dpi_source: "exif" | "assumed";
  image_width: number;
  image_height: number;
  pdp_area_cm2: number;
  numeral_min_height_mm: number;
  letter_min_height_mm: number;
  rule_reference: string;
  rule_description: string;
  violations_count: number;
  review_count: number;
  fields: Record<string, FontFieldResult>;
};

export type ScanResponse = {
  blocks: OcrBlock[];
  structured_fields: StructuredFields;
  compliance_summary: ComplianceSummary;
  compliance_results: ComplianceResults;
  officer_overrides?: Record<string, OfficerOverride>;
  font_analysis?: FontAnalysis;
  region_overlays?: RegionOverlay[];
  image_width?: number;
  image_height?: number;
  id?: string | null;
  created_at?: string;
  product_name?: string;
  seller_name?: string;
  is_imported?: boolean;
};

export type ScanSummary = {
  id: string;
  created_at: string;
  product_name: string;
  seller_name: string;
  is_imported: boolean;
  overall_status: ComplianceStatus;
  score: number;
  violations_count: number;
  review_count: number;
  compliant_count: number;
  manufacturer: string | null;
  has_evidence: boolean;
};

export type ScanListResponse = {
  total: number;
  limit: number;
  offset: number;
  items: ScanSummary[];
};

export type EntityHistoryResponse = {
  entity_type: "product" | "seller";
  entity_name: string;
  total_scans: number;
  compliant_count: number;
  review_count: number;
  violations_count: number;
  items: ScanSummary[];
};

export type DashboardSummary = {
  scanned_today: number;
  open_cases: number;
  high_risk_queue: number;
  recent: ScanSummary[];
};

export type StoredScan = ScanSummary & {
  payload: ScanResponse;
};

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let detail = res.statusText;
  try {
    const body = await res.json();
    detail = body.detail ?? detail;
  } catch {
    // ignore
  }
  return new ApiError(detail, res.status);
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError(
      `Could not reach the backend at ${API_BASE_URL}. Is it running (uvicorn main:app --reload --port 8000)?`
    );
  }
}

/**
 * Uploads a product-label image to the backend /scan endpoint.
 * Runs OCR, field structuring, and rule evaluation server-side.
 */
export async function scanImage(
  file: File,
  isImported = false,
  productName = "",
  sellerName = ""
): Promise<ScanResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const params = new URLSearchParams({
    is_imported: String(isImported),
  });
  if (productName.trim()) params.set("product_name", productName.trim());
  if (sellerName.trim()) params.set("seller_name", sellerName.trim());

  const url = `${API_BASE_URL}/scan?${params.toString()}`;
  const res = await apiFetch(url, { method: "POST", body: formData });

  if (!res.ok) throw await parseError(res);
  return res.json();
}

export type ReportFormat = "pdf" | "docx";

export async function generateReportBlob(
  file: File,
  scan: ScanResponse,
  format: ReportFormat
): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("payload", JSON.stringify(scan));

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/report/${format}`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new ApiError(
      `Could not reach the backend at ${API_BASE_URL} to generate the report.`
    );
  }

  if (!res.ok) throw await parseError(res);
  return res.blob();
}

export async function downloadInspectionReport(
  file: File,
  scan: ScanResponse,
  format: ReportFormat
): Promise<void> {
  const blob = await generateReportBlob(file, scan, format);
  const ext = format === "pdf" ? "pdf" : "docx";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `metra-inspection-report-${scan.id ?? "scan"}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchScanList(params: {
  q?: string;
  product?: string;
  seller?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}): Promise<ScanListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const res = await apiFetch(`${API_BASE_URL}/scans?${qs.toString()}`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function fetchScan(id: string): Promise<StoredScan> {
  const res = await apiFetch(`${API_BASE_URL}/scans/${encodeURIComponent(id)}`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function fetchEntityHistory(opts: {
  product?: string;
  seller?: string;
}): Promise<EntityHistoryResponse> {
  const qs = new URLSearchParams();
  if (opts.product) qs.set("product", opts.product);
  if (opts.seller) qs.set("seller", opts.seller);
  const res = await apiFetch(`${API_BASE_URL}/scans/history?${qs.toString()}`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export function scanEvidenceUrl(id: string): string {
  return `${API_BASE_URL}/scans/${encodeURIComponent(id)}/evidence`;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await apiFetch(`${API_BASE_URL}/dashboard/summary`);
  if (!res.ok) throw await parseError(res);
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

export async function overrideScanField(
  scanId: string,
  field: string,
  value: string,
  reason: string = ""
): Promise<StoredScan> {
  const res = await apiFetch(
    `${API_BASE_URL}/scans/${encodeURIComponent(scanId)}/override`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value, reason }),
    }
  );
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function checkComplianceWithOverrides(
  structuredFields: StructuredFields,
  isImported: boolean = false,
  officerOverrides?: Record<string, OfficerOverride>
): Promise<{
  compliance_summary: ComplianceSummary;
  compliance_results: ComplianceResults;
}> {
  const res = await apiFetch(`${API_BASE_URL}/compliance/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structured_fields: structuredFields,
      is_imported: isImported,
      officer_overrides: officerOverrides,
    }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export type SellerComplianceHistory = {
  seller_name: string;
  trust_score: number;
  risk_level: "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK";
  risk_label: string;
  total_scans: number;
  compliant_count: number;
  review_count: number;
  violations_count: number;
  repeat_violation_count: number;
  repeat_clauses: Array<{ rule_reference: string; times_violated: number }>;
  score_breakdown: {
    base_score: number;
    base_violation_deductions: number;
    repeat_violation_surcharge: number;
    review_deductions: number;
    compliant_credits: number;
  };
  monthly_trend: Array<{
    month: string;
    total_scans: number;
    violations: number;
    compliant: number;
    review: number;
  }>;
  chronological_violations: Array<{
    scan_id: string;
    date: string;
    product_name: string;
    field: string;
    rule_reference: string;
    rule_description: string;
    findings: string;
    penalty_clause: string;
    is_repeat: boolean;
    repeat_count: number;
  }>;
};

export async function fetchSellerCompliance(sellerName: string): Promise<SellerComplianceHistory> {
  const res = await apiFetch(`${API_BASE_URL}/sellers/${encodeURIComponent(sellerName)}/history`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export type RiskQueueSeller = {
  seller_name: string;
  total_scans: number;
  violations: number;
  reviews: number;
  compliant: number;
  last_scan: string;
  risk_score: number;
  risk_level: "critical" | "elevated" | "routine";
};

export async function fetchRiskQueue(): Promise<RiskQueueSeller[]> {
  const res = await apiFetch(`${API_BASE_URL}/sellers/risk-queue`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export type MockListing = {
  id: string;
  product_name: string;
  aliases: string[];
  barcode: string;
  platform: string;
  listing_url: string;
  seller_name: string;
  image_url?: string;
  declarations: Record<string, string>;
  mismatch_notes?: string;
};

export type FieldComparison = {
  field: string;
  status: "MATCH" | "MISMATCH" | "MISSING_PHYSICAL" | "MISSING_ONLINE";
  physical_value: string | null;
  online_value: string | null;
  rule_reference: string;
  details: string;
};

export type MismatchComparisonResult = {
  scan_id: string;
  product_name: string;
  online_listing: MockListing;
  comparison: {
    overall_status: "COMPLIANT" | "MISMATCH_DETECTED";
    is_concordant: boolean;
    match_count: number;
    mismatch_count: number;
    total_fields: number;
    fields: Record<string, FieldComparison>;
  };
};

export async function fetchMockListings(): Promise<MockListing[]> {
  const res = await apiFetch(`${API_BASE_URL}/mock-listings`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function compareScanListing(
  scanId: string,
  params?: { product_name?: string; barcode?: string; listing_id?: string }
): Promise<MismatchComparisonResult> {
  const res = await apiFetch(
    `${API_BASE_URL}/scans/${encodeURIComponent(scanId)}/compare-listing`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params || {}),
    }
  );
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export type AssistantSections = {
  legal_reference?: string;
  act_section?: string;
  statutory_requirement?: string;
  officer_guidance?: string;
  penal_sanction?: string;
  source?: string;
  source_authority?: string;
  inspection_finding?: {
    product: string;
    status: string;
    findings: string;
    rule_reference: string;
  };
};

export type AssistantResponse = {
  question: string;
  answer: string;
  sections?: AssistantSections;
  primary_clause: {
    id: string;
    clause_ref: string;
    title: string;
    act_section: string;
  };
  matched_clauses: Array<{
    id: string;
    clause_ref: string;
    title: string;
    relevance_score: number;
  }>;
};

export async function askAssistant(
  question: string,
  scanId?: string
): Promise<AssistantResponse> {
  const res = await apiFetch(`${API_BASE_URL}/assistant/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, scan_id: scanId }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}




