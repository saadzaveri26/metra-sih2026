"use client";

import { useState } from "react";
import type { StructuredFields } from "@/lib/api";
import { FIELD_LABELS, FIELD_ORDER } from "@/lib/fields";
import { ChevronDownIcon } from "@/components/icons";

function ConfidenceBar({ confidence }: { confidence: number | null }) {
  const pct = confidence != null ? Math.round(confidence * 100) : 0;
  const color =
    pct >= 80
      ? "bg-compliant"
      : pct >= 55
        ? "bg-review"
        : "bg-violation";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-[11px] font-semibold tabular-nums text-on-surface-variant">
        {pct}%
      </span>
    </div>
  );
}

function DeclarationRow({
  field,
  data,
}: {
  field: string;
  data: StructuredFields[string];
}) {
  const [open, setOpen] = useState(false);
  const detected = data.value != null;
  const label = FIELD_LABELS[field] ?? field;

  return (
    <li className="border-b border-outline-variant last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface">{label}</p>
          {detected ? (
            <p className="mt-0.5 truncate text-xs text-on-surface-variant">
              {data.value}
            </p>
          ) : (
            <span className="mt-0.5 inline-block rounded-full bg-violation-container px-2 py-0.5 text-[11px] font-semibold text-violation">
              Not detected
            </span>
          )}
          {detected && (
            <div className="mt-1.5">
              <ConfidenceBar confidence={data.confidence} />
            </div>
          )}
        </div>
        {detected && (
          <ChevronDownIcon
            width={15}
            height={15}
            className={`mt-0.5 shrink-0 text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {detected && open && (
        <div className="px-4 pb-3">
          {data.raw_match && data.raw_match !== data.value && (
            <p className="mb-1.5 rounded-lg bg-surface-container px-3 py-2 text-[11px] text-on-surface-variant">
              <span className="font-semibold">Raw OCR: </span>
              {data.raw_match}
            </p>
          )}
          <p className="text-[11px] text-on-surface-variant">
            <span className="font-semibold">Confidence: </span>
            {data.confidence != null
              ? `${(data.confidence * 100).toFixed(1)}%`
              : "—"}
          </p>
          {data.source_block_index != null && (
            <p className="text-[11px] text-on-surface-variant">
              <span className="font-semibold">OCR block: </span>#
              {data.source_block_index}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export default function DeclarationsPanel({
  structuredFields,
}: {
  structuredFields: StructuredFields;
}) {
  const [open, setOpen] = useState(true);

  const detectedCount = Object.values(structuredFields).filter(
    (f) => f.value != null
  ).length;
  const totalCount = Object.keys(structuredFields).length;

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-outline-variant px-4 py-3"
      >
        <div>
          <h2 className="text-base font-bold text-on-surface text-left">
            Extracted Declarations
          </h2>
          <p className="label-caps text-on-surface-variant text-left">
            {detectedCount} of {totalCount} fields detected
          </p>
        </div>
        <ChevronDownIcon
          width={18}
          height={18}
          className={`text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul>
          {FIELD_ORDER.filter((f) => structuredFields[f] !== undefined).map(
            (field) => (
              <DeclarationRow
                key={field}
                field={field}
                data={structuredFields[field]}
              />
            )
          )}
        </ul>
      )}
    </section>
  );
}
