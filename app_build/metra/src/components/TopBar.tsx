import Avatar from "./Avatar";

/** TopBar is only shown on mobile (< lg). On desktop the sidebar nav replaces it. */
export default function TopBar() {
  return (
    <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between border-b border-outline-variant bg-surface px-4 py-3">
      <span className="text-[20px] font-bold tracking-tight text-primary-container">
        METRA
      </span>

      <div className="h-9 w-9 overflow-hidden rounded-full border border-outline-variant bg-surface-container-high">
        <Avatar
          state="closeup"
          className="h-full w-full object-cover object-top"
        />
      </div>
    </header>
  );
}
