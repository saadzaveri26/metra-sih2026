"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  scanImage,
  downloadInspectionReport,
  overrideScanField,
  checkComplianceWithOverrides,
  ApiError,
  type ScanResponse,
  type ReportFormat,
} from "@/lib/api";
import { FIELD_LABELS, FIELD_ORDER } from "@/lib/fields";
import StatusChip, { statusBorderColor } from "@/components/StatusChip";
import BoundingBoxOverlay, {
  type OverlayBox,
} from "@/components/BoundingBoxOverlay";
import { CameraIcon, UploadIcon, ChevronDownIcon, EditIcon } from "@/components/icons";
import Avatar, { type AvatarState } from "@/components/Avatar";
import DeclarationsPanel from "@/components/DeclarationsPanel";
import FontAnalysisPanel from "@/components/FontAnalysisPanel";
import OfficerOverrideModal from "@/components/OfficerOverrideModal";
import ReportPreviewModal from "@/components/ReportPreviewModal";
import MismatchComparisonModal from "@/components/MismatchComparisonModal";

type ViewState = "idle" | "loading" | "error" | "result";

// Steps shown during OCR processing
const SCAN_STEPS = [
  { label: "Running OCR", detail: "Extracting text from label image…" },
  { label: "Structuring Fields", detail: "Mapping text to mandatory declarations…" },
  { label: "Compliance Check", detail: "Evaluating against Legal Metrology Rules 2011…" },
];

function useLoadingStep(active: boolean) {
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    if (!active) { setStepIdx(0); return; }
    setStepIdx(0);
    const t1 = setTimeout(() => setStepIdx(1), 3000);
    const t2 = setTimeout(() => setStepIdx(2), 6500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);
  return stepIdx;
}

