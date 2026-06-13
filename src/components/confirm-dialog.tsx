"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "destructive" | "warning" | "default";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /** Material Symbols icon override for the header badge. */
  icon?: string;
};

type ConfirmRequest = ConfirmOptions & { open: boolean };

const VARIANT_META: Record<
  ConfirmVariant,
  {
    icon: string;
    iconWrap: string;
    iconColor: string;
    border: string;
    headerTint: string;
    confirmVariant: "destructive" | "primary" | "secondary";
  }
> = {
  destructive: {
    icon: "delete_forever",
    iconWrap: "bg-[var(--error-container)]",
    iconColor: "text-[var(--error)]",
    border: "border-[color-mix(in_srgb,var(--error)_28%,var(--outline-variant))]",
    headerTint:
      "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--error-container)_55%,transparent)_0%,transparent_100%)]",
    confirmVariant: "destructive",
  },
  warning: {
    icon: "link_off",
    iconWrap:
      "bg-[color-mix(in_srgb,var(--tertiary-container)_35%,var(--surface-container-low))]",
    iconColor: "text-[var(--tertiary)]",
    border:
      "border-[color-mix(in_srgb,var(--tertiary)_30%,var(--outline-variant))]",
    headerTint:
      "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tertiary-container)_40%,transparent)_0%,transparent_100%)]",
    confirmVariant: "secondary",
  },
  default: {
    icon: "help",
    iconWrap: "bg-[var(--primary-container)]",
    iconColor: "text-[var(--primary)]",
    border: "border-[var(--outline-variant)]",
    headerTint:
      "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary-container)_50%,transparent)_0%,transparent_100%)]",
    confirmVariant: "primary",
  },
};

const DEFAULT_LABELS: Record<
  ConfirmVariant,
  { confirm: string; cancel: string }
> = {
  destructive: { confirm: "Delete", cancel: "Cancel" },
  warning: { confirm: "Disconnect", cancel: "Cancel" },
  default: { confirm: "Confirm", cancel: "Cancel" },
};

const ConfirmContext = createContext<
  ((options: ConfirmOptions) => Promise<boolean>) | null
>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setRequest({ ...options, open: true });
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    setRequest((prev) => (prev ? { ...prev, open: false } : prev));
    resolveRef.current?.(result);
    resolveRef.current = null;
    window.setTimeout(() => setRequest(null), 200);
  }, []);

  const variant = request?.variant ?? "default";
  const meta = VARIANT_META[variant];
  const labels = DEFAULT_LABELS[variant];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request ? (
        <Dialog
          open={request.open}
          onOpenChange={(open) => {
            if (!open) settle(false);
          }}
        >
          <DialogContent
            hideCloseButton
            className={cn(
              "gap-0 overflow-hidden p-0 sm:max-w-md",
              meta.border,
            )}
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <div className={cn("px-6 pb-2 pt-8", meta.headerTint)}>
              <div
                className={cn(
                  "mx-auto grid h-14 w-14 place-items-center rounded-2xl shadow-sm",
                  meta.iconWrap,
                )}
              >
                <Icon
                  name={request.icon ?? meta.icon}
                  size={28}
                  className={meta.iconColor}
                />
              </div>
              <DialogHeader className="mt-5 space-y-2 text-center">
                <DialogTitle className="text-lg">{request.title}</DialogTitle>
                {request.description ? (
                  <DialogDescription className="text-pretty leading-relaxed">
                    {request.description}
                  </DialogDescription>
                ) : null}
              </DialogHeader>
            </div>
            <DialogFooter className="gap-2 border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-6 py-4 sm:justify-center">
              <Button
                type="button"
                variant="outline"
                className="min-w-[7rem] flex-1 sm:flex-none"
                onClick={() => settle(false)}
              >
                {request.cancelLabel ?? labels.cancel}
              </Button>
              <Button
                type="button"
                variant={meta.confirmVariant}
                className={cn(
                  "min-w-[7rem] flex-1 sm:flex-none",
                  variant === "warning" &&
                    "border-2 border-[var(--tertiary)] bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] hover:brightness-105",
                )}
                autoFocus
                onClick={() => settle(true)}
              >
                {request.confirmLabel ?? labels.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </ConfirmContext.Provider>
  );
}

/** Promise-based confirmation — drop-in replacement for `window.confirm`. */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return confirm;
}
