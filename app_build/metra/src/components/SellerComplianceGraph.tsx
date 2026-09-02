"use client";

import type { SellerComplianceHistory } from "@/lib/api";
import Link from "next/link";

export default function SellerComplianceGraph({
  data,
}: {
  data: SellerComplianceHistory;
}) {
  const {
    seller_name,
    trust_score,
    risk_level,
    risk_label,
    total_scans,
    compliant_count,
    review_count,
    violations_count,
    repeat_violation_count,
    repeat_clauses,
    score_breakdown,
    monthly_trend,
    chronological_violations,
  } = data;

  const scoreColor =
    risk_level === "LOW_RISK"
      ? "text-compliant"
      : risk_level === "MODERATE_RISK"
        ? "text-review"
        : "text-violation";

  const scoreBg =
    risk_level === "LOW_RISK"
      ? "bg-compliant-container/20 border-compliant/30"
      : risk_level === "MODERATE_RISK"
        ? "bg-review-container/20 border-review/30"
        : "bg-violation-container/20 border-violation/30";

  // SVG Line Chart calculations for monthly trend
  const maxMonthlyVal = Math.max(
    ...monthly_trend.map((m) => Math.max(m.violations, m.compliant, m.total_scans)),
    5
  );

  const chartWidth = 500;
  const chartHeight = 160;
  const paddingX = 40;
  const paddingY = 25;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;

  const points = monthly_trend.map((m, idx) => {
    const x =
      monthly_trend.length <= 1
        ? paddingX + plotWidth / 2
        : paddingX + (idx / (monthly_trend.length - 1)) * plotWidth;
    const yV = paddingY + plotHeight - (m.violations / maxMonthlyVal) * plotHeight;
    const yC = paddingY + plotHeight - (m.compliant / maxMonthlyVal) * plotHeight;
    return { x, yV, yC, ...m };
  });

  const violationPolyline = points.map((p) => `${p.x},${p.yV}`).join(" ");
  const compliantPolyline = points.map((p) => `${p.x},${p.yC}`).join(" ");

  return (
    <div className="flex flex-col gap-5">
      {/* Header Profile Banner */}
      <section className={`rounded-xl border p-5 ${scoreBg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-on-surface">{seller_name}</h1>
              <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-on-surface">
                Entity Profile
              </span>
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">
              Aggregated Legal Metrology statutory compliance & repeat-offender risk tracking.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-surface-container-lowest/80 rounded-xl p-3 border border-outline-variant/60 backdrop-blur-xs">
            <div className="text-right">
              <p className="label-caps text-on-surface-variant">Trust Score</p>
              <div className="flex items-baseline justify-end gap-1">
                <span className={`text-3xl font-extrabold ${scoreColor}`}>{trust_score}</span>
                <span className="text-xs font-medium text-on-surface-variant">/100</span>
              </div>
            </div>
            <div className="border-l border-outline-variant pl-3">
              <span
                className={`inline-block rounded-md px-2 py-1 text-xs font-bold ${
                  risk_level === "LOW_RISK"
                    ? "bg-compliant text-white"
                    : risk_level === "MODERATE_RISK"
                      ? "bg-review text-white"
                      : "bg-violation text-white"
                }`}
              >
                {risk_label}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-surface-container-lowest/90 p-3 border border-outline-variant/40">
            <p className="label-caps text-on-surface-variant">Total Inspections</p>
            <p className="text-lg font-bold text-on-surface">{total_scans}</p>
          </div>
          <div className="rounded-lg bg-surface-container-lowest/90 p-3 border border-outline-variant/40">
            <p className="label-caps text-compliant">Compliant Scans</p>
            <p className="text-lg font-bold text-compliant">{compliant_count}</p>
          </div>
          <div className="rounded-lg bg-surface-container-lowest/90 p-3 border border-outline-variant/40">
            <p className="label-caps text-violation">Total Violations</p>
            <p className="text-lg font-bold text-violation">{violations_count}</p>
          </div>
          <div className="rounded-lg bg-surface-container-lowest/90 p-3 border border-outline-variant/40">
            <p className="label-caps text-review">Repeat Violations</p>
            <p className="text-lg font-bold text-review">{repeat_violation_count}</p>
          </div>
        </div>
      </section>

      {/* Trust Score Statutory Breakdown */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
        <h2 className="text-sm font-bold text-on-surface">
          Statutory Scoring Formula & Weight Rationale
        </h2>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          Per Section 36(1) escalation guidelines, repeat clauses carry escalated penalties.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-4 text-xs">
          <div className="rounded-lg bg-surface-container p-3">
            <p className="text-on-surface-variant font-medium">Base Starting Score</p>
            <p className="text-sm font-bold text-on-surface">100 pts</p>
          </div>
          <div className="rounded-lg bg-surface-container p-3">
            <p className="text-on-surface-variant font-medium">Base Violation Deductions</p>
            <p className="text-sm font-bold text-violation">
              -{score_breakdown.base_violation_deductions} pts
            </p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">8 pts × recency weight</p>
          </div>
          <div className="rounded-lg bg-surface-container p-3">
            <p className="text-on-surface-variant font-medium">Repeat Clause Surcharges</p>
            <p className="text-sm font-bold text-violation">
              -{score_breakdown.repeat_violation_surcharge} pts
            </p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              15 pts × repeat count (escalatory)
            </p>
          </div>
          <div className="rounded-lg bg-surface-container p-3">
            <p className="text-on-surface-variant font-medium">Compliance Credits</p>
            <p className="text-sm font-bold text-compliant">
              +{score_breakdown.compliant_credits} pts
            </p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              +4 pts per compliant inspection
            </p>
          </div>
        </div>

        {repeat_clauses.length > 0 && (
          <div className="mt-3 rounded-lg border border-violation/20 bg-violation-container/10 p-3">
            <p className="text-xs font-bold text-violation">
              ⚠️ Repeat Violations Detected ({repeat_clauses.length} distinct clauses):
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {repeat_clauses.map((c) => (
                <span
                  key={c.rule_reference}
                  className="rounded bg-violation/15 px-2 py-0.5 text-[11px] font-semibold text-violation"
                >
                  {c.rule_reference} ({c.times_violated}x repeat)
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Monthly Trend Chart */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-on-surface">Compliance Timeline Series</h2>
            <p className="text-xs text-on-surface-variant">
              Monthly distribution of compliant scans vs. rule violations.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-violation font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-violation" /> Violations
            </span>
            <span className="flex items-center gap-1.5 text-compliant font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-compliant" /> Compliant
            </span>
          </div>
        </div>

        {monthly_trend.length === 0 ? (
          <p className="py-8 text-center text-xs text-on-surface-variant">
            No inspection timeline records recorded for this seller yet.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 select-none"
            >
              {/* Horizontal grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = paddingY + plotHeight * (1 - ratio);
                return (
                  <g key={ratio}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={chartWidth - paddingX}
                      y2={y}
                      stroke="#c4c6cf"
                      strokeDasharray="2 4"
                      strokeWidth={0.8}
                    />
                    <text
                      x={paddingX - 6}
                      y={y + 3}
                      fontSize={8}
                      fill="#74777f"
                      textAnchor="end"
                    >
                      {Math.round(ratio * maxMonthlyVal)}
                    </text>
                  </g>
                );
              })}

              {/* Compliant Line */}
              <polyline
                fill="none"
                stroke="#1e8e3e"
                strokeWidth={2.5}
                points={compliantPolyline}
              />
              {/* Violation Line */}
              <polyline
                fill="none"
                stroke="#ba1a1a"
                strokeWidth={2.5}
                points={violationPolyline}
              />

              {/* Data points & X axis labels */}
              {points.map((p, idx) => (
                <g key={idx}>
                  {/* Compliant dot */}
                  <circle cx={p.x} cy={p.yC} r={4} fill="#1e8e3e" stroke="white" strokeWidth={1.5} />
                  {/* Violation dot */}
                  <circle cx={p.x} cy={p.yV} r={4} fill="#ba1a1a" stroke="white" strokeWidth={1.5} />
                  {/* Month label */}
                  <text
                    x={p.x}
                    y={chartHeight - 6}
                    fontSize={9}
                    fill="#44474e"
                    textAnchor="middle"
                    fontWeight={600}
                  >
                    {p.month}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </section>

      {/* Chronological Violation Record */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
        <div className="border-b border-outline-variant px-5 py-3">
          <h2 className="text-base font-bold text-on-surface">Chronological Violations Record</h2>
          <p className="text-xs text-on-surface-variant">
            Documented statutory non-compliance events logged for this entity.
          </p>
        </div>

        {chronological_violations.length === 0 ? (
          <div className="p-6 text-center text-xs text-compliant font-semibold">
            ✓ Zero statutory violations recorded for {seller_name}. Clean compliance record.
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {chronological_violations.map((v, idx) => (
              <li key={`${v.scan_id}-${idx}`} className="p-4 hover:bg-surface-container-low transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-on-surface">
                        {v.product_name || "Unknown Product"}
                      </span>
                      {v.is_repeat && (
                        <span className="rounded bg-violation px-2 py-0.5 text-[10px] font-bold text-white">
                          Repeat Violation #{v.repeat_count}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-violation">
                      {v.rule_reference}: {v.rule_description}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">{v.findings}</p>
                    {v.penalty_clause && (
                      <p className="mt-1.5 rounded bg-surface-container px-2.5 py-1 text-[11px] text-on-surface">
                        <span className="font-semibold">Penalty Clause: </span>
                        {v.penalty_clause}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-on-surface-variant">
                      {new Date(v.date).toLocaleDateString()}
                    </p>
                    <Link
                      href={`/history/${encodeURIComponent(v.scan_id)}`}
                      className="mt-1 inline-block text-xs font-semibold text-primary-container hover:underline"
                    >
                      View Scan {v.scan_id} →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
