"use client";

import { useEffect, useRef, useState } from "react";
import type { ComplianceStatus } from "@/lib/api";
import { FIELD_LABELS } from "@/lib/fields";

export type OverlayBox = {
  field: string;
  status: ComplianceStatus;
  points: number[][]; // 4-point polygon from PaddleOCR: [[x,y],[x,y],[x,y],[x,y]]
};

const STROKE: Record<ComplianceStatus, string> = {
  COMPLIANT: "#1e8e3e",
  NEEDS_REVIEW: "#b06f00",
  NON_COMPLIANT: "#ba1a1a",
};

export default function BoundingBoxOverlay({
  imageUrl,
  boxes,
}: {
  imageUrl: string;
  boxes: OverlayBox[];
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, [imageUrl]);

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
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${natural.w} ${natural.h}`}
          preserveAspectRatio="none"
        >
          {boxes.map((box, i) => {
            const color = STROKE[box.status];
            const pointsAttr = box.points.map((p) => p.join(",")).join(" ");
            const [x, y] = box.points[0];
            const fontSize = Math.max(natural.w * 0.018, 14);
            return (
              <g key={`${box.field}-${i}`}>
                <polygon
                  points={pointsAttr}
                  fill={`${color}22`}
                  stroke={color}
                  strokeWidth={Math.max(natural.w * 0.003, 2)}
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
                  {FIELD_LABELS[box.field] ?? box.field}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
