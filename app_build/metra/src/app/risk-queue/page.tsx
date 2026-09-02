"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchRiskQueue,
  ApiError,
  type RiskQueueSeller,
} from "@/lib/api";

type RiskLevel = "critical" | "elevated" | "routine";

const LEVEL_STYLES: Record<
  RiskLevel,
  { border: string; badgeBg: string; badgeFg: string; label: string }
> = {
  critical: {
    border: "border-l-violation",
    badgeBg: "bg-violation-container",
    badgeFg: "text-violation",
    label: "Critical Risk",
  },
  elevated: {
    border: "border-l-review",
    badgeBg: "bg-review-container",
    badgeFg: "text-review",
    label: "Elevated Risk",
  },
  routine: {
    border: "border-l-outline-variant",
    badgeBg: "bg-surface-container-high",
    badgeFg: "text-on-surface-variant",
    label: "Routine",
  },
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RiskQueuePage() {
  const [sellers, setSellers] = useState<RiskQueueSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRiskQueue()
      .then(setSellers)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load risk queue. Is the backend running?"
        )
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <h1 className="text-xl font-bold text-on-surface">Risk Prioritization Queue</h1>
      <p className="text-xs text-on-surface-variant">
        Live seller risk scores aggregated from inspection history. Higher score = higher risk.
      </p>

      {error && (
        <p className="rounded-lg bg-violation-container px-3 py-2 text-sm text-violation">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-container border-t-transparent" />
          <p className="text-sm font-medium">Aggregating seller risk data…</p>
        </div>
      )}

      {!loading && sellers.length === 0 && !error && (
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center">
          <p className="text-sm text-on-surface-variant">
            No inspection records yet. Scan products to start building the risk queue.
          </p>
        </div>
      )}

      {sellers.map((seller) => {
        const s = LEVEL_STYLES[seller.risk_level];
        return (
          <article
            key={seller.seller_name}
            className={`rounded-xl border border-outline-variant border-l-4 bg-surface-container-lowest p-4 ${s.border}`}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <span className={`label-caps rounded px-2 py-0.5 ${s.badgeBg} ${s.badgeFg}`}>
                {s.label}
              </span>
              <span className={`rounded px-2 py-0.5 text-sm font-bold ${s.badgeBg} ${s.badgeFg}`}>
                {seller.risk_score}
              </span>
            </div>
            <h2 className="text-lg font-bold leading-snug text-on-surface">
              {seller.seller_name}
            </h2>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              {seller.total_scans} scans · {seller.violations} violations · {seller.reviews} reviews · {seller.compliant} compliant
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Last scanned: {formatWhen(seller.last_scan)}
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/sellers/${encodeURIComponent(seller.seller_name)}`}
                className="rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90"
              >
                View Trust Profile →
              </Link>
              <Link
                href={`/history?seller=${encodeURIComponent(seller.seller_name)}`}
                className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Inspection Log
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
