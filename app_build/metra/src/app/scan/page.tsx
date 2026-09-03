"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  scanImage,
  downloadInspectionReport,
  buildCompanyMailtoLink,
  ApiError,
  type ScanResponse,
  type ReportFormat,
} from "@/lib/api";
import { FIELD_LABELS, FIELD_ORDER } from "@/lib/fields";
import StatusChip, { statusBorderColor } from "@/components/StatusChip";
import BoundingBoxOverlay, {
  type OverlayBox,
} from "@/components/BoundingBoxOverlay";
import { CameraIcon, UploadIcon, ChevronDownIcon, MailIcon } from "@/components/icons";
import Avatar, { type AvatarState } from "@/components/Avatar";
import DeclarationsPanel from "@/components/DeclarationsPanel";
import FontAnalysisPanel from "@/components/FontAnalysisPanel";
import HealthGuidePanel from "@/components/HealthGuidePanel";

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
  const { compliance_summary, compliance_results, structured_fields, blocks } = result;
  const [activeField, setActiveField] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ReportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport(format: ReportFormat) {
    if (!file) return;
    setExporting(format);
    setExportError(null);
    try {
      await downloadInspectionReport(file, result, format);
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

  const hasOverlays = overlayBoxes.length > 0;

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
          {(result.id || result.product_name) && (
            <p className="text-xs text-on-surface-variant">
              {result.id ? `Saved ${result.id}` : "Not saved"}
              {result.product_name ? ` · ${result.product_name}` : ""}
              {result.seller_name ? ` · ${result.seller_name}` : ""}
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
          boxes={overlayBoxes}
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

      {/* ── Phase 3: Extracted Declarations ── */}
      <DeclarationsPanel structuredFields={structured_fields} />

      {result.font_analysis && (
        <FontAnalysisPanel analysis={result.font_analysis} />
      )}

      {/* Consumer Health Guide */}
      <HealthGuidePanel guide={result.health_guide} />

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
              onHighlight={() =>
                setActiveField((cur) => (cur === field ? null : field))
              }
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
          className="flex-1 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface"
        >
          Scan Another
        </button>
        <button
          type="button"
          disabled={!file || exporting !== null}
          onClick={() => handleExport("pdf")}
          className="flex-1 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
        >
          {exporting === "pdf" ? "Exporting PDF…" : "Export PDF"}
        </button>
        <button
          type="button"
          disabled={!file || exporting !== null}
          onClick={() => handleExport("docx")}
          className="flex-1 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface disabled:opacity-60"
        >
          {exporting === "docx" ? "Exporting DOCX…" : "Export DOCX"}
        </button>
      </div>

      <MailToCompanySection result={result} file={file} onExport={handleExport} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mail to Company — opens the user's own email client, pre-filled with a
// summary of the scan. Browsers cannot attach files to a mailto link, so
// this also downloads the PDF report and tells the user to attach it.
// ---------------------------------------------------------------------------
function MailToCompanySection({
  result,
  file,
  onExport,
}: {
  result: ScanResponse;
  file: File | null;
  onExport: (format: ReportFormat) => Promise<void>;
}) {
  const [companyEmail, setCompanyEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail.trim());

  async function handleMailToCompany() {
    if (!emailValid) {
      setStatus("error");
      setErrorMsg("Enter a valid company email address.");
      return;
    }
    setStatus("sending");
    setErrorMsg(null);
    try {
      // Download the PDF first so the user has a file ready to attach —
      // mailto links cannot carry attachments.
      if (file) {
        await onExport("pdf");
      }
      const mailtoUrl = buildCompanyMailtoLink(companyEmail.trim(), result);
      window.location.href = mailtoUrl;
      setStatus("sent");
    } catch {
      setStatus("error");
      setErrorMsg("Could not prepare the report for email. Try exporting PDF manually first.");
    }
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex items-center gap-2">
        <MailIcon width={18} height={18} className="text-on-surface-variant" />
        <h2 className="text-base font-bold text-on-surface">Mail to Company</h2>
      </div>
      <p className="text-xs text-on-surface-variant">
        Opens your email app with the compliance summary pre-filled and downloads
        the PDF report — attach the downloaded file before sending.
      </p>

      <input
        type="email"
        value={companyEmail}
        onChange={(e) => {
          setCompanyEmail(e.target.value);
          if (status === "error") setStatus("idle");
        }}
        placeholder="company@example.com"
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
      />

      {status === "error" && errorMsg && (
        <p className="rounded-lg bg-violation-container px-3 py-2 text-xs text-violation">
          {errorMsg}
        </p>
      )}
      {status === "sent" && (
        <p className="rounded-lg bg-compliant-container px-3 py-2 text-xs text-compliant">
          Email app opened — remember to attach the PDF that was just downloaded.
        </p>
      )}

      <button
        type="button"
        disabled={!companyEmail || status === "sending"}
        onClick={handleMailToCompany}
        className="rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
      >
        {status === "sending" ? "Preparing…" : "Mail to Company"}
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Rule row
// ---------------------------------------------------------------------------
function RuleRow({
  field,
  result,
  highlighted,
  onHighlight,
}: {
  field: string;
  result: ScanResponse["compliance_results"][string];
  highlighted: boolean;
  onHighlight: () => void;
}) {
  const [open, setOpen] = useState(result.status !== "COMPLIANT");
  const showDetail = result.status !== "COMPLIANT";

  return (
    <li
      className={`border-l-4 ${statusBorderColor(result.status)} ${
        highlighted ? "bg-surface-container" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          onHighlight();
        }}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-bold text-on-surface">
            {FIELD_LABELS[field] ?? field}
          </p>
          <p className="text-xs text-on-surface-variant">{result.rule_reference}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={result.status} size="sm" />
          {showDetail && (
            <ChevronDownIcon
              width={16}
              height={16}
              className={`text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </button>
      {showDetail && open && (
        <div className="px-4 pb-4 text-sm text-on-surface-variant">
          <p className="mb-1 font-semibold text-on-surface">{result.rule_description}</p>
          <p>{result.findings}</p>
          {result.penalty_clause && (
            <p className="mt-2 rounded-lg bg-surface-container-high px-3 py-2 text-xs">
              <span className="font-semibold">Penalty: </span>
              {result.penalty_clause}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
