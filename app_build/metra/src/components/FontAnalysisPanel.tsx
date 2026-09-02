"use client";

import { useState } from "react";
import type { FontAnalysis, FontStatus } from "@/lib/api";
import { FIELD_LABELS, FIELD_ORDER } from "@/lib/fields";
import { ChevronDownIcon } from "@/components/icons";

function FontChip({ status }: { status: FontStatus }) {
  const map: Record<FontStatus, { bg: string; fg: string; label: string }> = {
    COMPLIANT: { bg: "bg-compliant-container", fg: "text-compliant", label: "OK" },
    NEEDS_REVIEW: { bg: "bg-review-container", fg: "text-review", label: "Review" },
    NON_COMPLIANT: { bg: "bg-violation-container", fg: "text-violation", label: "Too small" },
    NOT_MEASURED: { bg: "bg-surface-container-high", fg: "text-on-surface-variant", label: "Not measured" },
  };
  const s = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.bg} ${s.fg}`}>
      {s.label}
    </span>
  );
}

export default function FontAnalysisPanel({ analysis }: { analysis: FontAnalysis }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <h2 className="text-base font-bold text-on-surface">Font size & readability</h2>
          <p className="label-caps text-on-surface-variant">
            Rule 7 · {analysis.violations_count} too small · {analysis.review_count} review
          </p>
        </div>
        <ChevronDownIcon
          width={18}
          height={18}
          className={`text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-outline-variant">
          <p className="px-4 pt-3 text-xs text-on-surface-variant">
            {analysis.rule_description} Measured from OCR box height at{" "}
            <span className="font-semibold">{analysis.dpi} DPI</span> ({analysis.dpi_source}
            {analysis.dpi_source === "assumed" ? " — confirm on package" : ""}). Numeral minimum for
            this panel: {analysis.numeral_min_height_mm.toFixed(1)} mm. Missing declarations are not
            counted as font violations.
          </p>
          <ul className="mt-2 divide-y divide-outline-variant">
            {FIELD_ORDER.filter((f) => analysis.fields[f]).map((field) => {
              const row = analysis.fields[field];
              return (
                <li key={field} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {FIELD_LABELS[field] ?? field}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {row.height_mm != null
                          ? `${row.height_mm.toFixed(2)} mm vs ${row.min_required_mm.toFixed(1)} mm min`
                          : "No region to measure"}
                      </p>
                    </div>
                    <FontChip status={row.status} />
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">{row.findings}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
