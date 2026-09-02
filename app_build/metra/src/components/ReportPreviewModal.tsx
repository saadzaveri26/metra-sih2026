"use client";

import { useEffect, useState } from "react";
import {
  generateReportBlob,
  type ScanResponse,
  type ReportFormat,
  downloadInspectionReport,
} from "@/lib/api";

export default function ReportPreviewModal({
  isOpen,
  file,
  scan,
  onClose,
}: {
  isOpen: boolean;
  file: File | null;
  scan: ScanResponse;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<ReportFormat | null>(null);

  useEffect(() => {
    let currentUrl: string | null = null;

    async function loadPreview() {
      if (!isOpen || !file) return;
      setLoading(true);
      setError(null);
      try {
        const blob = await generateReportBlob(file, scan, "pdf");
        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      } catch (err: any) {
        setError(err?.message ?? "Failed to render PDF preview");
      } finally {
        setLoading(false);
      }
    }

    loadPreview();

    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [isOpen, file, scan]);

  if (!isOpen) return null;

  async function handleDownload(format: ReportFormat) {
    if (!file) return;
    setDownloading(format);
    try {
      await downloadInspectionReport(file, scan, format);
    } catch (err: any) {
      setError(err?.message ?? `Failed to download ${format.toUpperCase()}`);
    } finally {
      setDownloading(null);
    }
  }

  const overridesCount = Object.keys(scan.officer_overrides ?? {}).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-full max-w-5xl flex-col rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3 bg-surface-container-low">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-on-surface">
                Legal Metrology Inspection Report
              </h3>
              <span className="rounded bg-primary-container/20 px-2 py-0.5 text-[11px] font-semibold text-primary-container">
                PDF Preview
              </span>
              {overridesCount > 0 && (
                <span className="rounded bg-compliant/20 px-2 py-0.5 text-[11px] font-semibold text-compliant">
                  {overridesCount} Officer {overridesCount === 1 ? "Override" : "Overrides"} Applied
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant">
              Generated directly from statutory PCR 2011 compliance assessment rules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={downloading !== null}
              onClick={() => handleDownload("pdf")}
              className="rounded-lg bg-primary-container px-3.5 py-1.5 text-xs font-semibold text-on-primary hover:opacity-90 disabled:opacity-50"
            >
              {downloading === "pdf" ? "Downloading PDF…" : "Download PDF"}
            </button>
            <button
              type="button"
              disabled={downloading !== null}
              onClick={() => handleDownload("docx")}
              className="rounded-lg border border-outline-variant px-3.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50"
            >
              {downloading === "docx" ? "Downloading DOCX…" : "Download DOCX"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              title="Close preview"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content viewer */}
        <div className="relative flex-1 bg-surface-container-high p-2">
          {loading && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-on-surface-variant">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-container border-t-transparent" />
              <p className="text-sm font-medium">Generating ReportLab statutory PDF…</p>
            </div>
          )}

          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm font-semibold text-violation">{error}</p>
              <button
                type="button"
                onClick={() => handleDownload("pdf")}
                className="rounded-lg bg-primary-container px-4 py-2 text-xs font-semibold text-on-primary"
              >
                Attempt Direct PDF Download
              </button>
            </div>
          )}

          {!loading && !error && blobUrl && (
            <div className="h-full w-full rounded-lg overflow-hidden bg-white shadow-inner">
              <object
                data={`${blobUrl}#toolbar=1&navpanes=0`}
                type="application/pdf"
                className="h-full w-full"
              >
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                  <p className="text-sm text-on-surface">
                    Your browser does not support inline PDF display.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDownload("pdf")}
                    className="rounded-lg bg-primary-container px-4 py-2 text-xs font-semibold text-on-primary"
                  >
                    Download PDF Report
                  </button>
                </div>
              </object>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
