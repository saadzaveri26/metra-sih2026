import { CheckCircleIcon, AlertCircleIcon, XCircleIcon } from "./icons";
import type { ComplianceStatus } from "@/lib/api";

const STYLES: Record<
  ComplianceStatus,
  { bg: string; fg: string; label: string; Icon: typeof CheckCircleIcon }
> = {
  COMPLIANT: {
    bg: "bg-compliant-container",
    fg: "text-compliant",
    label: "Compliant",
    Icon: CheckCircleIcon,
  },
  NEEDS_REVIEW: {
    bg: "bg-review-container",
    fg: "text-review",
    label: "Needs Review",
    Icon: AlertCircleIcon,
  },
  NON_COMPLIANT: {
    bg: "bg-violation-container",
    fg: "text-violation",
    label: "Violation",
    Icon: XCircleIcon,
  },
};

export default function StatusChip({
  status,
  size = "md",
}: {
  status: ComplianceStatus;
  size?: "sm" | "md";
}) {
  const s = STYLES[status];
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${s.bg} ${s.fg} ${pad}`}
    >
      <s.Icon width={14} height={14} strokeWidth={2.5} />
      {s.label}
    </span>
  );
}

export function statusBorderColor(status: ComplianceStatus) {
  switch (status) {
    case "COMPLIANT":
      return "border-l-compliant";
    case "NEEDS_REVIEW":
      return "border-l-review";
    case "NON_COMPLIANT":
      return "border-l-violation";
  }
}