export default function ScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [isImported, setIsImported] = useState(false);
  const [state, setState] = useState<ViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadingStep = useLoadingStep(state === "loading");

  function handleFileSelect(f: File) {
    // F1 fix: Revoke previous blob URL to prevent memory leak
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setFile(f);
    setImageUrl(URL.createObjectURL(f));
    setResult(null);
    setState("idle");
    setError(null);
  }

  async function handleAnalyze() {
    if (!file) return;
    setState("loading");
    setError(null);
    try {
      const res = await scanImage(file, isImported, productName, sellerName);
      setResult(res);
      setState("result");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong while scanning the image."
      );
      setState("error");
    }
  }

  function handleReset() {
    // F1 fix: Revoke blob URL to prevent memory leak
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setFile(null);
    setImageUrl(null);
    setResult(null);
    setState("idle");
    setError(null);
  }

  const overlayBoxes: OverlayBox[] = useMemo(() => {
    if (!result) return [];
    if (result.region_overlays && result.region_overlays.length > 0) {
      return result.region_overlays.map((o) => ({
        field: o.field,
        status: o.status,
        points: o.bounding_box,
        kind: o.kind,
        rule_reference: o.rule_reference,
        findings: o.findings,
      }));
    }
    const boxes: OverlayBox[] = [];
    for (const field of Object.keys(result.compliance_results)) {
      const compliance = result.compliance_results[field];
      const bbox =
        compliance.bounding_box ?? result.structured_fields[field]?.bounding_box;
      if (bbox) {
        boxes.push({ field, status: compliance.status, points: bbox, kind: "matched" });
      }
    }
    return boxes;
  }, [result]);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h1 className="text-xl font-bold text-on-surface">Scan Product</h1>

      {!imageUrl && (
        <UploadZone inputRef={inputRef} onSelect={handleFileSelect} />
      )}

      {imageUrl && state !== "result" && (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg border border-outline-variant">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Selected product label" className="block w-full" />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm text-on-surface">
              Product name
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Britannia Marie Gold 250 g"
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
              />
            </label>
            <label className="text-sm text-on-surface">
              Seller / establishment
              <input
                type="text"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="e.g. Kirana Mart, MG Road"
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={isImported}
                onChange={(e) => setIsImported(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary-container)]"
              />
              This is an imported commodity
            </label>
          </div>

          {state === "error" && (
            <p className="rounded-lg bg-violation-container px-3 py-2 text-sm text-violation">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface"
            >
              Choose Different Image
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={state === "loading"}
              className="flex-1 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              {state === "loading" ? "Analyzing…" : "Analyze Label"}
            </button>
          </div>

          {state === "loading" && (
            <ScanLoadingCard stepIdx={loadingStep} />
          )}
        </div>
      )}

      {state === "result" && result && imageUrl && (
        <ComplianceResultView
          result={result}
          imageUrl={imageUrl}
          overlayBoxes={overlayBoxes}
          file={file}
          onRescan={handleReset}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading card with step-progress indicator
// ---------------------------------------------------------------------------
function ScanLoadingCard({ stepIdx }: { stepIdx: number }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-low py-6 px-4">
      <Avatar state="loading" className="h-36 w-auto object-contain" />

      {/* Step progress */}
      <div className="w-full space-y-2">
        {SCAN_STEPS.map((step, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div key={step.label} className="flex items-start gap-3">
              {/* indicator */}
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                  done
                    ? "bg-compliant text-white"
                    : active
                      ? "bg-primary-container text-on-primary animate-pulse"
                      : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <div>
                <p
                  className={`text-sm font-semibold ${
                    active ? "text-on-surface" : done ? "text-compliant" : "text-on-surface-variant"
                  }`}
                >
                  {step.label}
                </p>
                {active && (
                  <p className="text-xs text-on-surface-variant">{step.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-on-surface-variant">
        First-run may take longer while the OCR model warms up.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload zone
// ---------------------------------------------------------------------------
function UploadZone({
  inputRef,
  onSelect,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (f: File) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low px-4 py-6 text-center">
      <Avatar state="scanning" className="h-40 w-auto object-contain" />
      <div>
        <p className="text-base font-bold text-on-surface">Capture or upload a label</p>
        <p className="mt-1 text-sm text-on-surface-variant">
          JPG or PNG of the product packaging, clearly lit and in focus.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
        }}
      />
      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary"
        >
          <CameraIcon width={18} height={18} /> Capture
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface"
        >
          <UploadIcon width={18} height={18} /> Upload
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Raw OCR text fallback accordion (shown when no bounding boxes are available)
// ---------------------------------------------------------------------------
function RawOcrAccordion({ blocks }: { blocks: ScanResponse["blocks"] }) {
  const [open, setOpen] = useState(false);
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="rounded-lg border border-outline-variant">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <p className="text-sm font-semibold text-on-surface">
          Raw OCR text ({blocks.length} blocks detected)
        </p>
        <ChevronDownIcon
          width={16}
          height={16}
          className={`text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto border-t border-outline-variant px-4 py-3 space-y-1">
          {blocks.map((b, i) => (
            <p key={i} className="text-xs text-on-surface-variant">
              <span className="font-semibold text-on-surface">{b.text}</span>
              <span className="ml-2 opacity-60">({(b.confidence * 100).toFixed(0)}%)</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compliance result view
// ---------------------------------------------------------------------------
function ComplianceResultView({
  result,
  imageUrl,
  overlayBoxes,
  file,
  onRescan,
}: {
  result: ScanResponse;
  imageUrl: string;
  overlayBoxes: OverlayBox[];
  file: File | null;
  onRescan: () => void;
}) {
  const [scan, setScan] = useState<ScanResponse>(result);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [overrideModalField, setOverrideModalField] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [exporting, setExporting] = useState<ReportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Synchronize internal state if parent result prop changes
  useEffect(() => {
    setScan(result);
  }, [result]);

  const { compliance_summary, compliance_results, structured_fields, blocks } = scan;

  async function handleApplyOverride(field: string, value: string, reason: string) {
    if (scan.id) {
      const updated = await overrideScanField(scan.id, field, value, reason);
      if (updated && updated.payload) {
        setScan(updated.payload);
      }
    } else {
      const newOverrides = {
        ...(scan.officer_overrides ?? {}),
        [field]: {
          value,
          original_ai_value: scan.structured_fields[field]?.value ?? null,
          updated_at: new Date().toISOString(),
          reason,
          is_authoritative: true,
        },
      };
      const structured = { ...scan.structured_fields };
      if (structured[field]) {
        structured[field] = {
          ...structured[field],
          officer_override: newOverrides[field],
        };
      } else {
        structured[field] = {
          value: null,
          confidence: 1.0,
          raw_match: null,
          source_block_index: null,
          bounding_box: null,
          officer_override: newOverrides[field],
        };
      }
      const checked = await checkComplianceWithOverrides(
        structured,
        scan.is_imported ?? false,
        newOverrides
      );
      setScan({
        ...scan,
        structured_fields: structured,
        officer_overrides: newOverrides,
        compliance_summary: checked.compliance_summary,
        compliance_results: checked.compliance_results,
      });
    }
  }

  async function handleExport(format: ReportFormat) {
    if (!file) return;
    setExporting(format);
    setExportError(null);
    try {
      await downloadInspectionReport(file, scan, format);
    } catch (err) {
      setExportError(
        err instanceof ApiError ? err.message : "Could not export the inspection report."
      );
    } finally {
      setExporting(null);
    }
  }

  const score = Math.round(
    (compliance_summary.compliant_count / Math.max(compliance_summary.total_fields_checked, 1)) *
      100
  );

  const avatarState: AvatarState =
    compliance_summary.overall_status === "COMPLIANT"
      ? "approved"
      : compliance_summary.overall_status === "NEEDS_REVIEW"
        ? "warning"
        : "mismatch";

  const verdictCopy: Record<typeof compliance_summary.overall_status, string> = {
    COMPLIANT: "Product Verified",
    NEEDS_REVIEW: "Attention Required",
    NON_COMPLIANT: "Violation Detected",
  };

  // Keep overlay boxes' status in sync with any overrides
  const effectiveBoxes = useMemo(() => {
    return overlayBoxes.map((b) => {
      const fieldRes = compliance_results[b.field];
      return fieldRes ? { ...b, status: fieldRes.status } : b;
    });
  }, [overlayBoxes, compliance_results]);

  const hasOverlays = effectiveBoxes.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Verdict banner */}
      <section className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <Avatar state={avatarState} className="h-28 w-auto shrink-0 object-contain" />
        <div>
          <p className="label-caps text-on-surface-variant">METRA Assessment</p>
          <p className="text-lg font-bold text-on-surface">
            {verdictCopy[compliance_summary.overall_status]}
          </p>
          {(scan.id || scan.product_name) && (
            <p className="text-xs text-on-surface-variant">
              {scan.id ? `Saved ${scan.id}` : "Not saved"}
              {scan.product_name ? ` · ${scan.product_name}` : ""}
              {scan.seller_name && (
                <>
                  {" · "}
                  <Link
                    href={`/sellers/${encodeURIComponent(scan.seller_name)}`}
                    className="font-semibold text-primary-container hover:underline"
                    title="View Seller Compliance Graph & Trust Score"
                  >
                    {scan.seller_name} (Trust Profile)
                  </Link>
                </>
              )}
            </p>
          )}
          <p className="text-sm text-on-surface-variant">
            {compliance_summary.compliant_count} compliant &middot;{" "}
            {compliance_summary.review_count} needs review &middot;{" "}
            {compliance_summary.violations_count} violations
          </p>
        </div>
      </section>

      {/* Image analysis */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold text-on-surface">Image Analysis</h2>
          <span className="label-caps rounded bg-surface-container-high px-2 py-1 text-on-surface-variant">
            Label Scan
          </span>
        </div>
        <BoundingBoxOverlay
          imageUrl={imageUrl}
          boxes={effectiveBoxes}
          activeField={activeField}
          onSelectField={setActiveField}
        />
        <p className="mt-2 text-[11px] text-on-surface-variant">
          Tap a region for the rule reference. Dashed boxes are nearest OCR candidates or
          missing-declaration markers on the image edge.
        </p>

        {!hasOverlays && (
          <div className="mt-2 rounded-lg bg-surface-container px-3 py-2.5 text-sm text-on-surface-variant">
            <p className="font-semibold text-on-surface">No region overlays available</p>
            <p className="mt-0.5 text-xs">
              OCR extracted text but could not map bounding boxes to mandatory declaration
              regions. This is common on scanned (non-photo) images. Check the raw OCR text
              and Extracted Declarations below for what was read.
            </p>
          </div>
        )}

        <div className="mt-2 flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-compliant">
            <span className="h-2 w-2 rounded-full bg-compliant" /> Compliant
          </span>
          <span className="flex items-center gap-1.5 text-review">
            <span className="h-2 w-2 rounded-full bg-review" /> Needs Review
          </span>
          <span className="flex items-center gap-1.5 text-violation">
            <span className="h-2 w-2 rounded-full bg-violation" /> Non-Compliant
          </span>
        </div>

        {!hasOverlays && blocks && blocks.length > 0 && (
          <div className="mt-3">
            <RawOcrAccordion blocks={blocks} />
          </div>
        )}
      </section>

      {/* ── Extracted Declarations with Manual Override Affordance ── */}
      <DeclarationsPanel
        structuredFields={structured_fields}
        activeField={activeField}
        onSelectField={setActiveField}
        onEditField={(f) => setOverrideModalField(f)}
      />

      {scan.font_analysis && (
        <FontAnalysisPanel analysis={scan.font_analysis} />
      )}

      {/* Score */}
      <section className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <div>
          <h2 className="text-base font-bold text-on-surface">Compliance Score</h2>
          <p className="text-sm text-on-surface-variant">Automated Rule Assessment</p>
        </div>
        <div className="text-right">
          <span className="text-4xl font-bold text-on-surface">{score}</span>
          <span className="ml-1 text-sm text-on-surface-variant">/100</span>
        </div>
      </section>

      {/* Signature Demo Feature: Online vs. Physical Mismatch Cross-Verification */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-primary-container/40 bg-primary-container/10 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary">
              Signature Feature
            </span>
            <h3 className="text-sm font-bold text-on-surface">
              Online Marketplace vs. Physical Packaging Cross-Verification
            </h3>
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">
            Cross-check physical package declarations against e-commerce listings for price inflation, quantity short-delivery, and origin discrepancies under Rule 6(10).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCompareModalOpen(true)}
          disabled={!scan.id}
          className="rounded-lg bg-primary-container px-4 py-2.5 text-xs font-semibold text-on-primary hover:opacity-90 disabled:opacity-50 shrink-0"
        >
          {scan.id ? "Compare vs. Marketplace →" : "Save Scan to Compare"}
        </button>
      </section>

      {/* Rule checklist */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant px-4 py-3">
          <h2 className="text-base font-bold text-on-surface">Rule Checklist</h2>
        </div>
        <ul className="divide-y divide-outline-variant">
          {FIELD_ORDER.filter((f) => compliance_results[f]).map((field) => (
            <RuleRow
              key={field}
              field={field}
              result={compliance_results[field]}
              highlighted={activeField === field}
              scanId={scan.id}
              onHighlight={() =>
                setActiveField((cur) => (cur === field ? null : field))
              }
              onEdit={() => setOverrideModalField(field)}
            />
          ))}
        </ul>
      </section>

      {exportError && (
        <p className="rounded-lg bg-violation-container px-3 py-2 text-sm text-violation">
          {exportError}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRescan}
          className="flex-1 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
        >
          Scan Another
        </button>
        <button
          type="button"
          disabled={!file}
          onClick={() => setPreviewOpen(true)}
          className="flex-1 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary hover:opacity-90 disabled:opacity-60"
        >
          Preview Report
        </button>
        <button
          type="button"
          disabled={!file || exporting !== null}
          onClick={() => handleExport("pdf")}
          className="flex-1 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-60"
        >
          {exporting === "pdf" ? "Exporting PDF…" : "Export PDF"}
        </button>
        <button
          type="button"
          disabled={!file || exporting !== null}
          onClick={() => handleExport("docx")}
          className="flex-1 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-60"
        >
          {exporting === "docx" ? "Exporting DOCX…" : "Export DOCX"}
        </button>
      </div>

      {/* In-App Report Preview Modal */}
      <ReportPreviewModal
        isOpen={previewOpen}
        file={file}
        scan={scan}
        onClose={() => setPreviewOpen(false)}
      />

      {/* Online vs. Physical Mismatch Comparison Modal */}
      <MismatchComparisonModal
        isOpen={compareModalOpen}
        scanId={scan.id || null}
        productName={scan.product_name}
        onClose={() => setCompareModalOpen(false)}
      />

      {/* Officer Manual Override Modal */}
      <OfficerOverrideModal
        isOpen={overrideModalField !== null}
        field={overrideModalField}
        currentAiValue={
          overrideModalField
            ? structured_fields[overrideModalField]?.value ?? null
            : null
        }
        currentOverride={
          overrideModalField
            ? structured_fields[overrideModalField]?.officer_override ??
              scan.officer_overrides?.[overrideModalField] ??
              null
            : null
        }
        onClose={() => setOverrideModalField(null)}
        onSave={handleApplyOverride}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rule row
// ---------------------------------------------------------------------------
function RuleRow({
  field,
  result,
  highlighted,
  scanId,
  onHighlight,
  onEdit,
}: {
  field: string;
  result: ScanResponse["compliance_results"][string];
  highlighted: boolean;
  scanId?: string | null;
  onHighlight: () => void;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(result.status !== "COMPLIANT");
  const showDetail = true;

  const override = result.officer_override;
  const isOverridden = result.is_overridden || override != null;

  return (
    <li
      className={`border-l-4 ${statusBorderColor(result.status)} ${
        highlighted ? "bg-surface-container" : ""
      }`}
    >
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            onHighlight();
          }}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-on-surface">
              {FIELD_LABELS[field] ?? field}
            </p>
            {isOverridden && (
              <span className="rounded bg-primary-container/20 px-1.5 py-0.5 text-[10px] font-bold text-primary-container">
                Officer Override
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant">{result.rule_reference}</p>
        </button>

        <div className="flex items-center gap-2">
          <StatusChip status={result.status} size="sm" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Manual officer override"
            className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <EditIcon width={14} height={14} />
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="p-1 text-on-surface-variant"
          >
            <ChevronDownIcon
              width={16}
              height={16}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {showDetail && open && (
        <div className="px-4 pb-4 text-sm text-on-surface-variant space-y-2">
          <p className="font-semibold text-on-surface">{result.rule_description}</p>
          <p>{result.findings}</p>

          {/* Audit trail comparison */}
          {isOverridden && (
            <div className="rounded-lg bg-surface-container p-2.5 text-xs">
              <p className="font-semibold text-on-surface mb-1">Audit Record</p>
              <p>
                <span className="font-medium text-on-surface">Original AI Read: </span>
                <span className="font-mono text-on-surface-variant">
                  {result.ai_value ?? "Not detected"}
                </span>
              </p>
              <p>
                <span className="font-medium text-on-surface">Officer Override: </span>
                <span className="font-semibold text-compliant">
                  {result.effective_value ?? override?.value}
                </span>{" "}
                <span className="text-[10px] font-bold text-primary-container">
                  (Authoritative for verdict)
                </span>
              </p>
              {override?.reason && (
                <p>
                  <span className="font-medium text-on-surface">Reason: </span>
                  {override.reason}
                </p>
              )}
            </div>
          )}

          {result.penalty_clause && (
            <p className="rounded-lg bg-surface-container-high px-3 py-2 text-xs">
              <span className="font-semibold">Penalty: </span>
              {result.penalty_clause}
            </p>
          )}

          {/* Ask METRA Legal Reference Affordance */}
          <div className="pt-1.5 flex items-center justify-between border-t border-outline-variant/60">
            <Link
              href={`/assistant?${scanId ? `scan_id=${encodeURIComponent(scanId)}&` : ""}q=${encodeURIComponent(
                `Why did ${FIELD_LABELS[field] || field} receive ${result.status} status under ${result.rule_reference}? What are the statutory requirements?`
              )}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-container hover:underline"
              title="Consult METRA Legal Assistant on this rule"
            >
              <span>💬</span>
              <span>Ask METRA about this rule & penalties →</span>
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}
