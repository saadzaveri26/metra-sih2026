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
  reason: string;
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

export type HealthFlag = {
  code: string;
  label: string;
};

export type HealthGuide = {
  ingredients_text: string | null;
  ingredients_list: string[] | null;
  allergens: string[];
  health_flags: HealthFlag[];
  veg_status: "Vegetarian" | "Non-Vegetarian" | null;
  nutrition_facts: Record<string, number>;
  disclaimer: string;
};

export type ScanResponse = {
  blocks: OcrBlock[];
  structured_fields: StructuredFields;
  compliance_summary: ComplianceSummary;
  compliance_results: ComplianceResults;
  font_analysis?: FontAnalysis;
  region_overlays?: RegionOverlay[];
  health_guide?: HealthGuide;
  image_width?: number;
  image_height?: number;
  id?: string | null;
  created_at?: string;
  product_name?: string;
  seller_name?: string;
  is_imported?: boolean;
  officer_overrides?: Record<string, OfficerOverride>;
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

export async function downloadInspectionReport(
  file: File,
  scan: ScanResponse,
  format: ReportFormat
): Promise<void> {
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
      `Could not reach the backend at ${API_BASE_URL} to export the report.`
    );
  }

  if (!res.ok) throw await parseError(res);

  const blob = await res.blob();
  const ext = format === "pdf" ? "pdf" : "docx";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `metra-inspection-report.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Builds a mailto: link pre-filled with a compliance summary for the scanned
 * product. Browsers cannot attach files to a mailto link programmatically —
 * the caller is expected to also trigger a PDF/DOCX download and tell the
 * user to attach it manually in the email client that opens.
 */
export function buildCompanyMailtoLink(
  companyEmail: string,
  scan: ScanResponse
): string {
  const product = scan.product_name || "Unnamed product";
  const seller = scan.seller_name ? ` (Seller: ${scan.seller_name})` : "";
  const score = Math.round(
    (scan.compliance_summary.compliant_count /
      Math.max(scan.compliance_summary.total_fields_checked, 1)) *
      100
  );
  const scannedAt = scan.created_at
    ? new Date(scan.created_at).toLocaleString()
    : new Date().toLocaleString();

  const subject = `METRA Compliance Report — ${product}`;

  const violationLines = Object.entries(scan.compliance_results)
    .filter(([, r]) => r.status !== "COMPLIANT")
    .map(([field, r]) => `  • ${field.replace(/_/g, " ")}: ${r.findings}`)
    .join("\n");

  const bodyLines = [
    `Product: ${product}${seller}`,
    `Scanned on: ${scannedAt}`,
    `Overall status: ${scan.compliance_summary.overall_status.replace("_", " ")}`,
    `Compliance score: ${score}/100`,
    "",
    violationLines
      ? `Issues found:\n${violationLines}`
      : "No violations found on this scan.",
    "",
    "The full inspection report (PDF) has been downloaded to this device — please attach it before sending.",
    "",
    "— Sent via METRA (Metrology Enforcement & Traceability Regulatory Assistant)",
  ];

  const body = bodyLines.join("\n");

  return `mailto:${encodeURIComponent(companyEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
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

// ---------------------------------------------------------------------------
export async function generateReportBlob(
  file: File | Blob,
  scan: ScanResponse,
  format: ReportFormat = "pdf"
): Promise<Blob> {
  const form = new FormData();
  form.append("file", file, file instanceof File ? file.name : "evidence.jpg");
  form.append("payload", JSON.stringify(scan));

  const res = await apiFetch(`${API_BASE_URL}/report/${format}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw await parseError(res);
  return res.blob();
}

// ---------------------------------------------------------------------------
// Phase C1: Officer Overrides
// ---------------------------------------------------------------------------
export async function applyOfficerOverride(
  scanId: string,
  field: string,
  value: string,
  reason: string
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

// ---------------------------------------------------------------------------
// Phase C2: E-Commerce Mismatch Checker
// ---------------------------------------------------------------------------
export type MockListing = {
  id: string;
  product_name: string;
  aliases?: string[];
  barcode?: string;
  platform?: string;
  marketplace?: string;
  seller_name?: string;
  listing_url?: string;
  image_url?: string;
  declarations?: {
    manufacturer?: string;
    net_quantity?: string;
    mrp?: string;
    country_of_origin?: string;
    manufacture_date?: string;
    consumer_care?: string;
  };
};

export type MismatchComparisonField = {
  field: string;
  status: "MATCH" | "MISMATCH" | "MISSING_PHYSICAL" | "MISSING_ONLINE" | string;
  physical_value: string | null;
  online_value: string | null;
  rule_reference: string;
  details: string;
};

export type MismatchComparisonResult = {
  matched_listing?: MockListing | null;
  online_listing?: MockListing | null;
  overall_status?: "COMPLIANT" | "MISMATCH_DETECTED" | "NO_LISTING_FOUND" | string;
  is_concordant?: boolean;
  match_count?: number;
  mismatch_count?: number;
  total_fields?: number;
  fields?: Record<string, MismatchComparisonField>;
  comparison?: {
    is_concordant: boolean;
    match_count: number;
    mismatch_count: number;
    total_fields: number;
    fields: Record<string, MismatchComparisonField>;
  };
  message?: string;
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
  const data = await res.json();
  // Ensure both direct fields and comparison wrapper are accessible
  if (data && !data.comparison && data.fields) {
    data.comparison = {
      is_concordant: data.is_concordant ?? true,
      match_count: data.match_count ?? 0,
      mismatch_count: data.mismatch_count ?? 0,
      total_fields: data.total_fields ?? Object.keys(data.fields).length,
      fields: data.fields,
    };
  }
  if (data && !data.online_listing && data.matched_listing) {
    data.online_listing = data.matched_listing;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Phase C3: Seller Risk Queue & Compliance Profile
// ---------------------------------------------------------------------------
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

export type RepeatClause = {
  rule_reference: string;
  times_violated: number;
  statutory_title?: string;
};

export type ScoreBreakdown = {
  base_violation_deductions: number;
  repeat_violation_surcharge: number;
  compliant_credits: number;
};

export type MonthlyTrendItem = {
  month: string;
  violations: number;
  compliant: number;
  total_scans: number;
};

export type ChronologicalViolation = {
  scan_id: string;
  created_at?: string;
  date?: string;
  product_name: string;
  field: string;
  rule_reference: string;
  rule_description?: string;
  penalty_clause?: string;
  findings?: string;
  is_repeat?: boolean;
  repeat_count?: number;
};

export type SellerComplianceHistory = {
  seller_name: string;
  entity?: string;
  type?: string;
  trust_score: number;
  risk_level: "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK" | string;
  risk_label: string;
  total_scans: number;
  compliant_count: number;
  review_count: number;
  violations_count: number;
  repeat_violation_count: number;
  repeat_clauses: RepeatClause[];
  score_breakdown: ScoreBreakdown;
  monthly_trend: MonthlyTrendItem[];
  chronological_violations: ChronologicalViolation[];
  overall_status_counts?: Record<string, number>;
  compliance_rate?: number;
  common_violations?: Array<{ field: string; count: number }>;
  history?: Array<{
    id: string;
    created_at: string;
    product_name: string;
    overall_status: string;
    score: number;
    violations_count: number;
  }>;
};

export async function fetchSellerCompliance(
  sellerName: string
): Promise<SellerComplianceHistory> {
  const res = await apiFetch(
    `${API_BASE_URL}/sellers/${encodeURIComponent(sellerName)}/history`
  );
  if (!res.ok) throw await parseError(res);
  const data = await res.json();

  // Normalize data for SellerComplianceGraph if returned from basic entity history
  const historyItems = data.history || [];
  const compliantCount = historyItems.filter((h: any) => h.overall_status === "COMPLIANT").length;
  const reviewCount = historyItems.filter((h: any) => h.overall_status === "NEEDS_REVIEW").length;
  const violationsCount = historyItems.filter((h: any) => h.overall_status === "NON_COMPLIANT").length;
  const total = Math.max(historyItems.length, 1);

  const trustScore = Math.max(0, Math.min(100, Math.round(100 - (violationsCount * 18 + reviewCount * 6) / total * 10)));
  const riskLevel = trustScore >= 75 ? "LOW_RISK" : trustScore >= 45 ? "MODERATE_RISK" : "HIGH_RISK";
  const riskLabel = riskLevel === "LOW_RISK" ? "Low Risk" : riskLevel === "MODERATE_RISK" ? "Moderate Risk" : "High Risk";

  return {
    seller_name: data.seller_name || data.entity || sellerName,
    entity: data.entity || sellerName,
    type: data.type || "seller",
    trust_score: data.trust_score ?? trustScore,
    risk_level: data.risk_level ?? riskLevel,
    risk_label: data.risk_label ?? riskLabel,
    total_scans: data.total_scans ?? historyItems.length,
    compliant_count: data.compliant_count ?? compliantCount,
    review_count: data.review_count ?? reviewCount,
    violations_count: data.violations_count ?? violationsCount,
    repeat_violation_count: data.repeat_violation_count ?? Math.max(0, violationsCount - 1),
    repeat_clauses: data.repeat_clauses || [],
    score_breakdown: data.score_breakdown || {
      base_violation_deductions: violationsCount * 8,
      repeat_violation_surcharge: Math.max(0, violationsCount - 1) * 15,
      compliant_credits: compliantCount * 4,
    },
    monthly_trend: data.monthly_trend || [
      { month: "Current", violations: violationsCount, compliant: compliantCount, total_scans: historyItems.length }
    ],
    chronological_violations: data.chronological_violations || [],
    overall_status_counts: data.overall_status_counts || {},
    compliance_rate: data.compliance_rate ?? Math.round((compliantCount / total) * 100),
    common_violations: data.common_violations || [],
    history: historyItems,
  };
}

// ---------------------------------------------------------------------------
// Phase C4: "Ask METRA" Statutory Legal Assistant
// ---------------------------------------------------------------------------
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
    body: JSON.stringify({ question, scan_id: scanId || null }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}


