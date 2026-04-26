import { Icon } from "@/components/icon";

export default function AssistantLoading() {
  return (
    <div className="slide-in flex flex-col gap-6 pb-8">
      <header>
        <h1 className="t-headline-lg m-0 text-[var(--on-surface)]">
          AI Assistant
        </h1>
        <p className="mt-1.5 text-[15px] text-[var(--on-surface-variant)]">
          Loading your assistant...
        </p>
      </header>

      <div className="rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 md:p-5">
        <div className="flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded-full bg-[var(--surface-container-high)]" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-[var(--surface-container-high)]" />
          <div className="h-8 w-16 animate-pulse rounded-full bg-[var(--surface-container-high)]" />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
        <div className="flex h-[480px] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-[var(--on-surface-variant)]">
            <Icon name="chat_bubble" size={48} className="animate-pulse" />
            <p className="text-sm">Loading conversation...</p>
          </div>
        </div>

        <div className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 md:p-5">
          <div className="flex items-end gap-2 rounded-full border-2 border-[var(--outline-variant)] bg-[var(--surface-container)] p-2 opacity-50">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full">
              <Icon name="attach_file" size={20} />
            </div>
            <div className="flex-1 px-2 py-4">
              <div className="h-4 w-48 animate-pulse rounded bg-[var(--surface-container-high)]" />
            </div>
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--primary)] opacity-50">
              <Icon name="send" fill size={20} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
