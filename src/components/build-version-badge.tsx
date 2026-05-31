import { getBuildLabel, getBuildNotes } from "@/lib/build-version";

/** Fixed corner label so deployed builds are identifiable without opening DevTools. */
export function BuildVersionBadge() {
  const label = getBuildLabel();
  const notes = getBuildNotes();

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-3 right-3 z-[100] max-w-[min(20rem,90vw)] select-none text-right font-mono text-[10px] tracking-wide text-white/30"
      title={`Build ${label}\n\n${notes}`}
    >
      {label}
    </div>
  );
}
