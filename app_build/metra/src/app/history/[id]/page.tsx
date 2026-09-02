"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  fetchScan,
  scanEvidenceUrl,
  downloadInspectionReport,
  ApiError,
  type StoredScan,
  type ReportFormat,
  type ScanResponse,
} from "@/lib/api";
import { FIELD_LABELS, FIELD_ORDER } from "@/lib/fields";
import StatusChip, { statusBorderColor } from "@/components/StatusChip";
import BoundingBoxOverlay, { type OverlayBox } from "@/components/BoundingBoxOverlay";
import DeclarationsPanel from "@/components/DeclarationsPanel";
import FontAnalysisPanel from "@/components/FontAnalysisPanel";
import MismatchComparisonModal from "@/components/MismatchComparisonModal";
import { ArrowLeftIcon, ChevronDownIcon } from "@/components/icons";

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [record, setRecord] = useState<StoredScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ReportFormat | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  useEffect(() => {
    fetchScan(id)
      .then(setRecord)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load this scan.")
      );
  }, [id]);

  const payload: ScanResponse | null = record?.payload ?? null;
  const imageUrl = record?.has_evidence ? scanEvidenceUrl(record.id) : null;

  const overlayBoxes: OverlayBox[] = useMemo(() => {
    if (!payload?.region_overlays) return [];
    return payload.region_overlays.map((o) => ({
      field: o.field,
      status: o.status,
      points: o.bounding_box,
      kind: o.kind,
      rule_reference: o.rule_reference,
      findings: o.findings,
    }));
  }, [payload]);

  async function handleExport(format: ReportFormat) {
    if (!payload || !imageUrl) return;
    setExporting(format);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], `${id}.jpg`, { type: "image/jpeg" });
      await downloadInspectionReport(file, payload, format);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  if (error && !record) {
    return (
      <div className="px-4 py-4">
        <p className="rounded-lg bg-violation-container px-3 py-2 text-sm text-violation">
          {error}
        </p>
        <Link href="/history" className="mt-3 inline-block text-sm font-semibold">
          Back to history
        </Link>
      </div>
    );
  }

  if (!record || !payload) {
    return <p className="px-4 py-4 text-sm text-on-surface-variant">Loading scan…</p>;
  }

  const summary = payload.compliance_summary;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <Link
        href="/history"
        className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant"
      >
        <ArrowLeftIcon width={16} height={16} /> History
      </Link>

      <section className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-caps text-on-surface-variant">{record.id}</p>
            <h1 className="text-xl font-bold text-on-surface">{record.product_name}</h1>
            <p className="text-sm text-on-surface-variant">
              Seller:{" "}
              <Link
                href={`/history?seller=${encodeURIComponent(record.seller_name)}`}
                className="font-semibold underline"
              >
                {record.seller_name}
              </Link>
            </p>
            <p className="text-xs text-on-surface-variant">
              {new Date(record.created_at).toLocaleString()} · score {record.score}
            </p>
          </div>
          <StatusChip status={record.overall_status} />
        </div>
      </section>

      {imageUrl && (
        <BoundingBoxOverlay imageUrl={imageUrl} boxes={overlayBoxes} />
      )}

      <DeclarationsPanel structuredFields={payload.structured_fields} />

      {payload.font_analysis && (
        <FontAnalysisPanel analysis={payload.font_analysis} />
      )}

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant px-4 py-3">
          <h2 className="text-base font-bold text-on-surface">Rule Checklist</h2>
          <p className="text-xs text-on-surface-variant">
            {summary.compliant_count} compliant · {summary.review_count} review ·{" "}
            {summary.violations_count} violations
          </p>
        </div>
        <ul className="divide-y divide-outline-variant">
          {FIELD_ORDER.filter((f) => payload.compliance_results[f]).map((field) => {
            const result = payload.compliance_results[field];
            return (
              <li key={field} className={`border-l-4 ${statusBorderColor(result.status)}`}>
                <details className="group" open={result.status !== "COMPLIANT"}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-on-surface">
                        {FIELD_LABELS[field] ?? field}
                      </p>
                      <p className="text-xs text-on-surface-variant">{result.rule_reference}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip status={result.status} size="sm" />
                      <ChevronDownIcon
                        width={16}
                        height={16}
                        className="text-on-surface-variant group-open:rotate-180"
                      />
                    </div>
                  </summary>
                  <div className="px-4 pb-4 text-sm text-on-surface-variant">
                    <p className="mb-1 font-semibold text-on-surface">{result.rule_description}</p>
                    <p>{result.findings}</p>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      {error && (
        <p className="rounded-lg bg-violation-container px-3 py-2 text-sm text-violation">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setCompareModalOpen(true)}
          className="flex-1 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary hover:opacity-90"
        >
          Compare vs. Marketplace Listing →
        </button>
        <button
          type="button"
          disabled={!imageUrl || exporting !== null}
          onClick={() => handleExport("pdf")}
          className="flex-1 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-60"
        >
          {exporting === "pdf" ? "Exporting…" : "Export PDF"}
        </button>
        <button
          type="button"
          disabled={!imageUrl || exporting !== null}
          onClick={() => handleExport("docx")}
          className="flex-1 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-60"
        >
          {exporting === "docx" ? "Exporting…" : "Export DOCX"}
        </button>
      </div>

      <MismatchComparisonModal
        isOpen={compareModalOpen}
        scanId={record.id}
        productName={record.product_name}
        onClose={() => setCompareModalOpen(false)}
      />
    </div>
  );
}
