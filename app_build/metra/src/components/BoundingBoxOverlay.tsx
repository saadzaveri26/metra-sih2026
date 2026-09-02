"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  // Calculate transform origin & scale for smooth pan/zoom to active field
  const zoomStyle = useMemo<React.CSSProperties>(() => {
    if (!active || !natural || !active.points || active.points.length === 0) {
      return {
        transition:
          "transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), transform-origin 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)",
        transform: "scale(1)",
        transformOrigin: "50% 50%",
      };
    }

    const xs = active.points.map((p) => p[0]);
    const ys = active.points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const originX = Math.min(Math.max((centerX / natural.w) * 100, 5), 95);
    const originY = Math.min(Math.max((centerY / natural.h) * 100, 5), 95);

    const boxW = Math.max(maxX - minX, 10);
    const boxH = Math.max(maxY - minY, 10);

    const scaleX = natural.w / (boxW * 2.4);
    const scaleY = natural.h / (boxH * 2.4);
    const targetScale = Math.min(Math.max(Math.min(scaleX, scaleY), 1.6), 2.6);

    return {
      transition:
        "transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), transform-origin 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)",
      transform: `scale(${targetScale.toFixed(2)})`,
      transformOrigin: `${originX.toFixed(2)}% ${originY.toFixed(2)}%`,
    };
  }, [active, natural]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-surface-container-high select-none"
      onClick={() => onSelectField?.(null)}
    >
      <div style={zoomStyle} className="relative w-full h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Scanned product label"
          className="block w-full h-auto pointer-events-none"
          onLoad={(e) =>
            setNatural({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            })
          }
        />
        {natural && boxes.length > 0 && (
          <svg
            className="absolute inset-0 h-full w-full pointer-events-auto"
            viewBox={`0 0 ${natural.w} ${natural.h}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {boxes.map((box, i) => {
              const color = STROKE[box.status];
              const pointsAttr = box.points.map((p) => p.join(",")).join(" ");
              const xs = box.points.map((p) => p[0]);
              const ys = box.points.map((p) => p[1]);
              const minX = Math.min(...xs);
              const minY = Math.min(...ys);
              const fontSize = Math.max(natural.w * 0.018, 14);
              const selected = activeField === box.field;
              const dashed = box.kind === "candidate" || box.kind === "missing";
              const isAnySelected = activeField != null;
              const opacity = !isAnySelected ? 1 : selected ? 1 : 0.25;

              const label =
                box.kind === "missing"
                  ? `${FIELD_LABELS[box.field] ?? box.field} (missing)`
                  : box.kind === "candidate"
                    ? `${FIELD_LABELS[box.field] ?? box.field} (nearest)`
                    : (FIELD_LABELS[box.field] ?? box.field);
              return (
                <g
                  key={`${box.field}-${i}`}
                  className="cursor-pointer transition-opacity duration-300"
                  style={{ opacity }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectField?.(selected ? null : box.field);
                  }}
                >
                  {/* Outer pulse ring for selected box */}
                  {selected && (
                    <polygon
                      points={pointsAttr}
                      fill="none"
                      stroke={color}
                      strokeWidth={Math.max(natural.w * 0.012, 6)}
                      opacity={0.35}
                    />
                  )}
                  <polygon
                    points={pointsAttr}
                    fill={`${color}${selected ? "55" : "22"}`}
                    stroke={color}
                    strokeWidth={
                      selected
                        ? Math.max(natural.w * 0.006, 3.5)
                        : Math.max(natural.w * 0.003, 2)
                    }
                    strokeDasharray={
                      dashed
                        ? `${Math.max(natural.w * 0.01, 6)} ${Math.max(natural.w * 0.006, 4)}`
                        : undefined
                    }
                    className={selected ? "animate-pulse" : undefined}
                  />
                  <text
                    x={minX}
                    y={Math.max(minY - fontSize * 0.4, fontSize)}
                    fontSize={fontSize}
                    fontWeight={700}
                    fill={color}
                    stroke="white"
                    strokeWidth={fontSize * 0.18}
                    paintOrder="stroke"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Floating control buttons */}
      {active && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectField?.(null);
            }}
            className="rounded-full bg-surface-container-lowest/90 px-2.5 py-1 text-xs font-semibold text-on-surface shadow backdrop-blur-sm hover:bg-surface-container"
          >
            Reset View ✕
          </button>
        </div>
      )}

      {active && (
        <div
          className="absolute inset-x-2 bottom-2 z-20 rounded-lg border border-outline-variant bg-surface-container-lowest/95 p-3 shadow-md backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-on-surface">
              {FIELD_LABELS[active.field] ?? active.field}
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-on-surface-variant hover:text-on-surface"
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
