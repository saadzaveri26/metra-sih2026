"use client";

import { useEffect, useRef, useState } from "react";
import type { ComplianceStatus, OverlayKind } from "@/lib/api";
import { FIELD_LABELS } from "@/lib/fields";

export type OverlayBox = {
  field: string;
  status: ComplianceStatus;
  points: number[][]; // 4-point polygon from PaddleOCR: [[x,y],[x,y],[x,y],[x,y]]
  kind?: OverlayKind;
  rule_reference?: string;
  findings?: string;
};

const STROKE: Record<ComplianceStatus, string> = {
  COMPLIANT: "#1e8e3e",
  NEEDS_REVIEW: "#b06f00",
  NON_COMPLIANT: "#ba1a1a",
};

export default function BoundingBoxOverlay({
  imageUrl,
  boxes,
  activeField,
  onSelectField,
}: {
  imageUrl: string;
  boxes: OverlayBox[];
  activeField?: string | null;
  onSelectField?: (field: string | null) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, [imageUrl]);

  const active = boxes.find((b) => b.field === activeField) ?? null;

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-surface-container-high">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Scanned product label"
        className="block w-full"
        onLoad={(e) =>
          setNatural({
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          })
        }
      />
      {natural && boxes.length > 0 && (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${natural.w} ${natural.h}`}
          preserveAspectRatio="none"
        >
          {boxes.map((box, i) => {
            const color = STROKE[box.status];
            const pointsAttr = box.points.map((p) => p.join(",")).join(" ");
            const [x, y] = box.points[0];
            const fontSize = Math.max(natural.w * 0.018, 14);
            const selected = activeField === box.field;
            const dashed = box.kind === "candidate" || box.kind === "missing";
            const label =
              box.kind === "missing"
                ? `${FIELD_LABELS[box.field] ?? box.field} missing`
                : box.kind === "candidate"
                  ? `${FIELD_LABELS[box.field] ?? box.field} (nearest)`
                  : (FIELD_LABELS[box.field] ?? box.field);
            return (
              <g
                key={`${box.field}-${i}`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectField?.(selected ? null : box.field);
                }}
              >
                <polygon
                  points={pointsAttr}
                  fill={`${color}${selected ? "44" : "22"}`}
                  stroke={color}
                  strokeWidth={
                    selected
                      ? Math.max(natural.w * 0.005, 3)
                      : Math.max(natural.w * 0.003, 2)
                  }
                  strokeDasharray={
                    dashed ? `${Math.max(natural.w * 0.01, 6)} ${Math.max(natural.w * 0.006, 4)}` : undefined
                  }
                />
                <text
                  x={x}
                  y={Math.max(y - fontSize * 0.4, fontSize)}
                  fontSize={fontSize}
                  fontWeight={700}
                  fill={color}
                  stroke="white"
                  strokeWidth={fontSize * 0.15}
                  paintOrder="stroke"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {active && (
        <div className="absolute inset-x-2 bottom-2 rounded-lg border border-outline-variant bg-surface-container-lowest/95 p-3 shadow-md backdrop-blur-sm">
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-on-surface">
              {FIELD_LABELS[active.field] ?? active.field}
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-on-surface-variant"
              onClick={() => onSelectField?.(null)}
            >
              Close
            </button>
          </div>
          <p className="text-xs font-semibold text-on-surface-variant">
            {active.rule_reference}
            {active.kind === "candidate" ? " · nearest OCR region" : ""}
            {active.kind === "missing" ? " · not found on label" : ""}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">{active.findings}</p>
        </div>
      )}
    </div>
  );
}
