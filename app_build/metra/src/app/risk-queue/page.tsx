// TODO(Phase 11): replace with a real GET /risk-queue call once seller-level
// violation aggregation + trust scoring exists. Static reference data for now.

type RiskLevel = "critical" | "elevated" | "routine";

type RiskItem = {
  id: string;
  title: string;
  seller: string;
  description: string;
  score: number;
  level: RiskLevel;
};

const RISK_ITEMS: RiskItem[] = [
  {
    id: "1",
    title: "Industrial Scale Tampering",
    seller: "Apex Logistics Corp.",
    description:
      "Repeated calibration failures reported over 3 consecutive quarters. Evidence suggests intentional bypass of security seals on model TX-200.",
    score: 92,
    level: "critical",
  },
  {
    id: "2",
    title: "Volume Discrepancy — Retail Liquids",
    seller: "Oasis Beverages",
    description: "Declared net quantity does not match sampled measurement.",
    score: 64,
    level: "elevated",
  },
  {
    id: "3",
    title: "Routine Calibration Check",
    seller: "Metro Health Supplies",
    description: "Scheduled periodic recheck, no prior violations on file.",
    score: 28,
    level: "routine",
  },
];

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

export default function RiskQueuePage() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <h1 className="text-xl font-bold text-on-surface">Risk Prioritization Queue</h1>

      {RISK_ITEMS.map((item) => {
        const s = LEVEL_STYLES[item.level];
        return (
          <article
            key={item.id}
            className={`rounded-xl border border-outline-variant border-l-4 bg-surface-container-lowest p-4 ${s.border}`}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <span className={`label-caps rounded px-2 py-0.5 ${s.badgeBg} ${s.badgeFg}`}>
                {s.label}
              </span>
              <span className={`rounded px-2 py-0.5 text-sm font-bold ${s.badgeBg} ${s.badgeFg}`}>
                {item.score}
              </span>
            </div>
            <h2 className="text-lg font-bold leading-snug text-on-surface">{item.title}</h2>
            <p className="mt-0.5 text-sm text-on-surface-variant">Seller: {item.seller}</p>
            <p className="mt-2 text-sm text-on-surface-variant">{item.description}</p>
            {item.level === "critical" && (
              <button
                type="button"
                className="mt-3 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary"
              >
                Initiate Review
              </button>
            )}
          </article>
        );
      })}

      <p className="px-1 text-center text-[11px] text-on-surface-variant">
        Placeholder data — wire this up once seller trust scoring (Phase 11) exists.
      </p>
    </div>
  );
}
