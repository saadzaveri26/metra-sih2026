"use client";

import { useState } from "react";
import type { StructuredFields } from "@/lib/api";
import { FIELD_LABELS, FIELD_ORDER } from "@/lib/fields";
import { ChevronDownIcon, EditIcon } from "@/components/icons";

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
  highlighted,
  onSelect,
  onEdit,
}: {
  field: string;
  data: StructuredFields[string];
  highlighted?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const detected = data.value != null || data.officer_override != null;
  const label = FIELD_LABELS[field] ?? field;
  const override = data.officer_override;

  return (
    <li
      className={`border-b border-outline-variant last:border-b-0 transition-colors ${
        highlighted ? "bg-surface-container" : ""
      }`}
    >
      <div className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            onSelect?.();
          }}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-on-surface">{label}</p>
            {override && (
              <span className="rounded bg-primary-container/20 px-1.5 py-0.5 text-[10px] font-bold text-primary-container">
                Officer Override
              </span>
            )}
          </div>
          {override ? (
            <div className="mt-0.5">
              <p className="text-xs font-semibold text-on-surface">
                {override.value}{" "}
                <span className="text-[10px] font-normal text-on-surface-variant">
                  (Authoritative)
                </span>
              </p>
              {data.value && (
                <p className="text-[11px] text-on-surface-variant line-through opacity-70">
                  AI: {data.value}
                </p>
              )}
            </div>
          ) : detected ? (
            <p className="mt-0.5 truncate text-xs text-on-surface-variant">
              {data.value}
            </p>
          ) : (
            <span className="mt-0.5 inline-block rounded-full bg-violation-container px-2 py-0.5 text-[11px] font-semibold text-violation">
              Not detected
            </span>
          )}
          {detected && !override && (
            <div className="mt-1.5">
              <ConfidenceBar confidence={data.confidence} />
            </div>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {onEdit && (
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
          )}
          {detected && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="p-1 text-on-surface-variant"
            >
              <ChevronDownIcon
                width={15}
                height={15}
                className={`transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {detected && open && (
        <div className="px-4 pb-3 text-xs text-on-surface-variant space-y-1">
          {override && (
            <div className="rounded-lg bg-surface-container p-2 text-[11px]">
              <p className="font-semibold text-on-surface">Override Audit Trail</p>
              <p>
                <span className="font-medium">Value:</span> {override.value}
              </p>
              {override.reason && (
                <p>
                  <span className="font-medium">Reason:</span> {override.reason}
                </p>
              )}
              <p>
                <span className="font-medium">Updated:</span>{" "}
                {new Date(override.updated_at).toLocaleString()}
              </p>
            </div>
          )}
          {data.raw_match && data.raw_match !== data.value && (
            <p className="rounded-lg bg-surface-container px-3 py-1.5 text-[11px]">
              <span className="font-semibold">Raw OCR: </span>
              {data.raw_match}
            </p>
          )}
          <p className="text-[11px]">
            <span className="font-semibold">AI Confidence: </span>
            {data.confidence != null
              ? `${(data.confidence * 100).toFixed(1)}%`
              : "—"}
          </p>
          {data.source_block_index != null && (
            <p className="text-[11px]">
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
  activeField,
  onSelectField,
  onEditField,
}: {
  structuredFields: StructuredFields;
  activeField?: string | null;
  onSelectField?: (field: string | null) => void;
  onEditField?: (field: string) => void;
}) {
  const [open, setOpen] = useState(true);

  const detectedCount = Object.values(structuredFields).filter(
    (f) => f.value != null || f.officer_override != null
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
                highlighted={activeField === field}
                onSelect={() =>
                  onSelectField?.(activeField === field ? null : field)
                }
                onEdit={() => onEditField?.(field)}
              />
            )
          )}
        </ul>
      )}
    </section>
  );
}
