import { getBuildLabel } from "@/lib/build-version";

/** Fixed corner label so deployed builds are identifiable without opening DevTools. */
export function BuildVersionBadge() {
  const label = getBuildLabel();

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-3 right-3 z-[100] select-none font-mono text-[10px] tracking-wide text-white/30"
      title={`Build ${label}`}
    >
      {label}
    </div>
  );
}
