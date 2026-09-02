import Link from "next/link";
import { CameraIcon, AssistantIcon, ChevronRightIcon } from "@/components/icons";
import Avatar from "@/components/Avatar";

// TODO(Phase 8 & 10): replace with a real GET /dashboard/summary call once
// scan persistence exists. Hardcoded for now so the screen has something to show.
const MOCK_STATS = {
  scannedToday: 24,
  openCases: 12,
  highRiskQueue: 5,
};

const MOCK_RECENT_SCANS = [
  { id: "TX-992-B", name: "Precision Scale Unit", time: "10:42 AM", status: "COMPLIANT" as const },
  { id: "FP-004-Z", name: "Dispenser Unit", time: "09:15 AM", status: "NEEDS_REVIEW" as const },
  { id: "RT-118-A", name: "Retail Scanner Head", time: "08:50 AM", status: "NON_COMPLIANT" as const },
];

const RECENT_STATUS_DOT: Record<string, string> = {
  COMPLIANT: "bg-compliant",
  NEEDS_REVIEW: "bg-review",
  NON_COMPLIANT: "bg-violation",
};

const RECENT_STATUS_LABEL: Record<string, string> = {
  COMPLIANT: "Verified",
  NEEDS_REVIEW: "Review",
  NON_COMPLIANT: "Flagged",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Welcome card */}
      <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low p-4">
        <div className="relative z-10 max-w-[62%]">
          <h1 className="text-2xl font-bold leading-tight text-on-surface">
            Good morning, Officer.
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            System ready for field diagnostics and compliance reporting.
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary"
          >
            ▶ Begin Shift
          </button>
        </div>
        <Avatar
          state="welcome"
          priority
          className="pointer-events-none absolute -bottom-6 -right-6 h-44 w-auto object-contain"
        />
      </section>

      {/* Primary actions */}
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

      {/* Stat cards */}
      <div className="flex flex-col gap-3">
        <StatCard label="Products Scanned Today" value={MOCK_STATS.scannedToday} accent="border-l-secondary" valueClass="text-secondary" />
        <StatCard label="Open Cases" value={MOCK_STATS.openCases} accent="border-l-primary-container" />
        <StatCard label="High-Risk Queue" value={MOCK_STATS.highRiskQueue} accent="border-l-review" valueClass="text-review" />
      </div>

      {/* Recent scans */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
          <h2 className="text-base font-bold text-on-surface">Recent Scans</h2>
          <Link href="/risk-queue" className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant">
            View All Log <ChevronRightIcon width={14} height={14} />
          </Link>
        </div>
        <ul>
          {MOCK_RECENT_SCANS.map((scan) => (
            <li
              key={scan.id}
              className="flex items-center justify-between border-b border-outline-variant px-4 py-3 last:border-b-0"
            >
              <div>
                <p className="text-sm font-bold text-on-surface">{scan.name}</p>
                <p className="text-xs text-on-surface-variant">
                  ID: {scan.id} &middot; {scan.time}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className={`h-2 w-2 rounded-full ${RECENT_STATUS_DOT[scan.status]}`} />
                <span
                  className={
                    scan.status === "COMPLIANT"
                      ? "text-compliant"
                      : scan.status === "NEEDS_REVIEW"
                        ? "text-review"
                        : "text-violation"
                  }
                >
                  {RECENT_STATUS_LABEL[scan.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="px-1 text-center text-[11px] text-on-surface-variant">
        Stats and recent scans above are placeholder data until scan history
        persistence (Phase 8) is built.
      </p>
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
