"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CameraIcon, AssistantIcon, ChevronRightIcon } from "@/components/icons";
import Avatar from "@/components/Avatar";
import {
  fetchDashboardSummary,
  ApiError,
  type DashboardSummary,
  type ComplianceStatus,
} from "@/lib/api";

const RECENT_STATUS_DOT: Record<ComplianceStatus, string> = {
  COMPLIANT: "bg-compliant",
  NEEDS_REVIEW: "bg-review",
  NON_COMPLIANT: "bg-violation",
};

const RECENT_STATUS_LABEL: Record<ComplianceStatus, string> = {
  COMPLIANT: "Verified",
  NEEDS_REVIEW: "Review",
  NON_COMPLIANT: "Flagged",
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
}

// F2 fix: Time-aware greeting
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [greeting] = useState(getGreeting);

  useEffect(() => {
    fetchDashboardSummary()
      .then(setData)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load dashboard. Is the backend running?"
        )
      );
  }, []);

  const stats = data ?? {
    scanned_today: 0,
    open_cases: 0,
    high_risk_queue: 0,
    recent: [],
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low p-4">
        <div className="relative z-10 max-w-[62%]">
          <h1 className="text-2xl font-bold leading-tight text-on-surface">
            {greeting}, Officer.
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            System ready for field diagnostics and compliance reporting.
          </p>
          <Link
            href="/scan"
            className="mt-4 inline-block rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary"
          >
            ▶ Begin Shift
          </Link>
        </div>
        <Avatar
          state="welcome"
          priority
          className="pointer-events-none absolute -bottom-6 -right-6 h-44 w-auto object-contain"
        />
      </section>

      <Link
        href="/scan"
        className="flex items-center gap-3 rounded-xl bg-primary-container px-4 py-4 text-on-primary"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
          <CameraIcon />
        </span>
        <span>
          <span className="block text-base font-bold">Scan Product</span>
          <span className="label-caps text-white/70">Launch Diagnostic Lens</span>
        </span>
      </Link>

      <Link
        href="/assistant"
        className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-4"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high">
          <AssistantIcon />
        </span>
        <span>
          <span className="block text-base font-bold text-on-surface">Ask METRA</span>
          <span className="label-caps text-on-surface-variant">Query Compliance Database</span>
        </span>
      </Link>

      {error && (
        <p className="rounded-lg bg-violation-container px-3 py-2 text-sm text-violation">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <StatCard
          label="Products Scanned Today"
          value={stats.scanned_today}
          accent="border-l-secondary"
          valueClass="text-secondary"
        />
        <StatCard
          label="Open Cases"
          value={stats.open_cases}
          accent="border-l-primary-container"
        />
        <StatCard
          label="High-Risk Queue"
          value={stats.high_risk_queue}
          accent="border-l-review"
          valueClass="text-review"
        />
      </div>

      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
          <h2 className="text-base font-bold text-on-surface">Recent Scans</h2>
          <Link
            href="/history"
            className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant"
          >
            View All Log <ChevronRightIcon width={14} height={14} />
          </Link>
        </div>
        {stats.recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-on-surface-variant">
            No inspections yet. Scan a product to start the history log.
          </p>
        ) : (
          <ul>
            {stats.recent.map((scan) => (
              <li key={scan.id} className="border-b border-outline-variant last:border-b-0">
                <Link
                  href={`/history/${encodeURIComponent(scan.id)}`}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-on-surface">{scan.product_name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {scan.id} · {scan.seller_name} · {formatWhen(scan.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span
                      className={`h-2 w-2 rounded-full ${RECENT_STATUS_DOT[scan.overall_status]}`}
                    />
                    <span
                      className={
                        scan.overall_status === "COMPLIANT"
                          ? "text-compliant"
                          : scan.overall_status === "NEEDS_REVIEW"
                            ? "text-review"
                            : "text-violation"
                      }
                    >
                      {RECENT_STATUS_LABEL[scan.overall_status]}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  valueClass = "text-on-surface",
}: {
  label: string;
  value: number;
  accent: string;
  valueClass?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-outline-variant border-l-4 bg-surface-container-lowest px-4 py-3 ${accent}`}
    >
      <p className="label-caps text-on-surface-variant">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
