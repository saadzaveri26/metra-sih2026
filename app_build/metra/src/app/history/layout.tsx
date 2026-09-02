import { Suspense } from "react";

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <p className="px-4 py-4 text-sm text-on-surface-variant">Loading history…</p>
      }
    >
      {children}
    </Suspense>
  );
}
