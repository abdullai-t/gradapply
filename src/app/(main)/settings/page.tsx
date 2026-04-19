import { Suspense } from "react";

import { ConnectorsSettings } from "@/components/connectors-settings";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary/90">
          Account
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Settings
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Connect external services so outreach and future notifications can use your own
          accounts.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-xl border border-white/10 bg-muted/20 p-8 text-sm text-muted-foreground">
            Loading connectors…
          </div>
        }
      >
        <ConnectorsSettings />
      </Suspense>
    </div>
  );
}
