import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

/**
 * AppShell layout:
 * - Mobile  (<lg): TopBar at top, BottomNav at bottom, scrollable main between.
 * - Desktop (≥lg): Sidebar nav on left (rendered by BottomNav), main content on right.
 *                  TopBar is hidden. Max content width is capped to keep lines readable.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-surface">
      {/* Top bar — mobile only, rendered by TopBar itself via lg:hidden */}
      <TopBar />

      {/* Sidebar (desktop) / Bottom nav (mobile) — BottomNav handles both */}
      <BottomNav />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 lg:max-w-4xl lg:mx-0">
        <div className="w-full max-w-2xl mx-auto lg:mx-0 lg:max-w-none">
          {children}
        </div>
      </main>
    </div>
  );
}
