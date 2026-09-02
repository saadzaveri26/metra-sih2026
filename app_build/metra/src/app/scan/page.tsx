"use client";

import { useMemo, useRef, useState } from "react";
import {
  scanImage,
  ApiError,
  type ScanResponse,
  type ComplianceStatus,
} from "@/lib/api";
import { FIELD_LABELS, FIELD_ORDER } from "@/lib/fields";
import StatusChip, { statusBorderColor } from "@/components/StatusChip";
import BoundingBoxOverlay, {
  type OverlayBox,
} from "@/components/BoundingBoxOverlay";
import { CameraIcon, UploadIcon, ChevronDownIcon } from "@/components/icons";
import Avatar, { type AvatarState } from "@/components/Avatar";

type ViewState = "idle" | "loading" | "error" | "result";

export default function ScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isImported, setIsImported] = useState(false);
  const [state, setState] = useState<ViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const res = await scanImage(file, isImported);
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
    const boxes: OverlayBox[] = [];
    for (const field of Object.keys(result.compliance_results)) {
      const compliance = result.compliance_results[field];
      const bbox =
        compliance.bounding_box ?? result.structured_fields[field]?.bounding_box;
      if (bbox) {
        boxes.push({ field, status: compliance.status, points: bbox });
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

          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={isImported}
              onChange={(e) => setIsImported(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary-container)]"
            />
            This is an imported commodity
          </label>

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
            <div className="flex flex-col items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low py-4">
              <Avatar state="loading" className="h-40 w-auto object-contain" />
              <p className="text-center text-xs text-on-surface-variant px-6">
                Running OCR and checking against Legal Metrology rules — this
                can take a moment on first run while models load.
              </p>
            </div>
          )}
        </div>
      )}

      {state === "result" && result && imageUrl && (
        <ComplianceResultView
          result={result}
          imageUrl={imageUrl}
          overlayBoxes={overlayBoxes}
          onRescan={handleReset}
        />
      )}
    </div>
  );
}

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

function ComplianceResultView({
  result,
  imageUrl,
  overlayBoxes,
  onRescan,
}: {
  result: ScanResponse;
  imageUrl: string;
  overlayBoxes: OverlayBox[];
  onRescan: () => void;
}) {
  const { compliance_summary, compliance_results } = result;
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

  return (
    <div className="flex flex-col gap-4">
      {/* Verdict banner with avatar reaction */}
      <section className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <Avatar state={avatarState} className="h-28 w-auto shrink-0 object-contain" />
        <div>
          <p className="label-caps text-on-surface-variant">METRA Assessment</p>
          <p className="text-lg font-bold text-on-surface">
            {verdictCopy[compliance_summary.overall_status]}
          </p>
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
        <BoundingBoxOverlay imageUrl={imageUrl} boxes={overlayBoxes} />
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
      </section>

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
            />
          ))}
        </ul>
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRescan}
          className="flex-1 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface"
        >
          Scan Another
        </button>
        <button
          type="button"
          disabled
          title="Report export lands in Phase 7"
          className="flex-1 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary opacity-60"
        >
          Export Report
        </button>
      </div>
    </div>
  );
}

function RuleRow({
  field,
  result,
}: {
  field: string;
  result: ScanResponse["compliance_results"][string];
}) {
  const [open, setOpen] = useState(result.status !== "COMPLIANT");
  const showDetail = result.status !== "COMPLIANT";

  return (
    <li className={`border-l-4 ${statusBorderColor(result.status)}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
